/**
 * Azure Function — Gemini API Proxy
 * 
 * Actúa como intermediario entre el frontend y la API de Gemini.
 * La API Key NUNCA llega al navegador del usuario.
 * 
 * Endpoint: POST /api/gemini-proxy
 * Body: { model, contents, generationConfig }
 */

const { GoogleGenerativeAI } = require("@google/genai");

module.exports = async function (context, req) {
  // CORS headers — solo permite el dominio de la app
  const allowedOrigins = [
    "https://ai-pulse.javiercruz.com",
    "http://localhost:3000" // para desarrollo local
  ];

  const origin = req.headers["origin"] || "";
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  context.res = {
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    }
  };

  // Preflight OPTIONS request
  if (req.method === "OPTIONS") {
    context.res.status = 200;
    context.res.body = "";
    return;
  }

  // Solo acepta POST
  if (req.method !== "POST") {
    context.res.status = 405;
    context.res.body = JSON.stringify({ error: "Method not allowed" });
    return;
  }

  // Validar que existe la API Key en variables de entorno del servidor
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    context.log.error("GEMINI_API_KEY no configurada en la Function App");
    context.res.status = 500;
    context.res.body = JSON.stringify({ error: "Server configuration error" });
    return;
  }

  try {
    const { model = "gemini-1.5-flash", contents, generationConfig } = req.body;

    if (!contents) {
      context.res.status = 400;
      context.res.body = JSON.stringify({ error: "Missing required field: contents" });
      return;
    }

    // Llamada real a Gemini — desde el servidor, con la key segura
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const result = await genModel.generateContent({
      contents,
      generationConfig: generationConfig || {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    });

    const response = result.response;
    const text = response.text();

    context.res.status = 200;
    context.res.body = JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }]
    });

  } catch (error) {
    context.log.error("Error llamando a Gemini:", error.message);
    context.res.status = 502;
    context.res.body = JSON.stringify({ error: "Error communicating with AI service" });
  }
};
