const { TableClient, odata } = require("@azure/data-tables");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  const token = req.query.token;
  if (!token) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Token no proporcionado" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "AZURE_STORAGE_CONNECTION_STRING no configurada" }) };
    return;
  }

  try {
    const tableClient = TableClient.fromConnectionString(connectionString, "participants");

    // Validate token format (UUID v4 only) to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: "Formato de token inválido" }) };
      return;
    }

    // Query by token (using parameterized filter to prevent OData injection)
    const entities = tableClient.listEntities({
      queryOptions: { filter: odata`token eq ${token}` }
    });

    let participant = null;
    for await (const entity of entities) {
      participant = entity;
      break;
    }

    if (!participant) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: "Token inválido. Este link no es válido o ya fue utilizado." }) };
      return;
    }

    // Check expiration
    if (participant.tokenExpiresAt) {
      const expiresAt = new Date(participant.tokenExpiresAt);
      if (expiresAt < new Date()) {
        context.res = { status: 410, headers, body: JSON.stringify({ error: "Este link ha expirado. Contacta al administrador para recibir uno nuevo." }) };
        return;
      }
    }

    // Check if already completed
    if (participant.status === "completed") {
      context.res = { status: 409, headers, body: JSON.stringify({ error: "Este diagnóstico ya fue completado. Contacta al administrador si necesitas acceso nuevamente." }) };
      return;
    }

    // Return participant data (without sensitive fields)
    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        email: participant.email,
        nombre: participant.nombre,
        posicion: participant.posicion,
        empresa: participant.empresa || participant.partitionKey,
        departamento: participant.departamento
      })
    };

  } catch (err) {
    context.log.error("auth/verify error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error interno al verificar el token" }) };
  }
};
