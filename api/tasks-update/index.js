const { createTableClient } = require("../shared/tableClient");
const { corsHeaders } = require("../shared/cors");
const { validateSessionToken, requireSessionSecret } = require("../shared/sessionAuth");

/**
 * POST /api/tasks-update
 * Headers: X-Coach-Token, X-Coach-Email
 * Body: { taskId: string, completada: boolean }
 */

module.exports = async function (context, req) {
  const headers = corsHeaders(req, {
    methods: "POST, OPTIONS",
    extra: "X-Coach-Token, X-Coach-Email",
  });

  if (req.method === "OPTIONS") { context.res = { status: 204, headers, body: "" }; return; }

  const email = (req.headers["x-coach-email"] || "").trim().toLowerCase();
  const token = req.headers["x-coach-token"] || "";

  if (!requireSessionSecret(context, headers)) return;
  if (!email || !validateSessionToken(token, email)) {
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
    const coachClient = createTableClient(process.env.AZURE_STORAGE_CONNECTION_STRING, "coachSessions");
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
