const { createTableClient } = require("../shared/tableClient");
const { recommendationCardsFromIds } = require("../shared/aiqRubricV5");
const { corsHeaders } = require("../shared/cors");
const crypto = require("crypto");

/**
 * POST /api/coach-access
 *
 * Modos:
 *   { mode: "check",    email }              → verifica si coach está habilitado
 *   { mode: "setup",    email, password }    → primera vez: crea contraseña
 *   { mode: "login",    email, password }    → login recurrente
 *   { mode: "validate", email, sessionToken} → valida token activo
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + process.env.ADMIN_PASSWORD).digest("hex");
}

function createSessionToken(email) {
  const payload = `${email}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function validateSessionToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig     = decoded.slice(lastColon + 1);
    const expected = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("hex");
    if (sig !== expected) return null;
    const parts = payload.split(":");
    const ts = parseInt(parts[parts.length - 1], 10);
    if (Date.now() - ts > TOKEN_TTL_MS) return null;
    return parts.slice(0, -1).join(":");  // email (puede tener : si el email lo tiene)
  } catch { return null; }
}

// Campos de perfil compartidos por validate/setup/login — centralizado para
// que los tres devuelvan siempre la misma forma (incluye rubricVersion/flags/
// recomendaciones ya renderizadas para la nueva vista de CoachPage).
function buildProfileFields(result) {
  const nombre  = result?.nombre || "";
  const empresa = result?.partitionKey || "";
  let recomendacionesIds = [];
  try { recomendacionesIds = result?.recomendacionesIds ? JSON.parse(result.recomendacionesIds) : []; } catch {}
  let flags = [];
  try { flags = result?.alerts ? JSON.parse(result.alerts) : []; } catch {}

  return {
    nombre,
    aiqScore: result?.aiqScore || 0,
    aiqLevel: result?.aiqLevel || "",
    sectionA: result?.sectionA || 0,
    sectionB: result?.sectionB || 0,
    sectionC: result?.sectionC || 0,
    empresa,
    posicion: result?.posicion || "",
    completedAt: result?.completedAt || "",
    rubricVersion: result?.rubricVersion || "legacy",
    flags,
    recomendaciones: recommendationCardsFromIds(recomendacionesIds, { nombre, empresa }),
  };
}

module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") { context.res = { status: 204, headers, body: "" }; return; }

  const body  = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const mode  = body.mode || "check";
  const email = (body.email || "").trim().toLowerCase();

  if (!email) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Email requerido" }) };
    return;
  }

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Configuración incompleta" }) };
    return;
  }

  // ── validate: verifica token y devuelve perfil completo ─────────────────
  if (mode === "validate") {
    const token = body.sessionToken || "";
    const tokenEmail = validateSessionToken(token);
    if (!tokenEmail || tokenEmail !== email) {
      context.res = { status: 401, headers, body: JSON.stringify({ valid: false }) };
      return;
    }

    // Cargar perfil del participante para hidratar el dashboard
    try {
      const resultsClient = createTableClient(conn, "assessmentResults");
      let result = null;
      for await (const entity of resultsClient.listEntities({
        queryOptions: { filter: `email eq '${email}'` },
      })) { result = entity; break; }

      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          valid: true,
          ...buildProfileFields(result),
        }),
      };
    } catch {
      // Si falla la BD, al menos confirmamos que el token es válido
      context.res = { status: 200, headers, body: JSON.stringify({ valid: true }) };
    }
    return;
  }

  try {
    const resultsClient = createTableClient(conn, "assessmentResults");

    // Buscar resultado por email (campo, no RowKey — RowKey es el token del assessment)
    let result = null;
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `email eq '${email}'` }
    })) { result = entity; break; }

    if (!result) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: "No encontramos una evaluación completada para este correo." }) };
      return;
    }

    if (result.status !== "completed") {
      context.res = { status: 403, headers, body: JSON.stringify({ error: "Aún no has completado tu evaluación AIQ." }) };
      return;
    }

    // ── check: solo informa si el coach está habilitado ──────────────────
    if (mode === "check") {
      if (!result.coachEnabled) {
        context.res = { status: 200, headers, body: JSON.stringify({ coachEnabled: false, nombre: result.nombre || "" }) };
        return;
      }
      // Ya tiene contraseña?
      const coachClient = createTableClient(conn, "coachSessions");
      let session = null;
      try { session = await coachClient.getEntity(email, "session"); } catch {}
      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          coachEnabled: true,
          hasPassword:  !!(session?.passwordHash),
          nombre:       result.nombre || ""
        })
      };
      return;
    }

    // Coach debe estar habilitado para setup/login
    if (!result.coachEnabled) {
      context.res = {
        status: 403, headers,
        body: JSON.stringify({ error: "Tu coach aún no está disponible. El equipo de AI Pulse lo activará una vez que tu informe esté listo." })
      };
      return;
    }

    const coachClient = createTableClient(conn, "coachSessions");
    let session = null;
    try { session = await coachClient.getEntity(email, "session"); } catch {}

    // ── setup: primera vez, crear contraseña ─────────────────────────────
    if (mode === "setup") {
      if (session?.passwordHash) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: "Ya tienes una contraseña configurada. Inicia sesión normalmente." }) };
        return;
      }
      const password = body.password || "";
      if (password.length < 6) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres." }) };
        return;
      }
      await coachClient.upsertEntity({
        partitionKey: email,
        rowKey:       "session",
        passwordHash: hashPassword(password),
        tasks:        "[]",
        chatHistory:  "[]",
        createdAt:    new Date().toISOString(),
      }, "Replace");

      const sessionToken = createSessionToken(email);
      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          success: true,
          sessionToken,
          ...buildProfileFields(result),
          isNew: true,
        })
      };
      return;
    }

    // ── login: validar contraseña existente ──────────────────────────────
    if (mode === "login") {
      if (!session?.passwordHash) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: "Primero debes configurar tu contraseña." }) };
        return;
      }
      const password = body.password || "";
      if (hashPassword(password) !== session.passwordHash) {
        context.res = { status: 401, headers, body: JSON.stringify({ error: "Contraseña incorrecta." }) };
        return;
      }
      const sessionToken = createSessionToken(email);
      context.res = {
        status: 200, headers,
        body: JSON.stringify({
          success: true,
          sessionToken,
          ...buildProfileFields(result),
          isNew: false,
        })
      };
      return;
    }

    context.res = { status: 400, headers, body: JSON.stringify({ error: "Modo no reconocido" }) };

  } catch (err) {
    context.log.error("coach-access error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error interno. Intenta de nuevo." }) };
  }
};
