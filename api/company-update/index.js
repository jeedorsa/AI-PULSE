const { createTableClient } = require("../shared/tableClient");
const { requireAdmin } = require("../shared/adminAuth");
const { normalizeCompanyKey } = require("../shared/companyAccess");
const { corsHeaders } = require("../shared/cors");

module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "POST, OPTIONS", extra: "X-Admin-Token" });
  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }
  if (!requireAdmin(context, req)) return;

  const { empresa, enabled } = req.body || {};
  if (!empresa || typeof enabled !== "boolean") {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Faltan empresa o enabled" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  try {
    const tableClient = createTableClient(connectionString, "companies");
    try { await tableClient.createTable(); } catch {}

    await tableClient.upsertEntity({
      partitionKey: "company",
      rowKey: normalizeCompanyKey(empresa),
      empresaDisplay: empresa,
      enabled,
      updatedAt: new Date().toISOString()
    }, "Merge");

    context.res = { status: 200, headers, body: JSON.stringify({ success: true, empresa, enabled }) };
  } catch (err) {
    context.log.error("company-update error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
