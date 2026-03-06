const { GoogleGenerativeAI } = require("@google/genai");

module.exports = async function (context, req) {
  const headers = { "Content-Type": "application/json" };
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Verificar que la key existe
  if (!apiKey) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({
        status: "❌ ERROR",
        problem: "GEMINI_API_KEY no está configurada en Azure Application Settings",
        fix: "Ve a Azure Portal → tu Static Web App → Configuration → Application settings → añade GEMINI_API_KEY"
      })
    };
    return;
  }

  // 2. Probar la key con una llamada mínima a Gemini
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Responde solo con la palabra: OK");
    const text = result.response.text().trim();

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        status: "✅ TODO FUNCIONA",
        gemini: "Conectado correctamente",
        response: text,
        key_preview: `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
      })
    };

  } catch (err) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({
        status: "❌ ERROR",
        problem: "La API Key existe pero Gemini rechazó la llamada",
        error: err.message,
        possible_causes: [
          "La key es incorrecta o fue revocada",
          "La key no tiene permisos para Gemini API",
          "El proyecto de GCP no tiene habilitada la Generative Language API"
        ],
        fix: "Ve a https://aistudio.google.com/apikey y crea una nueva key"
      })
    };
  }
};
