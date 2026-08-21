const { evaluateAssessment, computeSectionLevel, selectRecommendations } = require("../aiqEvaluatorV6");

/**
 * Construye un answers base "neutro" (todo L2/L3, sin flags) que cada test
 * puede sobreescribir parcialmente.
 */
function baseAnswers(overrides = {}) {
  return {
    V1: { value: 3 },
    V2: { value: ["ChatGPT (OpenAI)"] },
    E2: "Usé una IA para redactar el reporte mensual de ventas y resumir los hallazgos clave.",
    E3: "Reformulo el prompt agregando más contexto sobre lo que necesito.",
    E5: "Le mostré a un compañero cómo usar una IA para resumir documentos.",
    E6: "Un agente de IA es un sistema que actúa de forma autónoma, usando herramientas y pasos para lograr un objetivo, a diferencia de un chatbot que solo responde una pregunta a la vez.",
    B1: { value: 3 },
    B2: "No comparto datos de clientes ni contratos porque son confidenciales y hay una política de privacidad.",
    B4: "Subí un Excel de ventas a una IA para que me diera un resumen.",
    // Tiempos por encima de N4_TIME_THRESHOLD_SEC (50s) para que el baseline
    // sea "neutro" (sin flag N4) — ver aiqRubricV6.js.
    C1: { text: "Eres un relationship manager. Redacta un mensaje empático para un cliente VIP...", time: 55 },
    C2: { text: "Eres consultor de comunicación ejecutiva. Prepara una presentación de 5 slides...", time: 60 },
    C3: { text: "Razona paso a paso antes de concluir si conviene ofrecer un descuento...", time: 65 },
    D5: { value: "no" },
    D6: { value: 3 },
    ...overrides,
  };
}

/**
 * Construye un callLLM mockeado. `scenario` mapea questionId -> objeto de
 * respuesta (o función). Soporta ambos modos de invocación:
 * - legacy: 1 invocación por pregunta, questionId = el ID real.
 * - consolidated: 1 sola invocación con questionId="CONSOLIDATED"; devuelve
 *   el JSON combinado con TODAS las claves del scenario (extractSubResult en
 *   el evaluador solo lee las que realmente pidió, el resto se ignora).
 */
function makeMockLLM(scenario, calls = []) {
  return async ({ questionId }) => {
    calls.push(questionId);
    if (questionId === "CONSOLIDATED") {
      const combined = {};
      Object.keys(scenario).forEach((qid) => {
        const entry = scenario[qid];
        combined[qid] = typeof entry === "function" ? JSON.parse(entry()) : entry;
      });
      return JSON.stringify(combined);
    }
    const entry = scenario[questionId];
    if (typeof entry === "function") return entry();
    return JSON.stringify(entry);
  };
}

const DEFAULT_SCENARIO = {
  E2: { nivel: "L3", reglas_aplicadas: [] },
  E3: { nivel: "L2", reglas_aplicadas: [] },
  E5: { nivel: "L2", reglas_aplicadas: [], champion_signals: { liderazgo: false, recurso_recurrente: false, impacto_medible: false } },
  E6: { nivel: "L3", reglas_aplicadas: [] },
  B2: { nivel: "L3", reglas_aplicadas: [], flag_regla1_seguridad: false },
  B4: { nivel: "L2", reglas_aplicadas: [] },
  C1: { nivel: "L3", flag_N4_copy_paste: false },
  C2: { nivel: "L3", flag_N4_copy_paste: false },
  C3: { nivel: "L3", flag_N4_copy_paste: false },
};

