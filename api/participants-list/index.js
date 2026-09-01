const { createTableClient } = require("../shared/tableClient");
const { requireAdmin } = require("../shared/adminAuth");
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
    const tableClient = createTableClient(connectionString, "participants");
    const participants = [];

    for await (const entity of tableClient.listEntities()) {
      participants.push({
        email: entity.email,
        nombre: entity.nombre,
        posicion: entity.posicion,
        empresa: entity.empresa || entity.partitionKey,
        departamento: entity.departamento,
        status: entity.status || "pending",
        createdAt: entity.createdAt,
        startedAt: entity.startedAt,
        completedAt: entity.completedAt
      });
    }

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({ participants })
    };

  } catch (err) {
    context.log.error("participants/list error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error al obtener participantes" }) };
  }
};
