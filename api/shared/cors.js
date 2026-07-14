/**
 * Devuelve los headers CORS para un endpoint que solo debe ser llamable
 * desde el frontend propio (APP_BASE_URL) o desde herramientas de dev local.
 *
 * Reemplaza el patrón inseguro `Access-Control-Allow-Origin: *` — que dejaba
 * los endpoints de auth/coach abiertos a cualquier origen en internet — por
 * una whitelist estricta con eco del Origin cuando coincide (más `Vary: Origin`
 * para que caches y CDNs no crucen respuestas entre orígenes).
 *
 * Uso:
 *   const { corsHeaders } = require("../shared/cors");
 *   const headers = corsHeaders(req, { methods: "POST, OPTIONS", extra: "X-Coach-Token, X-Coach-Email" });
 *
 * @param {object} req - context.req del Function
 * @param {object} opts
 * @param {string} [opts.methods="POST, OPTIONS"] - Access-Control-Allow-Methods
 * @param {string} [opts.extra=""] - headers extra permitidos, ej "X-Coach-Token"
 * @returns {object} Headers CORS + Content-Type: application/json
 */
function corsHeaders(req, opts = {}) {
  const methods = opts.methods || "POST, OPTIONS";
  const extraHeaders = opts.extra ? `, ${opts.extra}` : "";

  const allowedOrigins = new Set([
    "http://localhost:3000",  // Vite dev
    "http://localhost:4280",  // SWA CLI
    "http://localhost:5173",  // Vite default
  ]);
  const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
  if (appBaseUrl) allowedOrigins.add(appBaseUrl);

  const requestOrigin =
    (req && req.headers && (req.headers["origin"] || req.headers["Origin"])) || "";
  const allowOrigin = allowedOrigins.has(requestOrigin) ? requestOrigin : "";

  const headers = {
    "Content-Type": "application/json",
    Vary: "Origin",
  };

  if (allowOrigin) {
    headers["Access-Control-Allow-Origin"] = allowOrigin;
    headers["Access-Control-Allow-Methods"] = methods;
    headers["Access-Control-Allow-Headers"] = `Content-Type, Authorization${extraHeaders}`;
  }

  return headers;
}

module.exports = { corsHeaders };