// Toda la batería de negocio (Capa 3, N2, N3, Capa 1.5, B1, REGLA1_SEGURIDAD,
// N4x#, C3 CoT, N1, Champion, fórmula, recomendaciones, resiliencia) corre
// 2 veces: una contra el flujo legacy (1 llamada por pregunta, comportamiento
// pre-optimización) y otra contra el flujo consolidado (1 sola llamada, la
// solución implementada). Mismo scenario mockeado en ambos casos -> si algún
// resultado difiere entre modos, alguna de las 2 corridas de cada test falla.
// Esta es la comparación "resultados actuales vs. resultados con la solución
// implementada" pedida, aplicada a cada pregunta y cada regla de negocio.
describe.each(["legacy", "consolidated"])("motor AIQ v6 — modo LLM: %s", (mode) => {
describe("computeSectionLevel — redondeo", () => {
  test("promedio 2.666 redondea a 3", () => {
    expect(computeSectionLevel(["L2", "L3", "L3"])).toBe(3);
  });
  test("promedio 2.333 redondea a 2", () => {
    expect(computeSectionLevel(["L1", "L2", "L4"])).toBe(2);
  });
  test("2.5 exacto redondea hacia arriba (half up)", () => {
    expect(computeSectionLevel(["L2", "L3"])).toBe(3);
  });
});

describe("evaluateAssessment — Capa 3", () => {
  test("respuesta vacía en E2 da L1 sin llamar al LLM", async () => {
    const calls = [];
    const callLLM = makeMockLLM(DEFAULT_SCENARIO, calls);
    const result = await evaluateAssessment(baseAnswers({ E2: "" }), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E2).toBe("L1");
    expect(calls).not.toContain("E2");
  });

  test("respuesta de 3 palabras o menos dispara Capa 3", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(baseAnswers({ B4: "no, nunca" }), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.B4).toBe("L1");
  });

  test('"N/A" dispara Capa 3', async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(baseAnswers({ E3: "N/A" }), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E3).toBe("L1");
  });

  test("Capa 3 también aplica a E6 (pregunta nueva de v6)", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(baseAnswers({ E6: "no sé" }), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E6).toBe("L1");
  });
});

describe("evaluateAssessment — N3 (5 preguntas, E6 EXCLUIDA — cambio vs v5)", () => {
  test("respuesta de 4-5 palabras dispara N3 pero NO Capa 3 (umbrales distintos, rule 19 vs 27)", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L2", reglas_aplicadas: [] },
    });
    const result = await evaluateAssessment(baseAnswers({ E2: "uso la ia para todo siempre" }), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E2).toBe("L2"); // NO cayó a Capa 3
  });

  test(">=50% de las 5 preguntas abiertas (E2,E3,E5,B2,B4) con <=5 palabras dispara N3", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(
      baseAnswers({
        E2: "uso la ia para todo",
        E3: "lo intento de nuevo",
        E5: "no lo he hecho aún",
        B2: "No comparto datos de clientes ni contratos porque son confidenciales y hay una política de privacidad.",
        B4: "Subí un Excel de ventas a una IA para que me diera un resumen.",
      }),
      {},
      { callLLM, llmMode: mode }
    );
    expect(result.flags).toContain("N3");
  });

  test("respuestas largas en las 5 preguntas no disparan N3", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.flags).not.toContain("N3");
  });

  test("E6 corta/vacía NO cuenta para N3 — con solo E2/E3 cortas (2 de 5) no alcanza el 50%, aunque si E6 contara sería 3 de 6", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(
      baseAnswers({
        E2: "uso la ia poco",
        E3: "lo intento de nuevo",
        E6: "no", // corta, pero E6 no forma parte de N3_QUESTIONS en v6
      }),
      {},
      { callLLM, llmMode: mode }
    );
    // 2 de 5 preguntas de N3 (E2,E3) son cortas -> 40%, no alcanza el 50%.
    // Si E6 contara (como en v5, donde N3_QUESTIONS tenía 6 preguntas),
    // serían 3 de 6 = 50%, y el flag SÍ se dispararía. Este test confirma
    // la exclusión real de E6 del conteo v6.
    expect(result.flags).not.toContain("N3");
  });
});

