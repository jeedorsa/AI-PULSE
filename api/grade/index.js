/**
 * grade/index.js — Evaluador AIQ Framework completo
 *
 * Implementa el sistema de evaluación del skill aiq-evaluator:
 * - Prompts específicos por pregunta con criterios L1→L4-L
 * - Framework RCTFR para Sección C (C1, C2, C3)
 * - Flags por pregunta (regla1_activa, senial_l4l_*, perfil_con_automatizacion...)
 * - Fórmula de consolidación con pesos correctos por sección
 * - Reglas de ajuste 1-4 (piso seguridad, techo consistencia, desequilibrio, L4-L)
 */

const { AzureOpenAI } = require("openai");

// ─── SYSTEM PROMPT MAESTRO ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el evaluador del AIQ Framework de AI Pulse. Tu función es analizar respuestas de un encuestado y asignar niveles de madurez en inteligencia artificial con criterio riguroso, consistente y fundamentado en evidencia concreta.

PRINCIPIOS DE EVALUACIÓN
1. Baremo absoluto: mismo estándar para todos. El perfil es contexto interpretativo, no modificador de puntaje.
2. Especificidad como criterio de elevación: sin detalle concreto no puede superar L2.
3. El Laboratorio (C1-C3) es el dato más confiable: en inconsistencias A/B vs C, priorizar C.
4. Intención sin acción = nivel bajo.
5. Interdependencias activas: mantener registro de señales para cruce posterior.

ESCALA: L1=1pt / L2=2pt / L3=3pt / L4-T=4pt / L4-L=5pt

FORMATO OUTPUT — Único JSON por pregunta, sin texto antes ni después:
{
  "pregunta": "[ID]",
  "nivel": "[L1/L2/L3/L4-T/L4-L]",
  "puntaje": [1-5],
  "razonamiento": "[2-4 oraciones con evidencia específica]",
  "flags": ["lista o vacía"],
  "senales_para_cruce": ["lista o vacía"]
}

Si la pregunta no puntúa (Sección D, B3.5): usar puntaje null, nivel null.`;

// ─── PROMPTS POR PREGUNTA ─────────────────────────────────────────────────────
function buildPrompt(questionId, answer, context = {}) {
  const a = typeof answer === "string" ? answer : answer?.text || answer?.value || JSON.stringify(answer);

  switch (questionId) {

    case "E2": return `Evalúa la siguiente respuesta usando los criterios del AIQ Framework.

PREGUNTA E2: "Pensando en el último entregable importante que produjiste (reporte, código, plan, presentación), ¿qué papel jugó la IA? Descríbeme exactamente cómo la usaste o por qué decidiste no usarla."

RESPUESTA DEL ENCUESTADO:
${a}

CRITERIOS:
- L1 (1 pt): No usó IA o descarta sin justificación. Procesos 100% manuales.
- L2 (2 pt): Uso puntual y superficial. Sin criterio sobre el resultado.
- L3 (3 pt): Uso con propósito claro. Describe integración al flujo. Muestra iteración o ajuste.
- L4-T (4 pt): Proceso estructurado con pasos. Automatización o integración con herramientas.
- L4-L (5 pt): Impacto que trasciende lo individual. Compartió, replicó o convirtió en estándar.

REGLAS: Sin detalle concreto → no puede superar L2.
FLAGS: "respuesta_vaga_sin_detalle" si aplica. Si nivel ≥ L4-T → señal para cruzar con Laboratorio.`;

    case "E3": {
      const val = answer?.value || a;
      const map = { A: 1, B: 2, C: 3, D: 4, E: 5 };
      const score = map[val?.charAt(0)?.toUpperCase()] || null;
      return `Evalúa la respuesta de opción múltiple.

PREGUNTA E3: "Cuando la IA te da un resultado incorrecto, ¿cuál es tu reacción más frecuente?"
OPCIONES: A. No lo noto / B. Repito la pregunta igual / C. Ajusto el prompt manualmente / D. Proceso sistemático / E. Comparto la lección

