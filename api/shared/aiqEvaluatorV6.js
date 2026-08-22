/**
 * aiqEvaluatorV6.js — Motor de evaluación AIQ, rúbrica v6.
 *
 * Función pura de orquestación: recibe las respuestas de un assessment ya
 * ensambladas (ver assembleAnswers.js) y devuelve el resultado consolidado
 * según el esquema pedido. No conoce Table Storage ni ningún detalle de
 * persistencia — eso vive en results-save/index.js.
 *
 * Reemplazo total de aiqEvaluatorV5.js. No es una migración: los resultados
 * ya evaluados bajo v5 no se recalculan con este motor.
 */

const { chatTexto } = require("./llmClient");
const rubric = require("./aiqRubricV6");
const prompts = require("./aiqPromptsV6");

const LLM_TIMEOUT_MS = 90000;
// La llamada consolidada evalúa hasta 9 preguntas en 1 solo request: más
// tokens de entrada/salida que una llamada individual, timeout proporcionalmente
// mayor. Sigue muy por debajo del functionTimeout de la Azure Function (10 min).
const LLM_TIMEOUT_MS_CONSOLIDATED = 150000;
const LLM_RETRY_BACKOFF_MS = [500, 1500];

// Modo de invocación al LLM: "consolidated" (default, 1 llamada para las N
// preguntas calificables) o "legacy" (1 llamada por pregunta, comportamiento
// pre-optimización). Sirve como palanca de reversión operativa sin deploy de
// código: basta con fijar AIQ_LLM_MODE=legacy en la configuración de la
// Function App. El modo consolidado además cae a "legacy" automáticamente
// por assessment si la llamada consolidada falla por completo (ver
// evaluateLLMQuestionsConsolidated).
function resolveLlmMode(options) {
  if (options.llmMode) return options.llmMode;
  return process.env.AIQ_LLM_MODE === "legacy" ? "legacy" : "consolidated";
}

// Preguntas evaluadas por LLM (con prompt calificador propio).
const LLM_QUESTIONS = ["E2", "E3", "E5", "E6", "B2", "B4", "C1", "C2", "C3"];

// Preguntas donde aplica Capa 3 (vacío/off-topic/≤3 palabras -> L1 directo).
const CAPA3_QUESTIONS = new Set(["E2", "E3", "E5", "E6", "B2", "B4"]);

// Preguntas donde N2_short_circuit puede forzar L1 (B2 queda deliberadamente fuera).
const N2_SHORT_CIRCUIT_QUESTIONS = new Set(["E2", "E3", "E5", "E6", "B1", "B4"]);

function isRetryableError(err) {
  const status = err && err.status;
  if (status === undefined) return true; // error de red / parseo
  return status === 429 || status >= 500;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) llamando a Azure OpenAI para ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Extrae un valor "plano" de una respuesta guardada, tolerando las distintas
 * formas en que el frontend puede persistir una respuesta (string, número,
 * o un objeto con .value/.text/.selected/.choice).
 */
function extractAnswerValue(ans) {
  if (ans === null || ans === undefined) return undefined;
  if (typeof ans !== "object") return ans;
  if (Array.isArray(ans)) return ans;
  if (ans.value !== undefined) return ans.value;
  if (ans.text !== undefined) return ans.text;
  if (ans.selected !== undefined) return ans.selected;
  if (ans.choice !== undefined) return ans.choice;
  return ans;
}

function extractOpenText(ans) {
  if (ans === null || ans === undefined) return "";
  if (typeof ans === "string") return ans;
  if (typeof ans === "object") return ans.text || ans.value || "";
  return String(ans);
}

// maxWords=3 -> umbral de Capa 3 (rule 27); N3 (rule 19) reusa el mismo
// método de tokenización pero con su propio umbral de 5 palabras.
function isCapa3Trigger(text, maxWords = 3) {
  const trimmed = (text || "").trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  if (["n/a", "na", "."].includes(normalized)) return true;
  return prompts.wordCount(trimmed) <= maxWords;
}

function isN2ShortCircuit(v1, v2) {
  const v2List = Array.isArray(v2) ? v2 : v2 ? [v2] : [];
  return Number(v1) === 1 && v2List.length === 1 && v2List[0] === "Ninguna todavía";
}