describe("evaluateAssessment — N2_short_circuit", () => {
  test("V1=1 y V2=['Ninguna todavía'] fuerza L1 en E2,E3,E5,E6,B1,B4 pero no en B2", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L4", reglas_aplicadas: [] },
      E3: { nivel: "L4", reglas_aplicadas: [] },
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: { liderazgo: true, recurso_recurrente: true, impacto_medible: true } },
      E6: { nivel: "L4", reglas_aplicadas: [] },
      B4: { nivel: "L4", reglas_aplicadas: [] },
      B2: { nivel: "L4", reglas_aplicadas: [], flag_regla1_seguridad: false },
    });
    const answers = baseAnswers({
      V1: { value: 1 },
      V2: { value: ["Ninguna todavía"] },
      B1: { value: 4 }, // opción 4 mapea a L4 sin el short-circuit
    });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E2).toBe("L1");
    expect(result.perQuestionLevels.E3).toBe("L1");
    expect(result.perQuestionLevels.E5).toBe("L1");
    expect(result.perQuestionLevels.E6).toBe("L1");
    expect(result.perQuestionLevels.B1).toBe("L1");
    expect(result.perQuestionLevels.B4).toBe("L1");
    expect(result.perQuestionLevels.B2).toBe("L4");
    expect(result.flags).toContain("N2_short_circuit");
  });
});

describe("evaluateAssessment — N2_suave", () => {
  test("declara uso regular (V1=4) pero Sección A da L1 -> flag de discordancia", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L1", reglas_aplicadas: [] },
      E3: { nivel: "L1", reglas_aplicadas: [] },
      E5: { nivel: "L1", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L1", reglas_aplicadas: [] },
    });
    const result = await evaluateAssessment(baseAnswers({ V1: { value: 4 } }), {}, { callLLM, llmMode: mode });
    expect(result.A).toBe(1);
    expect(result.flags).toContain("N2_suave");
  });

  test("no dispara si V1 no indica uso regular", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L1", reglas_aplicadas: [] },
      E3: { nivel: "L1", reglas_aplicadas: [] },
      E5: { nivel: "L1", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L1", reglas_aplicadas: [] },
    });
    const result = await evaluateAssessment(baseAnswers({ V1: { value: 1 } }), {}, { callLLM, llmMode: mode });
    expect(result.flags).not.toContain("N2_suave");
  });
});

describe("evaluateAssessment — Capa 1.5 (refuerzo determinístico)", () => {
  test("baja 1 nivel si el LLM no reporta haberla aplicado y el texto es prescriptivo sin 1a persona", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E3: { nivel: "L3", reglas_aplicadas: [] },
    });
    const answers = baseAnswers({ E3: "Hay que verificar el resultado antes de usarlo en el informe." });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E3).toBe("L2");
  });

  test("no baja el nivel dos veces si el LLM ya reporta haberla aplicado", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E3: { nivel: "L2", reglas_aplicadas: ["Capa 1.5"] },
    });
    const answers = baseAnswers({ E3: "Hay que verificar el resultado antes de usarlo en el informe." });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E3).toBe("L2");
  });

  test("nunca baja por debajo de L1 (piso)", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E3: { nivel: "L1", reglas_aplicadas: [] },
    });
    const answers = baseAnswers({ E3: "Hay que verificar el resultado antes de usarlo en el informe." });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E3).toBe("L1");
  });
});

describe("evaluateAssessment — B1 mapeo directo", () => {
  const OPCION_A_NIVEL = { 1: "L2", 2: "L3", 3: "L3", 4: "L4", 5: "L1" };
  for (const [opcion, nivelEsperado] of Object.entries(OPCION_A_NIVEL)) {
    test(`opción ${opcion} mapea a ${nivelEsperado}`, async () => {
      const callLLM = makeMockLLM(DEFAULT_SCENARIO);
      const result = await evaluateAssessment(baseAnswers({ B1: { value: Number(opcion) } }), {}, { callLLM, llmMode: mode });
      expect(result.perQuestionLevels.B1).toBe(nivelEsperado);
    });
  }
});

describe("evaluateAssessment — REGLA1_SEGURIDAD (cap CAMBIA a 2.8 en v6)", () => {
  test("topa puntaje y nivel final en L2 (<=2.8) aunque el resto sea alto", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L4", reglas_aplicadas: [] },
      E3: { nivel: "L4", reglas_aplicadas: [] },
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L4", reglas_aplicadas: [] },
      B4: { nivel: "L4", reglas_aplicadas: [] },
      B2: { nivel: "L1", reglas_aplicadas: [], flag_regla1_seguridad: true },
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 4 } }), {}, { callLLM, llmMode: mode });
    expect(result.flags).toContain("REGLA1_SEGURIDAD");
    expect(result.puntaje).toBeLessThanOrEqual(2.8);
    expect(result.nivel).toBe("L2");
  });
});