RESPUESTA DEL ENCUESTADO: ${val || a}

CRITERIOS: A→L1(1) / B→L2(2) / C→L3(3) / D→L4-T(4) / E→L4-L(5)

REGLAS CRÍTICAS:
- Opción E → puntaje tentativo L4-L, DEBE cruzarse con E5. Si E5 no tiene evidencia → degradar a L3.
- Opción D → puntaje tentativo L4-T, DEBE cruzarse con C1-C3.

FLAGS: "e_sin_verificar" si E / "d_sin_verificar" si D.
${score ? `Puntaje esperado por opción: ${score}` : ""}`;
    }

    case "E4": {
      const val = answer?.value || a;
      return `Evalúa la respuesta de opción múltiple.

PREGUNTA E4: "¿Cómo usas la IA ante un tema desconocido fuera de tu especialidad?"
OPCIONES: A. No la uso / B. Busco definiciones / C. Pido analogías / D. Guía paso a paso / E. Plan de estudio

RESPUESTA DEL ENCUESTADO: ${val || a}

CRITERIOS: A→L1(1) / B→L2(2) / C→L3(3) / D→L3-alto(3.5→usar 4 para cálculo) / E→L4-T(4)

REGLAS: Techo en L4-T(4). No puede llegar a L4-L.
FLAGS: "e_posiblemente_aspiracional" si opción E pero respuestas previas sugieren perfil L2-L3.`;
    }

    case "E5": return `Evalúa la siguiente respuesta usando los criterios del AIQ Framework.

PREGUNTA E5: "¿Qué has enseñado o compartido sobre IA dentro de tu empresa? Cuéntame el caso más reciente. Si aún no lo has hecho, puedes decirlo."

RESPUESTA DEL ENCUESTADO:
${a}

CRITERIOS:
- L1 (1 pt): No ha compartido nada. Intención sin acción = L1.
- L2 (2 pt): Mención informal sin intención pedagógica.
- L3 (3 pt): Compartió algo concreto de forma espontánea pero no sistemática.
- L4-T (4 pt): Activo transferible generado — guía, flujo, proceso documentado.
- L4-L (5 pt): Iniciativa liderada con impacto demostrable más allá del equipo directo.

REGLAS: Intención sin acción = L1. Sin especificidad → no puede superar L2.
FLAGS: "senial_l4l_e5" si clasifica L4-L.`;

    case "B1": {
      const val = answer?.value || a;
      return `Evalúa la respuesta de opción múltiple.

PREGUNTA B1: "¿Cómo verificas que un dato técnico de la IA es correcto?"
OPCIONES: A. Confío si suena bien / B. Búsqueda Google / C. Fuente confiable o experto / D. Método sistemático

RESPUESTA DEL ENCUESTADO: ${val || a}

CRITERIOS: A→L1(1) / B→L2(2) / C→L3(3) / D→L4-T(4)
FLAGS: "riesgo_uso_irresponsable" si opción A.`;
    }

    case "B2": return `Evalúa la siguiente respuesta usando los criterios del AIQ Framework.

PREGUNTA B2: "¿Qué tipo de información corporativa evitas compartir con la IA y por qué razones de seguridad lo haces?"

RESPUESTA DEL ENCUESTADO:
${a}

⚠️ ATENCIÓN CRÍTICA: Esta pregunta activa la Regla 1 — Piso de Seguridad SI clasifica en L1.
SI nivel = L1 → incluir flag "regla1_activa". Este flag SOLO puede generarse desde B2.

CRITERIOS:
- L1 (1 pt): No identifica información sensible. Ausencia total de conciencia del riesgo.
- L2 (2 pt): Categoría genérica sin especificar qué significa en su contexto real.
- L3 (3 pt): Categorías específicas con al menos una razón concreta.
- L4-T (4 pt): Criterio aplicado — distingue tipos, menciona políticas, riesgos concretos.
- L4-L (5 pt): Ha comunicado o establecido criterios de seguridad para su equipo.