/**
 * Llama al LLM para una pregunta calificable, con 1 reintento (backoff corto
 * ante error de red/5xx/429) y timeout por intento. Nunca lanza: si agota
 * los reintentos, devuelve { ok: false } para que el llamador aplique el
 * fallback conservador (ver evaluateAssessment).
 */
async function callLLMForQuestion(questionId, params, deps) {
  const callLLM = deps.callLLM;
  let lastErr;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const userPrompt = prompts.buildQuestionPrompt(questionId, params);
      const raw = await withTimeout(
        callLLM({ system: prompts.SYSTEM_PROMPT, user: userPrompt, questionId }),
        LLM_TIMEOUT_MS,
        questionId
      );
      const clean = String(raw || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed || !rubric.LEVEL_TO_INT[parsed.nivel]) {
        throw new Error(`Respuesta LLM sin "nivel" válido para ${questionId}`);
      }
      return { ok: true, parsed };
    } catch (err) {
      lastErr = err;
      // Visible en logs además del flag EVAL_ERROR_<questionId> en el resultado
      // final, para poder diagnosticar fallos de evaluación sin adivinar.
      console.error(`aiqEvaluatorV6: fallo evaluando ${questionId} (intento ${attempt}):`, err.name, err.status || "", err.message);
      if (attempt === 0 && isRetryableError(err)) {
        await sleep(LLM_RETRY_BACKOFF_MS[attempt]);
        continue;
      }
      break;
    }
  }
  return { ok: false, error: lastErr };
}

function applyCapa15(nivel, text) {
  // Lenguaje prescriptivo/3ª persona genérica sin "yo" -> bajar 1 nivel (piso L1).
  const normalized = (text || "").toLowerCase();
  const prescriptivo = /\b(hay que|se debe|deber[íi]a|el ser humano debe|uno debe)\b/.test(normalized);
  const tienePrimeraPersona = /\byo\b|\bmi\b|\bme\b/.test(normalized);
  if (prescriptivo && !tienePrimeraPersona) {
    const int = rubric.LEVEL_TO_INT[nivel];
    return rubric.INT_TO_LEVEL[Math.max(1, int - 1)];
  }
  return nivel;
}

/**
 * Post-procesamiento determinístico de una pregunta abierta ya evaluada por
 * el LLM (Capa 1.5). Independiente de si el resultado vino de una llamada
 * individual (legacy) o de una llamada consolidada — ambos flujos convergen acá.
 */
function finalizeOpenQuestion(questionId, respuesta, llmResult) {
  if (!llmResult.ok) {
    return { nivel: "L1", reglas_aplicadas: ["EVAL_ERROR"], fallback: true, questionId };
  }

  const parsed = llmResult.parsed;
  let nivel = parsed.nivel;
  // Capa 1.5 ya se le pide al LLM que la aplique; se refuerza determinísticamente
  // solo si el LLM no reportó haberla aplicado, para no bajar el nivel dos veces.
  const yaAplicoCapa15 = (parsed.reglas_aplicadas || []).some((r) => /capa 1\.5/i.test(r));
  if (!yaAplicoCapa15) {
    nivel = applyCapa15(nivel, respuesta);
  }

  return {
    nivel,
    reglas_aplicadas: parsed.reglas_aplicadas || [],
    flag_regla1_seguridad: !!parsed.flag_regla1_seguridad,
    champion_signals: parsed.champion_signals || null,
    fallback: false,
  };
}

/**
 * Evalúa una de las 6 preguntas abiertas con LLM (E2, E3, E5, E6, B2, B4).
 * Flujo legacy: 1 llamada individual por pregunta.
 */
async function evaluateOpenQuestion(questionId, respuesta, ctx, deps) {
  if (CAPA3_QUESTIONS.has(questionId) && isCapa3Trigger(respuesta)) {
    return { nivel: "L1", reglas_aplicadas: ["Capa 3"], fallback: false };
  }

  const params = { respuesta, V1: ctx.V1, V2: ctx.V2 };
  const result = await callLLMForQuestion(questionId, params, deps);
  return finalizeOpenQuestion(questionId, respuesta, result);
}