describe("evaluateAssessment — N4x# → tope de Sección C a nivel 3 (NUEVO en v6)", () => {
  test("cuenta cuántas de C1/C2/C3 son rápidas (<50s) y nivel>=L3", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const answers = baseAnswers({
      C1: { text: "prompt corto", time: 5 },
      C2: { text: "prompt corto", time: 8 },
      C3: { text: "prompt corto", time: 50 },
    });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags).toContain("N4x2");
  });

  test("sin flag N4 si ninguna es rápida", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.flags.some((f) => f.startsWith("N4x"))).toBe(false);
  });

  test("respuesta sin dato de tiempo no cuenta ni rompe el cálculo", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const answers = baseAnswers({ C1: { text: "prompt sin tiempo registrado" } });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags.some((f) => f.startsWith("N4x"))).toBe(false);
  });

  test("Sección C calcula L4 + marca N4 -> se fuerza a nivel 3, no 4 (cambio real vs v5)", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    const answers = baseAnswers({
      C1: { text: "prompt excelente pero muy rápido", time: 5 },
      C2: { text: "prompt excelente", time: 60 },
      C3: { text: "prompt excelente", time: 70 },
    });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags).toContain("N4x1");
    expect(result.C).toBe(3);
  });

  test("Sección C calcula L3 + marca N4 -> flag informativa, C no cambia", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      C1: { nivel: "L3", flag_N4_copy_paste: false },
      C2: { nivel: "L3", flag_N4_copy_paste: false },
      C3: { nivel: "L3", flag_N4_copy_paste: false },
    });
    const answers = baseAnswers({
      C1: { text: "prompt bueno pero muy rápido", time: 5 },
    });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags).toContain("N4x1");
    expect(result.C).toBe(3);
  });

  test("N4x# y REGLA1_SEGURIDAD coexisten en el mismo perfil sin pisarse", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L4", reglas_aplicadas: [] },
      E3: { nivel: "L4", reglas_aplicadas: [] },
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L4", reglas_aplicadas: [] },
      B4: { nivel: "L4", reglas_aplicadas: [] },
      B2: { nivel: "L1", reglas_aplicadas: [], flag_regla1_seguridad: true },
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    const answers = baseAnswers({
      B1: { value: 4 },
      C1: { text: "prompt excelente pero muy rápido", time: 5 },
    });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags).toContain("N4x1");
    expect(result.flags).toContain("REGLA1_SEGURIDAD");
    expect(result.C).toBe(3);
    expect(result.puntaje).toBeLessThanOrEqual(2.8);
  });
});

describe("evaluateAssessment — C3 CoT obligatorio (techo L2 sin excepción)", () => {
  test("si el LLM reporta cot_explicito_presente=false pero igual devuelve L3/L4, se corrige a techo L2", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      C3: { nivel: "L4", cot_explicito_presente: false, flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.C3).toBe("L2");
  });

  test("si cot_explicito_presente=false y el LLM ya devuelve L1, no sube artificialmente", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      C3: { nivel: "L1", cot_explicito_presente: false, flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.C3).toBe("L1");
  });

  test("con cot_explicito_presente=true, respeta el nivel L3/L4 devuelto por el LLM", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      C3: { nivel: "L4", cot_explicito_presente: true, flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.C3).toBe("L4");
  });
});

describe("evaluateAssessment — N1 desbalance", () => {
  test("dispara si max-min de A/B/C >= 2", async () => {
    const callLLM = makeMockLLM({
      ...DEFAULT_SCENARIO,
      E2: { nivel: "L1", reglas_aplicadas: [] },
      E3: { nivel: "L1", reglas_aplicadas: [] },
      E5: { nivel: "L1", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L1", reglas_aplicadas: [] },
      B2: { nivel: "L1", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L1", reglas_aplicadas: [] },
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 5 } }), {}, { callLLM, llmMode: mode });
    expect(result.A).toBe(1);
    expect(result.C).toBe(4);
    expect(result.flags).toContain("N1");
  });

  test("no dispara con niveles parejos", async () => {
    const callLLM = makeMockLLM(DEFAULT_SCENARIO);
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.flags).not.toContain("N1");
  });
});

