const { TableClient } = require("@azure/data-tables");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }

  const { token, currentQuestion, answers } = req.body || {};
  if (!token) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta token" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  try {
    const tableClient = TableClient.fromConnectionString(connectionString, "assessmentProgress");
    try { await tableClient.createTable(); } catch {}

    const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, '_');

    await tableClient.upsertEntity({
      partitionKey: "progress",
      rowKey: safeToken,
      token,
      currentQuestion: currentQuestion || 0,
      answers: JSON.stringify(answers || {}),
      savedAt: new Date().toISOString()
    });

    // Marcar participante como 'started' si aún está en invited/pending
    try {
      const participantsClient = TableClient.fromConnectionString(connectionString, "participants");
      for await (const entity of participantsClient.listEntities({
        queryOptions: { filter: `token eq '${token}'` }
      })) {
        if (entity.status === "pending" || entity.status === "invited") {
          entity.status = "started";
          entity.startedAt = new Date().toISOString();
          await participantsClient.updateEntity(entity, "Merge");
        }
        break;
      }
    } catch {}

    context.res = { status: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    context.log.error("progress-save error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
