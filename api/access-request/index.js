const { createTableClient } = require("../shared/tableClient");
const { isCompanyEnabled } = require("../shared/companyAccess");
const { corsHeaders } = require("../shared/cors");

/**
 * POST /api/access-request
 * Body: { email, mode? }
 *
 * Modo "whitelist" (default): busca el email en participants (cualquier empresa)
 * El modo "domain" usa /api/domain-register directamente.
 * El modo "token" (link de correo) usa /api/auth-verify directamente.
 *
 * Anti-repetición: status=completed bloquea cualquier intento de reingreso.
 */
module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers, body: "" };
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const email = (body.email || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    context.res = {
      status: 400, headers,
      body: JSON.stringify({ error: "Debes ingresar un correo electrónico válido." })
    };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Configuración incompleta en el servidor." }) };
    return;
  }

  try {
    const participantsClient = createTableClient(connectionString, "participants");

    // Buscar en toda la tabla por RowKey=email (scan)
    let participant = null;
    for await (const entity of participantsClient.listEntities({
      queryOptions: { filter: `RowKey eq '${email}'` }
    })) {
      participant = entity;
      break;
    }

    if (!participant) {
      context.res = {
        status: 404, headers,
        body: JSON.stringify({
          error: "Tu correo no está registrado en esta evaluación. Verifica que sea el mismo con el que te invitaron.",
          code: "not_found"
        })
      };
      return;
    }

    // Cancelado
    if (participant.status === "cancelled") {
      context.res = {
        status: 403, headers,
        body: JSON.stringify({ error: "Tu acceso a esta evaluación fue cancelado. Contacta al administrador." })
      };
      return;
    }

    // ── Anti-repetición: ya completó → bloquear ───────────────────────────
    if (participant.status === "completed") {
      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          completed: true,
          nombre: participant.nombre || ""
        })
      };
      return;
    }

    // ── Empresa desactivada → bloquear nuevos inicios ──────────────────────
    if (participant.status === "pending" || participant.status === "invited") {
      const enabled = await isCompanyEnabled(connectionString, participant.partitionKey, context.log);
      if (!enabled) {
        context.res = {
          status: 403, headers,
          body: JSON.stringify({
            error: "El acceso para tu empresa fue desactivado temporalmente. Contacta al administrador.",
            code: "company_disabled"
          })
        };
        return;
      }
    }

    // Marcar como started si aún no lo está
    if (participant.status === "pending" || participant.status === "invited") {
      participant.status = "started";
      await participantsClient.updateEntity(participant, "Merge");
    }

    context.res = {
      status: 200, headers,
      body: JSON.stringify({
        token:        participant.token,
        nombre:       participant.nombre || "",
        empresa:      participant.partitionKey || "",
        posicion:     participant.posicion || "",
        departamento: participant.departamento || "",
        completed:    false
      })
    };

  } catch (err) {
    context.log.error("access-request error:", err.message);
    context.res = {
      status: 500, headers,
      body: JSON.stringify({ error: "Error al procesar tu solicitud. Intenta de nuevo." })
    };
  }
};