function buildCQuestionParams(questionId, answer) {
  const promptText = extractOpenText(answer);
  const tiempoSeg = typeof answer === "object" && answer !== null ? answer.time : undefined;
  const params =
    questionId === "C2"
      ? { prompt_mejorado: promptText, tiempo_seg: tiempoSeg }
      : { prompt_del_participante: promptText, tiempo_seg: tiempoSeg };
  return { params, tiempoSeg };
}

/**
 * Post-procesamiento determinístico de una pregunta de Sección C ya evaluada
 * por el LLM (techo L2 de C3 sin CoT). Independiente del flujo de llamada.
 */
function finalizeCQuestion(questionId, llmResult, tiempoSeg) {
  if (!llmResult.ok) {
    return { nivel: "L1", flag_N4_copy_paste: false, fallback: true, questionId, tiempoSeg };
  }

  const parsed = llmResult.parsed;
  let nivel = parsed.nivel;

  // C3 — regla dura: sin CoT explícito, techo L2 sin excepción, sin importar
  // qué tan bueno sea el resto del prompt (RCTFR no compensa su ausencia).
  // Igual que N2_short_circuit, no se confía únicamente en que el LLM
  // respete la instrucción: si reporta cot_explicito_presente=false pero
  // igual devolvió un nivel > L2, se corrige acá de forma determinística.
  if (questionId === "C3" && parsed.cot_explicito_presente === false) {
    nivel = rubric.INT_TO_LEVEL[Math.min(rubric.LEVEL_TO_INT[nivel], 2)];
  }

  return {
    nivel,
    flag_N4_copy_paste: !!parsed.flag_N4_copy_paste,
    fallback: false,
    tiempoSeg,
  };
}

/**
 * Evalúa una de las 3 preguntas prompt_input de Sección C (C1, C2, C3).
 * Flujo legacy: 1 llamada individual por pregunta.
 */
async function evaluateCQuestion(questionId, answer, deps) {
  const { params, tiempoSeg } = buildCQuestionParams(questionId, answer);
  const result = await callLLMForQuestion(questionId, params, deps);
  return finalizeCQuestion(questionId, result, tiempoSeg);
}

/**
 * Llama al LLM UNA sola vez con las N preguntas calificables restantes
 * (después de descartar las que ya cayeron en Capa 3, sin LLM) empaquetadas
 * en un único prompt consolidado. 1 reintento con el mismo criterio que
 * callLLMForQuestion. Nunca lanza: si agota los reintentos, devuelve
 * { ok: false } para que el llamador aplique el fallback a modo legacy.
 */
async function callLLMConsolidated(paramsByQuestion, deps) {
  const callLLM = deps.callLLM;
  let lastErr;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const userPrompt = prompts.buildConsolidatedPrompt(paramsByQuestion);
      const raw = await withTimeout(
        callLLM({ system: prompts.CONSOLIDATED_SYSTEM_PROMPT, user: userPrompt, questionId: "CONSOLIDATED" }),
        LLM_TIMEOUT_MS_CONSOLIDATED,
        "CONSOLIDATED"
      );
      const clean = String(raw || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Respuesta LLM consolidada no es un objeto JSON");
      }
      return { ok: true, parsed };
    } catch (err) {
      lastErr = err;
      console.error(`aiqEvaluatorV6: fallo evaluación consolidada (intento ${attempt}):`, err.name, err.status || "", err.message);
      if (attempt === 0 && isRetryableError(err)) {
        await sleep(LLM_RETRY_BACKOFF_MS[attempt]);
        continue;
      }
      break;
    }
  }
  return { ok: false, error: lastErr };
}

/**
 * Extrae el sub-resultado de una pregunta puntual desde el JSON consolidado.
 * Si la clave falta o no trae un "nivel" válido, se trata como fallo
 * puntual de ESA pregunta (mismo criterio que un fallo individual en el
 * flujo legacy) sin invalidar el resto del assessment.
 */
function extractSubResult(parsedConsolidated, questionId) {
  const sub = parsedConsolidated ? parsedConsolidated[questionId] : undefined;
  if (!sub || !rubric.LEVEL_TO_INT[sub.nivel]) {
    return { ok: false };
  }
  return { ok: true, parsed: sub };
}