FLAGS: "regla1_activa" si L1 (CRÍTICO). También "b2_d6_riesgo_critico" si L1 y hay evidencia de desconocimiento total.`;

    case "B4": return `Evalúa la siguiente respuesta usando los criterios del AIQ Framework.

PREGUNTA B4: "¿Qué tipos de archivos has analizado con IA además de texto? Cuéntame un ejemplo."

RESPUESTA DEL ENCUESTADO:
${a}

CRITERIOS:
- L1 (1 pt): Sin archivos ni ejemplo concreto.
- L2 (2 pt): Al menos un archivo pero ejemplo superficial.
- L3 (3 pt): Caso concreto — qué subió, qué pidió, qué hizo con el resultado.
- L4-T (4 pt): Caso sofisticado con impacto claro en el trabajo.
- L4-L (5 pt): Proceso replicable o compartido como práctica estándar.

REGLAS: El ejemplo tiene más peso que la selección de tipo de archivo. Sin ejemplo concreto → no puede superar L2.`;

    case "B5": return `Evalúa la siguiente respuesta usando los criterios del AIQ Framework.

PREGUNTA B5: "¿Qué tarea repetitiva has logrado delegar total o parcialmente a la IA? Describe qué tan lejos llegaste — y si no lo has logrado, qué te ha frenado."

RESPUESTA DEL ENCUESTADO:
${a}

CRITERIOS:
- L1 (1 pt): No ha intentado. No identifica tareas automatizables.
- L2 (2 pt): Intento superficial o fallido sin aprendizaje.
- L3 (3 pt): Simplificación real pero requiere intervención manual activa en cada ciclo.
- L4-T (4 pt): Automatización con mínima intervención humana. Proceso autónomo.
- L4-L (5 pt): Proceso replicado o enseñado a otros.

DISTINCIÓN CRÍTICA L3/L4-T: ¿Requiere intervención activa en cada ciclo? Sí=L3. No=L4-T.
Para L4-T: descripción debe incluir entrada + procesamiento + output. Sin los tres → no hay L4-T.
FLAGS: "perfil_con_automatizacion" si nivel ≥ L3.`;

    case "B6": {
      const perfilAuto = context.perfil_con_automatizacion || false;
      return `Evalúa la siguiente respuesta usando los criterios del AIQ Framework.

PREGUNTA B6: "¿Has logrado que la IA trabaje con información específica de tu empresa — documentos internos, bases de datos, manuales — en lugar de depender solo de su conocimiento general?"

RESPUESTA DEL ENCUESTADO:
${a}

CONFIGURACIÓN DE PESO:
- perfil_con_automatizacion = ${perfilAuto}
- Si true → peso completo 20%. Si false → peso reducido 10% → registrar "b6_peso_reducido": true en JSON.

CRITERIOS:
- L1 (1 pt): No ha intentado.
- L2 (2 pt): Copy-paste de información interna sin estructura.
- L3 (3 pt): Documento cargado con resultado útil. Manual y puntual.
- L4-T (4 pt): Integración estructurada — Custom GPTs, RAG, API. Proceso replicable.
- L4-L (5 pt): Integración desplegada para el equipo — activo colectivo.

Para L4-T: descripción debe incluir qué información + cómo se conectó + qué problema resuelve.`;
    }

    case "C1": return `Evalúa el siguiente prompt usando el Framework RCTFR del AIQ.

CAPA 1 — RCTFR:
- ROL: ¿Asigna un rol específico y relevante?
- CONTEXTO: ¿Provee información suficiente sobre la situación?
- TAREA: ¿Define con precisión qué debe hacer la IA?
- FORMATO: ¿Especifica cómo debe estructurarse el output?
- RESTRICCIONES: ¿Anticipa límites o condiciones?

CAPA 2 — Técnicas avanzadas (cada una suma):
- Chain of Thought, Clarifying questions, Few-shot/Ejemplos, Instrucciones en capas, Delimitadores estructurales, Especificación de audiencia, Validación propia, Lógica condicional.

