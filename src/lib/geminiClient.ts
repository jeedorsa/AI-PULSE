/**
 * gradeClient.ts
 *
 * Llama al endpoint /api/grade (Azure Function).
 * La AZURE_OPENAI_API_KEY vive en Azure — nunca llega al browser.
 */

export interface GradeRequest {
  questionId: string;
  questionText: string;
  scoringSignals: Record<string, string>;
  answer: string | { text: string; [key: string]: any };
  concept?: string;
}

export interface GradeResult {
  score: number;      // 1–5
  level: string;      // L1, L2, L3, L4T, L4L
  reasoning: string;
}

/**
 * Califica una respuesta abierta con Azure OpenAI vía Azure Function.
 * Tiene fallback local si el endpoint no responde.
 */
export async function gradeAnswer(req: GradeRequest): Promise<GradeResult> {
  try {
    const response = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();

  } catch (err) {
    console.warn("gradeAnswer fallback local:", err);
    return localFallback(req.answer);
  }
}

function localFallback(answer: GradeRequest["answer"]): GradeResult {
  const text = typeof answer === "string" ? answer : answer?.text || "";
  const len = text.trim().length;
  if (len < 20)  return { score: 1, level: "L1", reasoning: "Respuesta muy corta" };
  if (len < 80)  return { score: 2, level: "L2", reasoning: "Respuesta básica" };
  if (len < 200) return { score: 3, level: "L3", reasoning: "Respuesta moderada" };
  return { score: 4, level: "L4T", reasoning: "Respuesta detallada" };
}