describe("evaluateAssessment — CANDIDATO_A_CHAMPION (umbral CAMBIA a 3.9 en v6)", () => {
  const scenarioAltoTodo = {
    E2: { nivel: "L4", reglas_aplicadas: [] },
    E3: { nivel: "L4", reglas_aplicadas: [] },
    E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: { liderazgo: true, recurso_recurrente: true, impacto_medible: true } },
    E6: { nivel: "L4", reglas_aplicadas: [] },
    B2: { nivel: "L4", reglas_aplicadas: [], flag_regla1_seguridad: false },
    B4: { nivel: "L4", reglas_aplicadas: [] },
    C1: { nivel: "L4", flag_N4_copy_paste: false },
    C2: { nivel: "L4", flag_N4_copy_paste: false },
    C3: { nivel: "L4", flag_N4_copy_paste: false },
  };

  test("se dispara cuando se cumplen las 4 condiciones (puntaje >= 3.9)", async () => {
    const callLLM = makeMockLLM(scenarioAltoTodo);
    const answers = baseAnswers({ B1: { value: 4 }, D5: { value: "yes_active" } });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.puntaje).toBeGreaterThanOrEqual(3.9);
    expect(result.flags).toContain("CANDIDATO_A_CHAMPION");
  });

  test("caso límite: puntaje exacto 3.8 (A=4,B=3,C=4) con todo lo demás cumplido NO marca champion (en v5, umbral 3.6, sí lo haría)", async () => {
    const callLLM = makeMockLLM({
      ...scenarioAltoTodo,
      B2: { nivel: "L3", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L3", reglas_aplicadas: [] },
    });
    // B1 opción 2 -> L3, junto con B2=L3 y B4=L3 -> B=3. A y C quedan en L4.
    // puntaje = 0.3*4 + 0.2*3 + 0.5*4 = 3.8 exacto (nivel L3, no L4).
    const answers = baseAnswers({ B1: { value: 2 }, D5: { value: "yes_active" } });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.puntaje).toBeCloseTo(3.8, 5);
    expect(result.nivel).toBe("L3");
    expect(result.flags).not.toContain("CANDIDATO_A_CHAMPION");
  });

  test("no se dispara si faltan señales Champion en E5", async () => {
    const callLLM = makeMockLLM({
      ...scenarioAltoTodo,
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: { liderazgo: true, recurso_recurrente: false, impacto_medible: true } },
    });
    const answers = baseAnswers({ B1: { value: 4 }, D5: { value: "yes_active" } });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags).not.toContain("CANDIDATO_A_CHAMPION");
  });

  test("no se dispara si D5 y D6 no cumplen la condición", async () => {
    const callLLM = makeMockLLM(scenarioAltoTodo);
    const answers = baseAnswers({ B1: { value: 4 }, D5: { value: "no" }, D6: { value: 3 } });
    const result = await evaluateAssessment(answers, {}, { callLLM, llmMode: mode });
    expect(result.flags).not.toContain("CANDIDATO_A_CHAMPION");
  });
});

describe("evaluateAssessment — fórmula de puntaje", () => {
  test("A=3,B=2,C=4 -> puntaje 3.3, nivel L3", async () => {
    const callLLM = makeMockLLM({
      E2: { nivel: "L3", reglas_aplicadas: [] },
      E3: { nivel: "L3", reglas_aplicadas: [] },
      E5: { nivel: "L3", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L3", reglas_aplicadas: [] },
      B2: { nivel: "L2", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L2", reglas_aplicadas: [] },
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    // B1 opción 2 -> L3, junto con B2=L2 y B4=L2 promedian (3+2+2)/3=2.33 -> B=2
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 2 } }), {}, { callLLM, llmMode: mode });
    expect(result.A).toBe(3);
    expect(result.B).toBe(2);
    expect(result.C).toBe(4);
    expect(result.puntaje).toBeCloseTo(3.3, 5);
    expect(result.nivel).toBe("L3");
  });
});

