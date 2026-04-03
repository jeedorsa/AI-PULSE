const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../shared/adminAuth");

/**
 * Reensambla answers desde los 5 bloques particionados (nuevo formato post-fix)
 * o desde el campo único `answers` (registros anteriores, puede estar truncado).
 */
function assembleAnswers(entity) {
  // Nuevo formato: campos answersV / answersA / answersB / answersC / answersD
  if (entity.answersV !== undefined || entity.answersA !== undefined) {
    const out = {};
    for (const field of ["answersV", "answersA", "answersB", "answersC", "answersD"]) {
      try { Object.assign(out, JSON.parse(entity[field] || "{}")); } catch {}
    }
    return out;
  }
  // Legado: campo único (puede estar truncado si superó 32KB)
  try { return JSON.parse(entity.answers || "{}"); } catch { return {}; }
}

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
    const resultsClient = TableClient.fromConnectionString(connectionString, "assessmentResults");
    const results = [];

    for await (const entity of resultsClient.listEntities()) {
      const answers = assembleAnswers(entity);

      results.push({
        email:            entity.email || "",
        nombre:           entity.nombre || "",
        posicion:         entity.posicion || "",
        empresa:          entity.partitionKey || "",
        departamento:     entity.departamento || "",
        aiqScore:         entity.aiqScore || 0,
        aiqLevel:         entity.aiqLevel || "N/A",
        sectionA:         entity.sectionA || 0,
        sectionB:         entity.sectionB || 0,
        sectionC:         entity.sectionC || 0,
        challengeProfile: entity.challengeProfile || "",
        completedAt:      entity.completedAt || "",
        durationMinutes:  entity.durationMinutes || null,
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
