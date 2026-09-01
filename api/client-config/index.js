const { corsHeaders } = require("../shared/cors");

module.exports = async function (context, req) {
  const headers = {
    ...corsHeaders(req, { methods: "GET, OPTIONS" }),
    "Cache-Control": "public, max-age=3600",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers, body: "" };
    return;
  }

  const googleClientId    = process.env.GOOGLE_CLIENT_ID    || "";
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID || "";
  const microsoftTenantId = process.env.MICROSOFT_TENANT_ID || "";

  if (!googleClientId && !microsoftClientId) {
    context.res = {
      status: 503,
      headers,
      body: JSON.stringify({ error: "Configuración de autenticación no disponible" }),
    };
    return;
  }

  context.res = {
    status: 200,
    headers,
    body: JSON.stringify({ googleClientId, microsoftClientId, microsoftTenantId }),
  };
};