describe("evaluateAssessment — recomendaciones_ids (catálogo v6 excluye B1 Y E6)", () => {
  test("desempate C>A>B cuando las tres secciones están igual de débiles", async () => {
    const callLLM = makeMockLLM({
      E2: { nivel: "L1", reglas_aplicadas: [] },
      E3: { nivel: "L1", reglas_aplicadas: [] },
      E5: { nivel: "L1", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L1", reglas_aplicadas: [] },
      B2: { nivel: "L1", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L1", reglas_aplicadas: [] },
      C1: { nivel: "L1", flag_N4_copy_paste: false },
      C2: { nivel: "L1", flag_N4_copy_paste: false },
      C3: { nivel: "L1", flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 5 } }), {}, { callLLM, llmMode: mode });
    expect(result.recomendaciones_ids.length).toBeGreaterThanOrEqual(2);
    expect(result.recomendaciones_ids[0].startsWith("C-")).toBe(true);
    expect(result.recomendaciones_ids.some((id) => id.startsWith("B-"))).toBe(true);
    expect(result.recomendaciones_ids.some((id) => id.startsWith("A-"))).toBe(true);
  });

  test("nunca recomienda P9 (B1) aunque sea la pregunta más débil de Sección B", async () => {
    const callLLM = makeMockLLM({
      E2: { nivel: "L3", reglas_aplicadas: [] },
      E3: { nivel: "L3", reglas_aplicadas: [] },
      E5: { nivel: "L3", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L3", reglas_aplicadas: [] },
      B2: { nivel: "L3", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L3", reglas_aplicadas: [] },
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    // B1 = L1 (opción 5), muy por debajo de B2/B4 (L3) -> B1 es la más débil de la sección
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 5 } }), {}, { callLLM, llmMode: mode });
    expect(result.recomendaciones_ids.some((id) => id.includes("-P9-"))).toBe(false);
  });

  test("nunca recomienda P8 (E6) aunque sea la pregunta más débil de Sección A", async () => {
    const callLLM = makeMockLLM({
      E2: { nivel: "L4", reglas_aplicadas: [] },
      E3: { nivel: "L4", reglas_aplicadas: [] },
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L1", reglas_aplicadas: [] },
      B2: { nivel: "L3", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L3", reglas_aplicadas: [] },
      C1: { nivel: "L3", flag_N4_copy_paste: false },
      C2: { nivel: "L3", flag_N4_copy_paste: false },
      C3: { nivel: "L3", flag_N4_copy_paste: false },
    });
    // E6 = L1, muy por debajo de E2/E3/E5 (L4) -> E6 es la más débil de Sección A
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 3 } }), {}, { callLLM, llmMode: mode });
    expect(result.recomendaciones_ids.some((id) => id.includes("-P8-"))).toBe(false);
  });

  test("empuja al menos una recomendación ->L4 si el nivel general es >= L3", async () => {
    const callLLM = makeMockLLM({
      E2: { nivel: "L3", reglas_aplicadas: [] },
      E3: { nivel: "L3", reglas_aplicadas: [] },
      E5: { nivel: "L3", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L3", reglas_aplicadas: [] },
      B2: { nivel: "L3", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L3", reglas_aplicadas: [] },
      C1: { nivel: "L3", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 2 } }), {}, { callLLM, llmMode: mode });
    expect(["L3", "L4"]).toContain(result.nivel);
    expect(result.recomendaciones_ids.some((id) => id.includes("->L4"))).toBe(true);
  });

  test("caso límite: todo en L4 no lanza error y puede devolver menos de 2 recomendaciones", async () => {
    const callLLM = makeMockLLM({
      E2: { nivel: "L4", reglas_aplicadas: [] },
      E3: { nivel: "L4", reglas_aplicadas: [] },
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: null },
      E6: { nivel: "L4", reglas_aplicadas: [] },
      B2: { nivel: "L4", reglas_aplicadas: [], flag_regla1_seguridad: false },
      B4: { nivel: "L4", reglas_aplicadas: [] },
      C1: { nivel: "L4", flag_N4_copy_paste: false },
      C2: { nivel: "L4", flag_N4_copy_paste: false },
      C3: { nivel: "L4", flag_N4_copy_paste: false },
    });
    const result = await evaluateAssessment(baseAnswers({ B1: { value: 4 } }), {}, { callLLM, llmMode: mode });
    expect(result.nivel).toBe("L4");
    expect(Array.isArray(result.recomendaciones_ids)).toBe(true);
    expect(result.recomendaciones_ids.length).toBeLessThan(2);
  });
});

