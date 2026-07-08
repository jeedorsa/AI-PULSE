const { requireAdmin } = require("../shared/adminAuth");
const { createTableClient } = require("../shared/tableClient");
const { assembleAnswers } = require("../shared/assembleAnswers");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json"
  };

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
    const resultsClient = createTableClient(connectionString, "assessmentResults");
    const results = [];

    for await (const entity of resultsClient.listEntities()) {
      const answers = assembleAnswers(entity);

      results.push({
        email:              entity.email || "",
        nombre:             entity.nombre || "",
        empresa:            entity.partitionKey || "",
        aiqScore:           entity.aiqScore || 0,
        aiqLevel:           entity.aiqLevel || "N/A",
        sectionA:           entity.sectionA || 0,
        sectionB:           entity.sectionB || 0,
        sectionC:           entity.sectionC || 0,
        flags:              entity.alerts ? JSON.parse(entity.alerts) : [],
        rubricVersion:      entity.rubricVersion || "legacy",
        recomendacionesIds: entity.recomendacionesIds ? JSON.parse(entity.recomendacionesIds) : [],
        completedAt:        entity.completedAt || "",
        durationMinutes:    entity.durationMinutes || null,
        answers
      });
    }

    results.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({ results })
    };

  } catch (err) {
    context.log.error("results-list error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error al obtener resultados" }) };
  }
};
