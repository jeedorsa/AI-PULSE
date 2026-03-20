const { TableClient } = require("@azure/data-tables");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  const { email, empresa, whatsapp } = req.body || {};

  if (!email || !empresa || !whatsapp) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Faltan campos requeridos" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Storage no configurado" }) };
    return;
  }

  try {
    const tableClient = TableClient.fromConnectionString(connectionString, "waitlist");

    // Crear tabla si no existe
    try { await tableClient.createTable(); } catch (e) { /* ya existe */ }

    const rowKey = Date.now().toString() + "_" + Math.random().toString(36).slice(2, 7);

    await tableClient.upsertEntity({
      partitionKey: "waitlist",
      rowKey,
      email,
      empresa,
      whatsapp,
      createdAt: new Date().toISOString()
    });

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Registro exitoso" })
    };

  } catch (err) {
    context.log.error("waitlist error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error al guardar" }) };
  }
};