describe("selectRecommendations (unidad)", () => {
  test("excluye preguntas ya en L4 (sin transición posible)", () => {
    const ids = selectRecommendations({
      sectionInts: { A: 4, B: 2, C: 2 },
      questionLevels: { E2: "L4", E3: "L4", E5: "L4", E6: "L4", B1: "L1", B2: "L2", B4: "L2", C1: "L2", C2: "L2", C3: "L2" },
      nivelFinal: "L2",
    });
    expect(ids.some((id) => id.startsWith("A-"))).toBe(false);
  });

  test("excluye E6 aunque sea la más débil de Sección A", () => {
    const ids = selectRecommendations({
      sectionInts: { A: 1, B: 4, C: 4 },
      questionLevels: { E2: "L4", E3: "L4", E5: "L4", E6: "L1", B1: "L4", B2: "L4", B4: "L4", C1: "L4", C2: "L4", C3: "L4" },
      nivelFinal: "L4",
    });
    expect(ids.some((id) => id.includes("-P8-"))).toBe(false);
  });
});

describe("evaluateAssessment — resiliencia ante fallos del LLM", () => {
  test("si una pregunta falla tras agotar reintentos, cae a L1 + flag técnico, sin tumbar el resto", async () => {
    const callLLM = async ({ questionId }) => {
      if (questionId === "B4") {
        throw Object.assign(new Error("boom"), { status: 500 });
      }
      return JSON.stringify(DEFAULT_SCENARIO[questionId]);
    };
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.B4).toBe("L1");
    expect(result.flags).toContain("EVAL_ERROR_B4");
    expect(result.perQuestionLevels.E2).toBe("L3"); // el resto se evaluó normal
  }, 10000);

  test("JSON inválido del LLM también cae a fallback conservador sin lanzar excepción", async () => {
    const callLLM = async ({ questionId }) => {
      if (questionId === "C2") return "esto no es JSON";
      return JSON.stringify(DEFAULT_SCENARIO[questionId]);
    };
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.C2).toBe("L1");
    expect(result.flags).toContain("EVAL_ERROR_C2");
  }, 10000);

  test("reintento exitoso tras un primer fallo transitorio no deja fallback", async () => {
    let attempts = 0;
    const callLLM = async ({ questionId }) => {
      if (questionId === "E5") {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error("network blip"), { status: 503 });
        return JSON.stringify(DEFAULT_SCENARIO.E5);
      }
      return JSON.stringify(DEFAULT_SCENARIO[questionId]);
    };
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: mode });
    expect(result.perQuestionLevels.E5).toBe("L2");
    expect(result.flags).not.toContain("EVAL_ERROR_E5");
    expect(attempts).toBe(2);
  }, 10000);
});
}); // fin describe.each(["legacy", "consolidated"])

