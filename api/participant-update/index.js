const { createTableClient } = require("../shared/tableClient");
const { requireAdmin } = require("../shared/adminAuth");

const VALID_STATUSES = ["pending", "invited", "started", "completed", "cancelled"];

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }
  if (!requireAdmin(context, req)) return;

  const { email, status } = req.body || {};
  if (!email || !status) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Faltan email o status" }) };
    return;
  }
  if (!VALID_STATUSES.includes(status)) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: `Status inválido. Válidos: ${VALID_STATUSES.join(", ")}` }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  try {
    const tableClient = createTableClient(connectionString, "participants");

    let participant = null;
    for await (const entity of tableClient.listEntities()) {
      if (entity.email === email) { participant = entity; break; }
    }

    if (!participant) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: "Participante no encontrado" }) };
      return;
    }

    participant.status = status;
    participant.statusUpdatedAt = new Date().toISOString();
    await tableClient.updateEntity(participant, "Merge");

    context.res = { status: 200, headers, body: JSON.stringify({ success: true, email, status }) };
  } catch (err) {
    context.log.error("participant-update error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