/**
 * Evalúa las preguntas LLM-calificables en 1 sola llamada consolidada
 * (reemplaza las 9 llamadas individuales del flujo legacy por 1 sola,
 * eliminando el overhead de system prompt + boilerplate repetido 9x).
 *
 * Red de seguridad: si la llamada consolidada falla por completo (timeout,
 * error de red, o JSON top-level ilegible tras el reintento), se cae
 * automáticamente al flujo legacy (1 llamada por pregunta) SOLO para este
 * assessment — nunca deja el assessment sin evaluar. Si la llamada
 * consolidada responde pero a una pregunta puntual le falta su clave o
 * viene inválida, esa pregunta puntual cae a fallback L1 (igual que un
 * fallo individual en legacy) sin afectar a las demás.
 */
async function evaluateLLMQuestionsConsolidated(openQuestionIds, cQuestionIds, ctx, answers, deps) {
  const results = {};

  const openToEvaluate = openQuestionIds.filter((q) => {
    const respuesta = extractOpenText(answers[q]);
    if (CAPA3_QUESTIONS.has(q) && isCapa3Trigger(respuesta)) {
      results[q] = { nivel: "L1", reglas_aplicadas: ["Capa 3"], fallback: false };
      return false;
    }
    return true;
  });

  const paramsByQuestion = {};
  openToEvaluate.forEach((q) => {
    paramsByQuestion[q] = { respuesta: extractOpenText(answers[q]), V1: ctx.V1, V2: ctx.V2 };
  });
  const cParams = {};
  cQuestionIds.forEach((q) => {
    const { params, tiempoSeg } = buildCQuestionParams(q, answers[q]);
    cParams[q] = { params, tiempoSeg };
    paramsByQuestion[q] = params;
  });

  const toEvaluate = [...openToEvaluate, ...cQuestionIds];
  if (toEvaluate.length === 0) {
    return results;
  }

  const consolidated = await callLLMConsolidated(paramsByQuestion, deps);

  if (!consolidated.ok) {
    // La llamada consolidada falló por completo -> red de seguridad: flujo
    // legacy 1 llamada por pregunta, solo para las preguntas pendientes.
    const settled = await Promise.allSettled(toEvaluate.map((q) => callLLMForQuestion(q, paramsByQuestion[q], deps)));
    toEvaluate.forEach((q, idx) => {
      const settledResult = settled[idx];
      const llmResult = settledResult.status === "fulfilled" ? settledResult.value : { ok: false, error: settledResult.reason };
      results[q] = openToEvaluate.includes(q)
        ? finalizeOpenQuestion(q, extractOpenText(answers[q]), llmResult)
        : finalizeCQuestion(q, llmResult, cParams[q].tiempoSeg);
    });
    return results;
  }

  openToEvaluate.forEach((q) => {
    const sub = extractSubResult(consolidated.parsed, q);
    results[q] = finalizeOpenQuestion(q, extractOpenText(answers[q]), sub);
  });
  cQuestionIds.forEach((q) => {
    const sub = extractSubResult(consolidated.parsed, q);
    results[q] = finalizeCQuestion(q, sub, cParams[q].tiempoSeg);
  });
  return results;
}

function computeSectionLevel(levels) {
  const ints = levels.map((l) => rubric.LEVEL_TO_INT[l]);
  const avg = ints.reduce((a, b) => a + b, 0) / ints.length;
  return Math.round(avg);
}

const SECTION_TIE_BREAK_ORDER = { C: 0, A: 1, B: 2 };

/**
 * Selecciona 2-3 recomendaciones_ids: rankear secciones por nivel (desempate
 * C>A>B), elegir dentro de cada sección la pregunta de menor nivel individual
 * (excluyendo B1 y E6, que no tienen tarjetas en el catálogo v6), sin repetir
 * sección, y asegurar al menos una recomendación hacia L4 si el nivel general
 * es >= L3.
 */
