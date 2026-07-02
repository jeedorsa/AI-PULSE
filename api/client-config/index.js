module.exports = async function (context, req) {
  // Orígenes permitidos: puertos de dev locales + URL configurada en APP_BASE_URL
  const allowedOrigins = new Set([
    "http://localhost:3000", // Vite dev server
    "http://localhost:4280", // SWA CLI
  ]);

  const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (appBaseUrl) allowedOrigins.add(appBaseUrl);

  const requestOrigin = (req.headers && req.headers["origin"]) || "";
  const corsOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : null;

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600",
    Vary: "Origin",
  };

  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
  }

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
