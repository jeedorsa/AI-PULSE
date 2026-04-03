const { createAdminToken } = require("../shared/adminAuth");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  const signingSecret = process.env.ADMIN_PASSWORD;
  if (!signingSecret) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: "ADMIN_PASSWORD no configurada en el servidor" })
    };
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    context.res = {
      status: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON in request body" })
    };
    return;
  }

  const username = ((body && body.username) || "").trim().toLowerCase();
  const password = (body && body.password) || "";

  if (!username || !password) {
    context.res = {
      status: 401,
      headers,
      body: JSON.stringify({ error: "Usuario y contrasena requeridos" })
    };
    return;
  }

  // Busca el env var ADMIN_PASSWORD_{USERNAME} (ej: ADMIN_PASSWORD_JAVIER)
  const envKey = `ADMIN_PASSWORD_${username.toUpperCase()}`;
  const expectedPassword = process.env[envKey];

  if (!expectedPassword || password !== expectedPassword) {
    context.res = {
      status: 401,
      headers,
      body: JSON.stringify({ error: "Usuario o contrasena incorrectos" })
    };
    return;
  }

  const token = createAdminToken(signingSecret);

  context.res = {
    status: 200,
    headers,
    body: JSON.stringify({
      authenticated: true,
      token,
      expiresIn: "24h"
    })
  };
};
