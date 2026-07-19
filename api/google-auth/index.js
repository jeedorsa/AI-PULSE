const { odata } = require("@azure/data-tables");
const { createTableClient } = require("../shared/tableClient");
const { corsHeaders } = require("../shared/cors");
const { createSessionToken, requireSessionSecret } = require("../shared/sessionAuth");

module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers, body: "" };
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const { access_token } = body;

  if (!access_token) {
    context.res = {
      status: 400,
      headers,
      body: JSON.stringify({ error: "Token de Google requerido" }),
    };
    return;
  }

  // Verificar el access_token con Google y obtener el email
  let email;
  try {
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${access_token}`
    );
    const tokenInfo = await tokenInfoRes.json();

    if (tokenInfo.error || tokenInfo.email_verified !== "true") {
      throw new Error("Token inválido o correo no verificado");
    }

    // Si hay CLIENT_ID configurado, verificar que el token sea para nuestra app
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && tokenInfo.azp !== clientId && tokenInfo.aud !== clientId) {
      throw new Error("Token no autorizado para esta aplicación");
    }

    email = tokenInfo.email.toLowerCase().trim();
  } catch (err) {
    context.log.warn("Google token verification failed:", err.message);
    context.res = {
      status: 401,
      headers,
      body: JSON.stringify({ error: "No se pudo verificar tu cuenta de Google. Intenta de nuevo." }),
    };
    return;
  }

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: "Configuración incompleta en el servidor" }),
    };
    return;
  }

  if (!requireSessionSecret(context, headers)) return;

  try {
    const participantsClient = createTableClient(conn, "participants");

    // Buscar participante por email (RowKey) — solo lectura, sin modificar nada.
    // odata`` escapa automáticamente (mismo patrón que auth-verify.js), a
    // diferencia de interpolar el string a mano — un email con apóstrofo
    // (legal según RFC 5321, ej. "o'brien@x.com") no rompe el filtro.
    let participant = null;
    for await (const entity of participantsClient.listEntities({
      queryOptions: { filter: odata`RowKey eq ${email}` },
    })) {
      participant = entity;
      break;
    }

    if (!participant) {
      context.res = {
        status: 403,
        headers,
        body: JSON.stringify({
          error: "Tu correo no está registrado en el programa. Contacta al administrador.",
        }),
      };
      return;
    }

    if (participant.status !== "completed") {
      const statusMsg = {
        pending:   "Aún no has recibido tu invitación.",
        invited:   "Aún no has completado tu diagnóstico AIQ.",
        started:   "Tu diagnóstico AIQ está en progreso. Complétalo para acceder.",
        cancelled: "Tu acceso ha sido cancelado. Contacta al administrador.",
      };
      context.res = {
        status: 403,
        headers,
        body: JSON.stringify({
          error: statusMsg[participant.status] || "No tienes acceso al sistema en este momento.",
        }),
      };
      return;
    }

    const sessionToken = createSessionToken(email);

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sessionToken,
        email,
        nombre:   participant.nombre   || "",
        empresa:  participant.empresa  || participant.partitionKey || "",
        posicion: participant.posicion || "",
      }),
    };
  } catch (err) {
    context.log.error("google-auth error:", err.message);
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: "Error interno. Intenta de nuevo." }),
    };
  }
};