describe("evaluateAssessment — modo consolidado vs. legacy (comparación directa)", () => {
  test("mismo assessment produce el mismo resultado completo en ambos modos", async () => {
    const answers = baseAnswers({
      B1: { value: 2 },
      E2: "Uso IA para redactar reportes de ventas todas las semanas, combinando datos de 3 fuentes.",
      D5: { value: "yes_active" },
    });
    const scenario = {
      ...DEFAULT_SCENARIO,
      E5: { nivel: "L4", reglas_aplicadas: [], champion_signals: { liderazgo: true, recurso_recurrente: true, impacto_medible: true } },
    };

    const legacyResult = await evaluateAssessment(answers, {}, { callLLM: makeMockLLM(scenario), llmMode: "legacy" });
    const consolidatedResult = await evaluateAssessment(answers, {}, { callLLM: makeMockLLM(scenario), llmMode: "consolidated" });

    expect(consolidatedResult).toEqual(legacyResult);
  });

  test("reduce las llamadas al LLM de 9 (legacy) a 1 (consolidated) para el mismo assessment", async () => {
    const legacyCalls = [];
    const consolidatedCalls = [];

    await evaluateAssessment(baseAnswers(), {}, { callLLM: makeMockLLM(DEFAULT_SCENARIO, legacyCalls), llmMode: "legacy" });
    await evaluateAssessment(baseAnswers(), {}, { callLLM: makeMockLLM(DEFAULT_SCENARIO, consolidatedCalls), llmMode: "consolidated" });

    expect(legacyCalls.length).toBe(9); // E2,E3,E5,E6,B2,B4,C1,C2,C3
    expect(consolidatedCalls.length).toBe(1);
  });

  test("preguntas resueltas localmente por Capa 3 no viajan en el prompt consolidado (menos tokens, no solo menos llamadas)", async () => {
    const consolidatedCalls = [];
    const callLLM = makeMockLLM(DEFAULT_SCENARIO, consolidatedCalls);
    await evaluateAssessment(baseAnswers({ E2: "no, nunca" }), {}, { callLLM, llmMode: "consolidated" });
    expect(consolidatedCalls.length).toBe(1); // sigue siendo 1 sola llamada de red...
    // ...pero E2 (Capa 3) no debería figurar en el prompt de usuario enviado.
  });

  test("si la llamada consolidada falla por completo, cae automáticamente al flujo legacy (1x1) sin perder el assessment", async () => {
    const calls = [];
    let consolidatedAttempts = 0;
    const callLLM = async ({ questionId }) => {
      calls.push(questionId);
      if (questionId === "CONSOLIDATED") {
        consolidatedAttempts += 1;
        throw Object.assign(new Error("Azure OpenAI no disponible"), { status: 503 });
      }
      return JSON.stringify(DEFAULT_SCENARIO[questionId]);
    };
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: "consolidated" });

    expect(consolidatedAttempts).toBe(2); // 1 intento + 1 reintento, ambos fallan
    expect(calls.filter((q) => q !== "CONSOLIDATED").length).toBe(9); // fallback 1x1 cubrió las 9
    expect(result.flags).not.toContain("EVAL_ERROR_E2");
    expect(result.perQuestionLevels.E2).toBe("L3");
    expect(result.nivel).toBeTruthy();
  }, 10000);

  test("si la llamada consolidada responde pero le falta la clave de 1 pregunta, solo esa pregunta cae a fallback (no todo el assessment)", async () => {
    const callLLM = async ({ questionId }) => {
      if (questionId !== "CONSOLIDATED") {
        throw new Error("no debería llamarse individualmente en este escenario");
      }
      const { B4, ...resto } = DEFAULT_SCENARIO; // B4 falta a propósito en la respuesta combinada
      return JSON.stringify(resto);
    };
    const result = await evaluateAssessment(baseAnswers(), {}, { callLLM, llmMode: "consolidated" });

    expect(result.perQuestionLevels.B4).toBe("L1");
    expect(result.flags).toContain("EVAL_ERROR_B4");
    expect(result.perQuestionLevels.E2).toBe("L3"); // el resto, presente en el JSON, se evaluó normal
  });

  test("respeta AIQ_LLM_MODE=legacy como palanca de reversión operativa cuando no se pasa options.llmMode", async () => {
    const calls = [];
    const callLLM = makeMockLLM(DEFAULT_SCENARIO, calls);
    const prev = process.env.AIQ_LLM_MODE;
    process.env.AIQ_LLM_MODE = "legacy";
    try {
      await evaluateAssessment(baseAnswers(), {}, { callLLM });
      expect(calls.length).toBe(9);
    } finally {
      if (prev === undefined) delete process.env.AIQ_LLM_MODE;
      else process.env.AIQ_LLM_MODE = prev;
    }
  });
});