CRITERIOS:
- L1 (1 pt): Copy-paste del enunciado o sin estructura.
- L2 (2 pt): 1-2 componentes RCTFR básicos. Genérico.
- L3 (3 pt): 3-4 componentes RCTFR con al menos uno de Capa 2.
- L4-T (4 pt): RCTFR completo + 2+ técnicas avanzadas.
- L4-L (5 pt): RCTFR completo + 4+ técnicas + lógica condicional o auto-validación.

PREGUNTA C1: Email a cliente VIP informando retraso de 3 semanas.
TENSIÓN: Cliente VIP + noticia negativa + tono empático y profesional.

DEGRADACIÓN ESPECÍFICA C1:
- Copy-paste del enunciado → L1
- Genérico sin capturar la tensión (VIP + noticia negativa) → L2 máximo
- No reconoce que es VIP o que la noticia es negativa → degradar un nivel adicional

PROMPT DEL ENCUESTADO:
${a}`;

    case "C2": return `Evalúa el siguiente prompt mejorado usando el Framework RCTFR del AIQ.

CAPA 1 — RCTFR:
- ROL: ¿Asigna un rol específico y relevante?
- CONTEXTO: ¿Provee información suficiente sobre la situación?
- TAREA: ¿Define con precisión qué debe hacer la IA?
- FORMATO: ¿Especifica cómo debe estructurarse el output?
- RESTRICCIONES: ¿Anticipa límites o condiciones?

CAPA 2 — Técnicas avanzadas (cada una suma):
- Chain of Thought, Clarifying questions, Few-shot/Ejemplos, Instrucciones en capas, Delimitadores estructurales, Especificación de audiencia, Validación propia, Lógica condicional.

CRITERIOS:
- L1 (1 pt): Cambiar palabras sin agregar componentes estructurales.
- L2 (2 pt): 1-2 mejoras superficiales. No captura tensión de resultados negativos.
- L3 (3 pt): 3-4 componentes RCTFR + tono apropiado para malas noticias.
- L4-T (4 pt): RCTFR completo + 2+ técnicas avanzadas.
- L4-L (5 pt): RCTFR completo + 4+ técnicas + lógica condicional o auto-validación.

PROMPT ORIGINAL A MEJORAR: 'Necesito una presentación de resultados para mi jefe, no fueron buenos, que sea profesional y corta'
PROBLEMAS DEL ORIGINAL: Sin Rol / Contexto insuficiente / Tarea ambigua / Formato vago / Sin restricciones

DEGRADACIÓN ESPECÍFICA C2:
- Cambiar palabras sin agregar componentes estructurales → L1
- No capturar la tensión de resultados negativos → degradar un nivel

PROMPT MEJORADO POR EL ENCUESTADO:
${a}`;

    case "C3": return `Evalúa el siguiente prompt usando el Framework RCTFR del AIQ. ATENCIÓN: Esta es C3 — evaluación especial de Chain of Thought.

CAPA 1 — RCTFR:
- ROL: ¿Asigna un rol específico y relevante?
- CONTEXTO: ¿Provee información suficiente sobre la situación?
- TAREA: ¿Define con precisión qué debe hacer la IA?
- FORMATO: ¿Especifica cómo debe estructurarse el output?
- RESTRICCIONES: ¿Anticipa límites o condiciones?

CAPA 2 — Técnicas avanzadas (cada una suma):
Chain of Thought, Clarifying questions, Few-shot/Ejemplos, Instrucciones en capas, Delimitadores estructurales, Especificación de audiencia, Validación propia, Lógica condicional.

CRITERIOS:
- L1 (1 pt): Sin estructura. Busca validación en lugar de análisis.
- L2 (2 pt): 1-2 componentes RCTFR. Pasos genéricos o CoT incompleto.
- L3 (3 pt): 3-4 componentes RCTFR + intento real de CoT.
- L4-T (4 pt): RCTFR completo + CoT real + 2+ técnicas avanzadas.
- L4-L (5 pt): RCTFR completo + CoT real + 4+ técnicas.

