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

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
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
  const password = (body && body.password) || "";

  if (!password || password !== adminPassword) {
    context.res = {
      status: 401,
      headers,
      body: JSON.stringify({ error: "Contrasena incorrecta" })
    };
    return;
  }

  const token = createAdminToken(adminPassword);

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
