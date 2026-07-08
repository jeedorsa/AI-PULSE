const { createTableClient } = require("../shared/tableClient");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }

  const token = req.query.token;
  if (!token) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta token" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  try {
    const tableClient = createTableClient(connectionString, "assessmentProgress");
    const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
      const entity = await tableClient.getEntity("progress", safeToken);
      let answers = {};
      try { answers = JSON.parse(entity.answers || "{}"); } catch {}

      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          found: true,
          currentQuestion: entity.currentQuestion || 0,
          answers,
          savedAt: entity.savedAt
        })
      };
    } catch (e) {
      // No progress found - fresh start
      context.res = { status: 200, headers, body: JSON.stringify({ found: false }) };
    }
  } catch (err) {
    context.log.error("progress-get error:", err);
    context.res = { status: 200, headers, body: JSON.stringify({ found: false }) };
  }
};
