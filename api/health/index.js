module.exports = async function (context, req) {
  const headers = { "Content-Type": "application/json" };
  const apiKey = process.env.GEMINI_API_KEY;

  // Paso 1: verificar que la key existe
  if (!apiKey) {
    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        status: "⚠️ KEY FALTANTE",
        problem: "GEMINI_API_KEY no está en Application Settings",
        env_keys: Object.keys(process.env).filter(k => !k.includes('TOKEN') && !k.includes('SECRET')).join(', ')
      })
    };
    return;
  }

  // Paso 2: probar Gemini con fetch directo (sin SDK, más simple)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responde solo: OK" }] }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      context.res = {
        status: 200,
        headers,
        body: JSON.stringify({
          status: "❌ KEY INVÁLIDA",
          http_status: response.status,
          error: data?.error?.message || JSON.stringify(data),
          key_preview: `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
        })
      };
      return;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "sin respuesta";
    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        status: "✅ TODO FUNCIONA",
        gemini: "Conectado",
        response: text,
        key_preview: `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
      })
    };

  } catch (err) {
    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        status: "❌ ERROR DE RED",
        error: err.message,
        key_preview: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}` : "no encontrada"
      })
    };
  }
};