function selectRecommendations({ sectionInts, questionLevels, nivelFinal }) {
  const sectionsRanked = ["A", "B", "C"]
    .map((s) => ({ section: s, level: sectionInts[s] }))
    .sort((a, b) => a.level - b.level || SECTION_TIE_BREAK_ORDER[a.section] - SECTION_TIE_BREAK_ORDER[b.section]);

  // B1 (cerrada) y E6 (conceptual) no tienen tarjetas de recomendación en el
  // catálogo v6 — excluidas explícitamente, a diferencia de v5 que solo excluía B1.
  function eligibleQuestions(section) {
    return rubric.SECTION_QUESTIONS[section]
      .filter((q) => q !== "B1" && q !== "E6")
      .filter((q) => questionLevels[q] !== undefined && rubric.LEVEL_TO_INT[questionLevels[q]] < 4)
      .sort(
        (a, b) =>
          rubric.LEVEL_TO_INT[questionLevels[a]] - rubric.LEVEL_TO_INT[questionLevels[b]] ||
          rubric.SECTION_QUESTIONS[section].indexOf(a) - rubric.SECTION_QUESTIONS[section].indexOf(b)
      );
  }

  function transitionFor(questionId) {
    const cur = rubric.LEVEL_TO_INT[questionLevels[questionId]];
    return cur === 1 ? "t-12" : cur === 2 ? "t-23" : "t-34";
  }

  function buildId(section, questionId) {
    const cur = rubric.LEVEL_TO_INT[questionLevels[questionId]];
    return `${section}-${rubric.QUESTION_NUMBER[questionId]}-L${cur}->L${cur + 1}`;
  }

  const selected = [];
  const usedSections = new Set();

  for (const { section } of sectionsRanked) {
    if (selected.length >= 3) break;
    const candidates = eligibleQuestions(section);
    if (candidates.length === 0) continue;
    const questionId = candidates[0];
    selected.push({ section, questionId, transition: transitionFor(questionId) });
    usedSections.add(section);
  }

  // Si el nivel general es >= L3, asegurar al menos una recomendación t-34 (->L4).
  const nivelFinalInt = rubric.LEVEL_TO_INT[nivelFinal];
  const tieneEmpujeL4 = selected.some((s) => s.transition === "t-34");
  if (nivelFinalInt >= 3 && !tieneEmpujeL4) {
    const l3Candidates = ["A", "B", "C"].flatMap((section) =>
      rubric.SECTION_QUESTIONS[section]
        .filter((q) => q !== "B1" && q !== "E6" && questionLevels[q] === "L3")
        .map((questionId) => ({ section, questionId }))
    );
    l3Candidates.sort((a, b) => (usedSections.has(a.section) ? 1 : 0) - (usedSections.has(b.section) ? 1 : 0));

    if (l3Candidates.length > 0) {
      const best = l3Candidates[0];
      if (selected.length < 3 && !usedSections.has(best.section)) {
        selected.push({ section: best.section, questionId: best.questionId, transition: "t-34" });
        usedSections.add(best.section);
      } else {
        const sameSectionIdx = selected.findIndex((s) => s.section === best.section);
        if (sameSectionIdx >= 0) {
          selected[sameSectionIdx] = { section: best.section, questionId: best.questionId, transition: "t-34" };
        } else {
          const weakestPriorityIdx = selected.findIndex((s) => s.transition === "t-12");
          const replaceIdx = weakestPriorityIdx >= 0 ? weakestPriorityIdx : selected.length - 1;
          if (replaceIdx >= 0) {
            usedSections.delete(selected[replaceIdx].section);
            selected[replaceIdx] = { section: best.section, questionId: best.questionId, transition: "t-34" };
            usedSections.add(best.section);
          }
        }
      }
    }
  }

  return selected.map((s) => buildId(s.section, s.questionId));
}

/**
 * Punto de entrada principal. `answers` es el objeto ya ensamblado
 * {V1, V2, E2, E3, ..., D5, D6, ...} y `participant` trae {nombre, email, empresa}.
 * `options.callLLM` permite inyectar un cliente mockeado en tests; por defecto
 * usa el proveedor configurado en AIQ_LLM_PROVIDER (Azure OpenAI o Bedrock).
 */
