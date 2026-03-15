const crypto = require("crypto");

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Creates a signed admin token using HMAC-SHA256.
 * Format: timestamp.signature
 */
function createAdminToken(secret) {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

/**
 * Validates an admin token.
 * Returns true if the token is valid and not expired.
 */
function validateAdminToken(token, secret) {
  if (!token || !secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Check expiry
  const age = Date.now() - ts;
  if (age > TOKEN_EXPIRY_HOURS * 60 * 60 * 1000 || age < 0) return false;

  // Verify signature
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Extracts and validates admin token from request.
 * Returns true if authenticated, false otherwise.
 * Sets 401 response if not authenticated.
 */
function requireAdmin(context, req) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    context.res = {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ error: "ADMIN_PASSWORD no configurada en el servidor" }),
    };
    return false;
  }

  const authHeader = req.headers["authorization"] || req.headers["Authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!validateAdminToken(token, adminPassword)) {
    context.res = {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "No autorizado. Inicia sesion como administrador." }),
    };
    return false;
  }

  return true;
}

module.exports = { createAdminToken, validateAdminToken, requireAdmin };