EVALUACIÓN ESPECIAL DE CoT:
- CoT real: define pasos ESPECÍFICOS antes de concluir.
- CoT nominal: solo dice "paso a paso" sin definir pasos → NO cuenta, degradar un nivel.
- CoT incompleto: numerales (1.. 2.. 3..) con pasos vacíos → degradar a L2. La intención no equivale a instrucción.
- "Piensa paso a paso" sin definir los pasos → no es CoT real, degradar un nivel.

DEGRADACIÓN ESPECÍFICA C3:
- Pasos genéricos no específicos al problema → L2 máximo.
- Prompt que busca validación en lugar de análisis → L1 + flag "prompt_validacion_no_analisis".

PROMPT DEL ENCUESTADO (decisión de lanzar producto con razonamiento paso a paso):
${a}`;

    default:
      // Fallback genérico para preguntas D u otras
      return `Evalúa la siguiente respuesta del assessment AIQ. Pregunta ID: ${questionId}

RESPUESTA:
${a}

Clasifica usando la escala L1-L4-L. Para preguntas de Sección D, asigna puntaje null y nivel null — solo clasifica e identifica flags organizacionales.`;
  }
}

// ─── CONSOLIDACIÓN AIQ FINAL ─────────────────────────────────────────────────
function consolidateAIQ(scores, flags, perfilConAutomatizacion) {
  const s = scores;
  const get = (k) => Number(s[k]) || 0;

  // Sección A
  const A = (get("E2") * 0.35) + (get("E3") * 0.20) + (get("E4") * 0.15) + (get("E5") * 0.30);

  // Sección B — pesos dinámicos según perfil_con_automatizacion
  let B;
  if (perfilConAutomatizacion) {
    B = (get("B1") * 0.15) + (get("B2") * 0.25) + (get("B4") * 0.15) + (get("B5") * 0.25) + (get("B6") * 0.20);
  } else {
    B = (get("B1") * 0.165) + (get("B2") * 0.275) + (get("B4") * 0.165) + (get("B5") * 0.275) + (get("B6") * 0.10);
  }

  // Sección C
  const C = (get("C1") * 0.30) + (get("C2") * 0.30) + (get("C3") * 0.40);

  const aiq_base = (A * 0.30) + (B * 0.30) + (C * 0.40);

  let aiq_final = aiq_base;
  let regla1 = false, regla2 = false, regla3 = false, regla4 = false;

  // Regla 1 — Piso de Seguridad (SOLO por B2=L1, no por ninguna otra pregunta)
  if (flags.includes("regla1_activa")) {
    regla1 = true;
    if (aiq_final > 2.9) aiq_final = 2.9;
  }

  // Regla 2 — Techo de Consistencia
  const sectionsAbove4 = [A, B, C].filter(x => x >= 4.0).length;
  if (aiq_final >= 4.0 && sectionsAbove4 < 2) {
    regla2 = true;
    aiq_final = 3.9;
  }

  // Regla 3 — Perfil Desequilibrado (solo flag, no modifica score)
  const sections = [A, B, C];
  const maxS = Math.max(...sections), minS = Math.min(...sections);
  if ((maxS - minS) >= 2.0) {
    regla3 = true;
    if (!flags.includes("perfil_desequilibrado")) flags.push("perfil_desequilibrado");
  }

  // Regla 4 — Confirmación L4-L
  const l4lSignals = ["senial_l4l_e5", "senial_l4l_d5", "senial_l4l_d6"].filter(f => flags.includes(f));
  if (aiq_final >= 4.6 && l4lSignals.length < 2) {
    regla4 = true;
    aiq_final = 4.5;
  }

  aiq_final = Math.round(aiq_final * 100) / 100;

  // Clasificación
  let nivel, nombre_nivel;
  if (aiq_final < 2.0)      { nivel = "L1";   nombre_nivel = "Novato"; }
  else if (aiq_final < 3.0) { nivel = "L2";   nombre_nivel = "Experimentador"; }
  else if (aiq_final < 4.0) { nivel = "L3";   nombre_nivel = "Practicante"; }
  else if (aiq_final <= 4.5){ nivel = "L4-T";  nombre_nivel = "Amplificador Técnico"; }
  else                       { nivel = "L4-L"; nombre_nivel = "Amplificador Estratégico"; }

  // Pausas de entrega
  let pausa = false, motivo_pausa = null;
  if (regla1) { pausa = true; motivo_pausa = "regla1_activa: B2=L1 — riesgo de seguridad crítico"; }
  else if (flags.includes("perfil_desequilibrado") && aiq_final >= 4.0) { pausa = true; motivo_pausa = "perfil_desequilibrado + AIQ ≥ 4.0"; }
  else if (flags.includes("datos_sensibles_laboratorio")) { pausa = true; motivo_pausa = "datos_sensibles_laboratorio en respuestas C"; }
  else if (flags.includes("b2_d6_riesgo_critico")) { pausa = true; motivo_pausa = "b2_d6_riesgo_critico — gobernanza"; }

  return {
    seccion_a: Math.round(A * 100) / 100,
    seccion_b: Math.round(B * 100) / 100,
    seccion_c: Math.round(C * 100) / 100,
    aiq_base: Math.round(aiq_base * 100) / 100,
    aiq_final,
    nivel,
    nombre_nivel,
    regla1_aplicada: regla1,
    regla2_aplicada: regla2,
    regla3_flag: regla3,
    regla4_aplicada: regla4,
    pausa,
    motivo_pausa
  };
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

  // ── Modo CONSOLIDAR: recibe todos los scores y calcula AIQ final ──────────
  if (body.mode === "consolidate") {
    const { scores, flags = [], perfil_con_automatizacion = false } = body;
    try {
      const result = consolidateAIQ(scores, [...flags], perfil_con_automatizacion);
      context.res = { status: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
    return;
  }

  // ── Modo EVALUAR: califica una pregunta individual ────────────────────────
  const { questionId, answer, context: evalContext = {} } = body;

  if (!questionId || answer === undefined || answer === null) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Faltan questionId o answer" }) };
    return;
  }

  const answerText = typeof answer === "string" ? answer : answer?.text || answer?.value || JSON.stringify(answer);
  if (!answerText || answerText.trim().length < 3) {
    context.res = { status: 200, headers, body: JSON.stringify({ score: 1, level: "L1", reasoning: "Respuesta vacía o muy corta", flags: [], senales: [] }) };
    return;
  }

  const apiKey    = process.env.AZURE_OPENAI_API_KEY;
  const endpoint  = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  if (!apiKey || !endpoint || !deployment) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Variables Azure OpenAI no configuradas" }) };
    return;
  }

  try {
    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion });
    const userPrompt = buildPrompt(questionId, answer, evalContext);

    const completion = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userPrompt }
      ],
      max_completion_tokens: 400
    });

    const raw = completion.choices[0]?.message?.content || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const score = Math.max(1, Math.min(5, Number(parsed.puntaje) || 1));
    const levelMap = { "L1": "L1", "L2": "L2", "L3": "L3", "L4-T": "L4T", "L4-L": "L4L" };

    context.res = {
      status: 200, headers,
      body: JSON.stringify({
        score,
        level:     levelMap[parsed.nivel] || parsed.nivel || "L1",
        nivel:     parsed.nivel || "L1",
        reasoning: parsed.razonamiento || "",
        flags:     parsed.flags || [],
        senales:   parsed.senales_para_cruce || []
      })
    };

  } catch (err) {
    context.log.error("grade error:", err.message);
    // Fallback por longitud si falla la IA
    const len = answerText.length;
    const fallback = len < 50 ? 2 : len < 200 ? 3 : 4;
    context.res = {
      status: 200, headers,
      body: JSON.stringify({ score: fallback, level: "L3", nivel: "L3", reasoning: "Calificación automática (fallback)", flags: [], senales: [] })
    };
  }
};