async function evaluateAssessment(answers, participant = {}, options = {}) {
  const callLLM =
    options.callLLM ||
    (async ({ system, user, questionId }) =>
      chatTexto({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // El modelo configurado puede ser de razonamiento (consume tokens
        // ocultos de "thinking" antes del JSON visible), por eso el presupuesto
        // es generoso: no es solo para el output. La llamada consolidada
        // empaqueta hasta 9 preguntas en 1 request, así que necesita más.
        max_completion_tokens: questionId === "CONSOLIDATED" ? 9000 : 2000,
      }));
  const deps = { callLLM };

  const V1 = extractAnswerValue(answers.V1);
  const V2 = extractAnswerValue(answers.V2);
  const D5 = extractAnswerValue(answers.D5);
  const D6 = extractAnswerValue(answers.D6);
  const ctx = { V1, V2 };

  const shortCircuit = isN2ShortCircuit(V1, V2);

  const openQuestionIds = ["E2", "E3", "E5", "E6", "B2", "B4"];
  const cQuestionIds = ["C1", "C2", "C3"];

  const llmMode = resolveLlmMode(options);
  const results = {};
  const flags = new Set();

  if (llmMode === "legacy") {
    // Flujo pre-optimización: 1 llamada individual por pregunta en paralelo
    // (Promise.allSettled: un fallo no cancela las demás). Se conserva como
    // red de reversión operativa (AIQ_LLM_MODE=legacy) y como fallback
    // automático del modo consolidado ante fallo total (ver más abajo).
    const settled = await Promise.allSettled([
      ...openQuestionIds.map((q) => evaluateOpenQuestion(q, extractOpenText(answers[q]), ctx, deps)),
      ...cQuestionIds.map((q) => evaluateCQuestion(q, answers[q], deps)),
    ]);

    [...openQuestionIds, ...cQuestionIds].forEach((questionId, idx) => {
      const settledResult = settled[idx];
      results[questionId] = settledResult.status === "fulfilled" ? settledResult.value : { nivel: "L1", fallback: true };
    });
  } else {
    // Flujo consolidado (default): 1 sola llamada al LLM para todas las
    // preguntas calificables del assessment en vez de 9 independientes.
    Object.assign(results, await evaluateLLMQuestionsConsolidated(openQuestionIds, cQuestionIds, ctx, answers, deps));
  }

  [...openQuestionIds, ...cQuestionIds].forEach((questionId) => {
    if (results[questionId] && results[questionId].fallback) {
      flags.add(`EVAL_ERROR_${questionId}`);
    }
  });

  // B1: mapeo directo, sin LLM.
  const b1Option = extractAnswerValue(answers.B1);
  results.B1 = { nivel: rubric.B1_OPTION_TO_LEVEL[Number(b1Option)] || "L1" };

  // N2_short_circuit: override determinístico, independiente de lo que haya dicho el LLM.
  if (shortCircuit) {
    N2_SHORT_CIRCUIT_QUESTIONS.forEach((q) => {
      results[q] = { ...results[q], nivel: "L1" };
    });
    flags.add("N2_short_circuit");
  }

  const questionLevels = {
    E2: results.E2.nivel,
    E3: results.E3.nivel,
    E5: results.E5.nivel,
    E6: results.E6.nivel,
    B1: results.B1.nivel,
    B2: results.B2.nivel,
    B4: results.B4.nivel,
    C1: results.C1.nivel,
    C2: results.C2.nivel,
    C3: results.C3.nivel,
  };

  const sectionInts = {
    A: computeSectionLevel([questionLevels.E2, questionLevels.E3, questionLevels.E5, questionLevels.E6]),
    B: computeSectionLevel([questionLevels.B1, questionLevels.B2, questionLevels.B4]),
    C: computeSectionLevel([questionLevels.C1, questionLevels.C2, questionLevels.C3]),
  };

  // N4x#: preguntas de Sección C con tiempo < N4_TIME_THRESHOLD_SEC y nivel >= L3.
  // Se calcula ANTES de la fórmula ponderada porque, a diferencia de v5 (donde
  // esta flag era puramente informativa), en v6 puede topar el nivel de Sección C.
  const n4Count = rubric.N4_QUESTIONS.filter((q) => {
    const r = results[q];
    const tiempo = r && r.tiempoSeg;
    if (typeof tiempo !== "number") return false;
    return tiempo < rubric.N4_TIME_THRESHOLD_SEC && rubric.LEVEL_TO_INT[r.nivel] >= 3;
  }).length;
  if (n4Count > 0) {
    flags.add(`N4x${n4Count}`);
  }

  // Tope condicional NUEVO en v6: si Sección C calculó L4 (nivel entero 4) Y
  // se disparó al menos una marca N4x#, forzar Sección C a nivel 3 (Practicante)
  // ANTES de sumar la fórmula ponderada. Si Sección C quedó en L3 o menos, la
  // flag N4x# permanece solo como alerta y no toca ningún puntaje. No se emite
  // una flag adicional para este ajuste — solo N4x# está en la especificación.
  if (n4Count > 0 && sectionInts.C === 4) {
    sectionInts.C = 3;
  }

  let puntaje =
    sectionInts.A * rubric.SECTION_WEIGHTS.A +
    sectionInts.B * rubric.SECTION_WEIGHTS.B +
    sectionInts.C * rubric.SECTION_WEIGHTS.C;
  let nivel = rubric.levelFromPuntaje(puntaje);

  // N2_suave: declara uso regular (V1 3 o 4) pero Sección A quedó en L1.
  if ([3, 4].includes(Number(V1)) && sectionInts.A === 1) {
    flags.add("N2_suave");
  }

  // N1: perfil desbalanceado. Se evalúa sobre los sectionInts ya topados por
  // N4x# (valores finales usados en la fórmula), no sobre un cálculo previo.
  const sectionValues = [sectionInts.A, sectionInts.B, sectionInts.C];
  if (Math.max(...sectionValues) - Math.min(...sectionValues) >= 2) {
    flags.add("N1");
  }

  // N3: >=50% de las 5 preguntas abiertas que pesan son cortas (<=5 palabras)
  // o vacías/"."/N-A. CAMBIA respecto a v5: E6 queda excluida de este conteo
  // (rubric.N3_QUESTIONS ya refleja las 5 preguntas correctas, sin E6).
  const n3Count = rubric.N3_QUESTIONS.filter((q) => isCapa3Trigger(extractOpenText(answers[q]), 5)).length;
  if (n3Count / rubric.N3_QUESTIONS.length >= 0.5) {
    flags.add("N3");
  }

  // REGLA1_SEGURIDAD: dispara en B2, topa puntaje/nivel final en L2 (escala
  // v6: cap = 2.8). Se aplica DESPUÉS del tope de N4x# sobre Sección C — son
  // reglas independientes que pueden coexistir en el mismo perfil sin
  // conflicto de precedencia: N4x# actúa sobre sectionInts.C antes de sumar
  // la fórmula, REGLA1_SEGURIDAD actúa sobre el puntaje ya ponderado.
  if (results.B2.flag_regla1_seguridad) {
    flags.add("REGLA1_SEGURIDAD");
    puntaje = Math.min(puntaje, rubric.REGLA1_CAP_PUNTAJE);
    nivel = rubric.levelFromPuntaje(puntaje);
  }

  // CANDIDATO_A_CHAMPION: puntaje >= 3.9 (v6) + nivel(E5)=L4 + 3 señales + D5/D6.
  // Nota de signo: D6 usa escala INVERTIDA (1 = mejor: conoce la política y
  // sabe qué dice; 4 = peor) a diferencia de D1/D1b/D9 donde 4 = mejor — no
  // "corregir" este ===1 por comparación superficial con las otras preguntas D.
  const championSignals = results.E5.champion_signals;
  const tresSenalesChampion =
    championSignals && championSignals.liderazgo && championSignals.recurso_recurrente && championSignals.impacto_medible;
  const condicionD5D6 = D5 === "yes_active" || Number(D6) === 1;
  if (
    puntaje >= rubric.CHAMPION_PUNTAJE_THRESHOLD &&
    questionLevels.E5 === "L4" &&
    tresSenalesChampion &&
    condicionD5D6
  ) {
    flags.add("CANDIDATO_A_CHAMPION");
  }

  const recomendaciones_ids = selectRecommendations({ sectionInts, questionLevels, nivelFinal: nivel });

  return {
    nombre: participant.nombre || "",
    email: participant.email || "",
    empresa: participant.empresa || "",
    nivel,
    puntaje: Math.round(puntaje * 100) / 100,
    A: sectionInts.A,
    B: sectionInts.B,
    C: sectionInts.C,
    flags: Array.from(flags),
    recomendaciones_ids,
    rubricVersion: "v6",
    perQuestionLevels: questionLevels,
  };
}

module.exports = {
  evaluateAssessment,
  // exportados para tests unitarios
  computeSectionLevel,
  selectRecommendations,
  isN2ShortCircuit,
  isCapa3Trigger,
  extractAnswerValue,
};
