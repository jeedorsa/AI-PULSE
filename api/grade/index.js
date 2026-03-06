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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "GEMINI_API_KEY no configurada" }) };
    return;
  }

  const { questionText, scoringSignals, answer, concept } = req.body || {};
  const answerText = typeof answer === "string" ? answer : answer?.text || "";

  if (answerText.trim().length < 15) {
    context.res = { status: 200, headers, body: JSON.stringify({ score: 1, level: "L1", reasoning: "Respuesta muy corta" }) };
    return;
  }

  try {
    const conceptLine = concept ? `Concepto: ${concept}\n` : "";
    const prompt = `Eres evaluador de madurez en IA. Califica del 1 al 5.
${conceptLine}Pregunta: "${questionText}"
Criterios:
${Object.entries(scoringSignals || {}).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
Respuesta: "${answerText}"
Devuelve SOLO JSON sin markdown: {"score":<1-5>,"level":"<L1|L2|L3|L4T|L4L>","reasoning":"<max 20 palabras>"}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Math.max(1, Math.min(5, Number(parsed.score)));

    context.res = { status: 200, headers, body: JSON.stringify({ score, level: parsed.level, reasoning: parsed.reasoning }) };

  } catch (err) {
    const len = answerText.length;
    const fallback = len < 50 ? 2 : len < 150 ? 3 : 4;
    context.res = { status: 200, headers, body: JSON.stringify({ score: fallback, level: "L3", reasoning: "Calificación automática" }) };
  }
};
