const { createTableClient } = require("../shared/tableClient");
const { requireAdmin } = require("../shared/adminAuth");
const { normalizeCompanyKey } = require("../shared/companyAccess");
const { corsHeaders } = require("../shared/cors");

module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "GET, OPTIONS", extra: "X-Admin-Token" });

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  if (!requireAdmin(context, req)) return;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "AZURE_STORAGE_CONNECTION_STRING no configurada" }) };
    return;
  }

  try {
    const participantsClient = createTableClient(connectionString, "participants");
    const counts = new Map();

    for await (const entity of participantsClient.listEntities()) {
      const empresa = entity.empresa || entity.partitionKey || "";
      if (!empresa) continue;
      const key = normalizeCompanyKey(empresa);
      const current = counts.get(key);
      if (current) {
        current.total += 1;
      } else {
        counts.set(key, { empresa, total: 1 });
      }
    }

    const companiesClient = createTableClient(connectionString, "companies");
    const enabledByKey = new Map();
    try {
      for await (const entity of companiesClient.listEntities({ queryOptions: { filter: "PartitionKey eq 'company'" } })) {
        enabledByKey.set(entity.rowKey, entity.enabled !== false);
      }
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    const companies = Array.from(counts.entries())
      .map(([key, { empresa, total }]) => ({
        empresa,
        totalParticipantes: total,
        enabled: enabledByKey.has(key) ? enabledByKey.get(key) : true
      }))
      .sort((a, b) => a.empresa.localeCompare(b.empresa));

    context.res = { status: 200, headers, body: JSON.stringify({ companies }) };

  } catch (err) {
    context.log.error("companies-list error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error al obtener empresas" }) };
  }
};
