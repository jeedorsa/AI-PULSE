const { createTableClient } = require("../shared/tableClient");
const { isCompanyEnabled } = require("../shared/companyAccess");
const { v4: uuidv4 } = require("uuid");

/**
 * POST /api/domain-register
 * Body: { email, empresa, dominio }
 *
 * Flujo para el modo "dominio abierto":
 *   1. Verifica que el email termine en el dominio autorizado
 *   2. Si ya existe → devuelve estado (completed / in_progress)
 *   3. Si no existe → crea registro con token nuevo
 *   4. Nunca permite repetir: status=completed bloquea permanentemente
 */
module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers, body: "" };
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const email    = (body.email   || "").trim().toLowerCase();
  const nombreInput = (body.nombre || "").trim();
  const empresa  = (body.empresa || "").trim();
  const dominio  = (body.dominio || "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Ingresa un correo electrónico válido." }) };
    return;
  }

  // ── Verificar dominio(s) autorizado(s) ──────────────────────────────────
  // dominio puede ser uno o varios separados por coma: "acme.com,acme.cl"
  if (dominio) {
    const dominiosPermitidos = dominio.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const dominioValido = dominiosPermitidos.some(d => email.endsWith(`@${d}`));
    if (!dominioValido) {
      const lista = dominiosPermitidos.map(d => `@${d}`).join(' o ');
      context.res = {
        status: 403, headers,
        body: JSON.stringify({
          error: `Este enlace es exclusivo para correos ${lista}. Verifica que estés usando tu email corporativo.`
        })
      };
      return;
    }
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Configuración incompleta." }) };
    return;
  }

  try {
    const participantsClient = createTableClient(connectionString, "participants");
    const partitionKey = empresa || dominio?.split(".")[0] || "open";

    // ── Buscar si ya existe (por email = RowKey) ──────────────────────────
    let existing = null;
    try {
      existing = await participantsClient.getEntity(partitionKey, email);
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    if (existing) {
      // Ya completó — bloquear permanentemente
      if (existing.status === "completed") {
        context.res = {
          status: 200, headers,
          body: JSON.stringify({
            completed: true,
            nombre: existing.nombre || email.split("@")[0]
          })
        };
        return;
      }

      // Cancelado
      if (existing.status === "cancelled") {
        context.res = {
          status: 403, headers,
          body: JSON.stringify({ error: "Tu acceso fue cancelado. Contacta al administrador." })
        };
        return;
      }

      // En progreso — devolver token existente para retomar
      if (existing.status !== "started") {
        const enabled = await isCompanyEnabled(connectionString, partitionKey, context.log);
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
        existing.status = "started";
        await participantsClient.updateEntity(existing, "Merge");
      }

      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          token:        existing.token,
          nombre:       existing.nombre || email.split("@")[0],
          empresa:      partitionKey,
          posicion:     existing.posicion || "",
          departamento: existing.departamento || "",
          completed:    false,
          isNew:        false
        })
      };
      return;
    }

    // ── Empresa desactivada → bloquear nuevos inicios ──────────────────────
    const companyEnabled = await isCompanyEnabled(connectionString, partitionKey, context.log);
    if (!companyEnabled) {
      context.res = {
        status: 403, headers,
        body: JSON.stringify({
          error: "El acceso para tu empresa fue desactivado temporalmente. Contacta al administrador.",
          code: "company_disabled"
        })
      };
      return;
    }

    // ── Crear nuevo participante ───────────────────────────────────────────
    const token = uuidv4();
    const nombre = nombreInput || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    const newParticipant = {
      partitionKey,
      rowKey:       email,
      email,
      nombre,
      posicion:     "",
      departamento: "",
      token,
      status:       "started",
      invitedAt:    new Date().toISOString(),
      source:       "domain_open"   // para distinguirlos en el admin
    };

    await participantsClient.createEntity(newParticipant);

    context.res = {
      status: 200, headers,
      body: JSON.stringify({
        token,
        nombre,
        empresa:      partitionKey,
        posicion:     "",
        departamento: "",
        completed:    false,
        isNew:        true
      })
    };

  } catch (err) {
    context.log.error("domain-register error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error al procesar tu solicitud. Intenta de nuevo." }) };
  }
};
