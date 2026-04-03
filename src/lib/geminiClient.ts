/**
 * gradeClient.ts
 *
 * Llama al endpoint /api/grade (Azure Function).
 * La AZURE_OPENAI_API_KEY vive en Azure — nunca llega al browser.
 *
 * El nuevo grade/index.js recibe { questionId, answer, context? }
 * y aplica el framework AIQ completo (prompts específicos por pregunta,
 * RCTFR para C1-C3, flags por pregunta).
 */

export interface GradeRequest {
  questionId: string;
  answer: any;                          // string | { value, text, selected, score, ... }
  context?: Record<string, any>;        // perfil_con_automatizacion, etc.
}

export interface GradeResult {
  score: number;      // 1–5
  level: string;      // L1, L2, L3, L4-T, L4-L (o L4T/L4L para compatibilidad)
  nivel?: string;
  reasoning: string;
  flags: string[];
  senales: string[];
}

/**
 * Califica una respuesta con el framework AIQ vía Azure Function.
 * Tiene fallback local si el endpoint no responde.
 */
export async function gradeAnswer(req: GradeRequest): Promise<GradeResult> {
  try {
    const response = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: req.questionId,
        answer:     req.answer,
        context:    req.context || {}
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return {
      score:     data.score    ?? 1,
      level:     data.level    ?? "L1",
      nivel:     data.nivel    ?? data.level ?? "L1",
      reasoning: data.reasoning ?? "",
      flags:     data.flags    ?? [],
      senales:   data.senales  ?? []
    };

  } catch (err) {
    console.warn("gradeAnswer fallback local:", err);
    return localFallback(req.answer);
  }
}

/**
 * Llama al modo consolidate del grade API.
 * Recibe todos los scores individuales y devuelve el AIQ final
 * con fórmula, reglas 1-4 y clasificación correctas.
 */
export async function consolidateAIQ(payload: {
  scores: Record<string, number>;
  flags: string[];
  perfil_con_automatizacion: boolean;
}): Promise<{
  seccion_a: number; seccion_b: number; seccion_c: number;
  aiq_base: number; aiq_final: number;
  nivel: string; nombre_nivel: string;
  regla1_aplicada: boolean; regla2_aplicada: boolean;
  regla3_flag: boolean; regla4_aplicada: boolean;
  pausa: boolean; motivo_pausa: string | null;
} | null> {
  try {
    const res = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "consolidate", ...payload })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("consolidateAIQ error:", err);
    return null;
  }
}

function localFallback(answer: any): GradeResult {
  const text = typeof answer === "string" ? answer
    : answer?.text || answer?.value?.toString() || "";
  const len = (typeof text === "string" ? text : "").trim().length;
  if (len < 20)  return { score: 1, level: "L1", reasoning: "Respuesta muy corta", flags: [], senales: [] };
  if (len < 80)  return { score: 2, level: "L2", reasoning: "Respuesta básica",    flags: [], senales: [] };
  if (len < 200) return { score: 3, level: "L3", reasoning: "Respuesta moderada",  flags: [], senales: [] };
  return          { score: 4, level: "L4T", reasoning: "Respuesta detallada",      flags: [], senales: [] };
}
