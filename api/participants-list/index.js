const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../shared/adminAuth");

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
    const tableClient = TableClient.fromConnectionString(connectionString, "participants");
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
