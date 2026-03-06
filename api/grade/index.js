/**
 * Azure Function: /api/grade
 * 
 * Recibe una respuesta abierta del usuario, la califica con Gemini,
 * y devuelve { score, level, reasoning }.
 * 
 * La GEMINI_API_KEY vive en Azure Application Settings — nunca en el browser.
 */

const { GoogleGenerativeAI } = require("@google/genai");

module.exports = async function (context, req) {

  // ── CORS ────────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    "https://ai-pulse.javiercruz.com",
    "http://localhost:3000",
    "http://localhost:5173",
  ];
  const origin = req.headers["origin"] || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Preflight
  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers: corsHeaders, body: "" };
    return;
  }

  if (req.method !== "POST") {
    context.res = { status: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
    return;
  }

  // ── Validar API Key ─────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    context.log.error("GEMINI_API_KEY no configurada en Azure Application Settings");
    context.res = { status: 500, headers: corsHeaders, body: JSON.stringify({ error: "Server configuration error" }) };
    return;
  }

  // ── Validar body ────────────────────────────────────────────────────────────
  const { questionId, questionText, scoringSignals, answer, concept } = req.body || {};

  if (!scoringSignals || !answer) {
    context.res = { status: 400, headers: corsHeaders, body: JSON.stringify({ error: "Faltan campos: scoringSignals, answer" }) };
    return;
  }

  const answerText = typeof answer === "string" ? answer : answer?.text || "";

  // Respuesta muy corta → no gastar tokens
  if (answerText.trim().length < 15) {
    context.res = {
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({ score: 1, level: "L1", reasoning: "Respuesta demasiado corta." }),
    };
    return;
  }

  // ── Llamada a Gemini ────────────────────────────────────────────────────────
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const conceptLine = concept ? `Concepto evaluado: ${concept}\n` : "";

    const prompt = `Eres un evaluador experto en madurez de uso de Inteligencia Artificial en entornos laborales.

Tu tarea es calificar la siguiente respuesta en una escala del 1 al 5 basándote estrictamente en los criterios dados.

${conceptLine}Pregunta: "${questionText}"

Criterios por nivel:
${Object.entries(scoringSignals).map(([lvl, desc]) => `- ${lvl}: ${desc}`).join("\n")}

Respuesta del usuario:
"${answerText}"

Devuelve ÚNICAMENTE un JSON válido sin markdown ni texto adicional:
{"score": <1-5>, "level": "<L1|L2|L3|L4T|L4L>", "reasoning": "<máx 20 palabras explicando el nivel>"}

Reglas: score 1=L1, 2=L2, 3=L3, 4=L4T, 5=L4L. L4L requiere evidencia clara de impacto organizacional.`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    const score = Math.max(1, Math.min(5, Number(parsed.score)));

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({ score, level: parsed.level, reasoning: parsed.reasoning }),
    };

  } catch (err) {
    context.log.error("Error Gemini:", err.message);
    // Fallback — no romper la experiencia del usuario
    const len = answerText.length;
    const fallback = len < 50 ? 2 : len < 150 ? 3 : 4;
    context.res = {
      status: 200,
      headers: corsHeaders,
      body: JSON.stringify({ score: fallback, level: "L3", reasoning: "Calificación automática (IA temporalmente no disponible)" }),
    };
  }
};
