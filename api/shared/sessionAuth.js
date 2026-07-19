const crypto = require("crypto");

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Crea un token de sesión de coach/participante (Google, Microsoft, coach-access).
 * Firmado con SESSION_SECRET — un secreto dedicado, distinto de ADMIN_PASSWORD,
 * para que filtrar la contraseña del panel admin no permita falsificar sesiones
 * de participantes/coaches.
 * Formato: base64url(email:timestamp:firma_hmac).
 */
function createSessionToken(email) {
  const secret = process.env.SESSION_SECRET;
  const payload = `${email}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Valida un token de sesión: firma (timing-safe), expiración (7 días) y que
 * el email codificado coincida con expectedEmail (si se provee).
 * Devuelve el email si es válido, o null si no.
 */
function validateSessionToken(token, expectedEmail) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);

    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const parts = payload.split(":");
    const ts = parseInt(parts[parts.length - 1], 10);
    if (isNaN(ts) || Date.now() - ts > TOKEN_TTL_MS) return null;

    const tokenEmail = parts.slice(0, -1).join(":");
    if (expectedEmail && tokenEmail !== expectedEmail) return null;

    return tokenEmail;
  } catch {
    return null;
  }
}

/**
 * Responde 500 con mensaje claro si SESSION_SECRET no está configurada —
 * mismo patrón que adminAuth.js usa para ADMIN_PASSWORD, para no fallar con
 * una excepción no controlada si falta la variable de entorno en el ambiente.
 */
function requireSessionSecret(context, headers) {
  if (!process.env.SESSION_SECRET) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: "SESSION_SECRET no configurada en el servidor" }),
    };
    return false;
  }
  return true;
}

module.exports = { createSessionToken, validateSessionToken, requireSessionSecret };
