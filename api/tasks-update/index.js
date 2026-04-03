const { TableClient } = require("@azure/data-tables");
const crypto = require("crypto");

/**
 * POST /api/tasks-update
 * Headers: X-Coach-Token, X-Coach-Email
 * Body: { taskId: string, completada: boolean }
 */

function validateCoachToken(token, email) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig     = decoded.slice(lastColon + 1);
    const expected = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("hex");
    if (sig !== expected) return false;
    const parts = payload.split(":");
    const ts = parseInt(parts[parts.length - 1], 10);
    if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;
    return parts.slice(0, -1).join(":") === email;
  } catch { return false; }
}

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Coach-Token, X-Coach-Email",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") { context.res = { status: 204, headers, body: "" }; return; }

  const email = (req.headers["x-coach-email"] || "").trim().toLowerCase();
  const token = req.headers["x-coach-token"] || "";

  if (!email || !validateCoachToken(token, email)) {
    context.res = { status: 401, headers, body: JSON.stringify({ error: "Sesión inválida." }) };
    return;
  }

  const body       = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const taskId     = body.taskId;
  const completada = !!body.completada;

  if (!taskId) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "taskId requerido." }) };
    return;
  }

  try {
    const coachClient = TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING, "coachSessions");
    const session = await coachClient.getEntity(email, "session");
    const tasks = JSON.parse(session.tasks || "[]");

    const updated = tasks.map(t => t.id === taskId ? { ...t, completada, completedAt: completada ? new Date().toISOString() : null } : t);

    await coachClient.updateEntity({
      partitionKey: email,
      rowKey:       "session",
      tasks:        JSON.stringify(updated),
    }, "Merge");

    context.res = { status: 200, headers, body: JSON.stringify({ tasks: updated }) };

  } catch (err) {
    context.log.error("tasks-update error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error actualizando tarea." }) };
  }
};
