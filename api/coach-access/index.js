const { odata } = require("@azure/data-tables");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { createTableClient } = require("../shared/tableClient");
const { recommendationCardsFromIds } = require("../shared/aiqRubricV6");
const { corsHeaders } = require("../shared/cors");
const { createSessionToken, validateSessionToken, requireSessionSecret } = require("../shared/sessionAuth");

/**
 * POST /api/coach-access
 *
 * Modos:
 *   { mode: "check",    email }              → verifica si coach está habilitado
 *   { mode: "setup",    email, password }    → primera vez: crea contraseña
 *   { mode: "login",    email, password }    → login recurrente
 *   { mode: "validate", email, sessionToken} → valida token activo
 */

const BCRYPT_COST = 12;

function isBcryptHash(hash) {
  return typeof hash === "string" && hash.startsWith("$2");
}

// Hash viejo (pre-bcrypt): sha256(password + ADMIN_PASSWORD). Se mantiene
// solo para verificar cuentas creadas antes de este cambio, una única vez
// por cuenta — ver migración lazy en el modo "login".
function legacyHash(password) {
  return crypto.createHash("sha256").update(password + process.env.ADMIN_PASSWORD).digest("hex");
}

// Devuelve { valid, needsMigration }: si el hash guardado es del formato
// viejo y la contraseña coincide, needsMigration=true para que el caller
// re-guarde el hash en bcrypt de forma transparente (sin pedirle nada al
// usuario).
async function verifyPassword(password, storedHash) {
  if (isBcryptHash(storedHash)) {
    return { valid: await bcrypt.compare(password, storedHash), needsMigration: false };
  }
  const valid = legacyHash(password) === storedHash;
  return { valid, needsMigration: valid };
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

  // El catálogo de recomendaciones v6 (aiqRubricV6.js) solo es válido para
  // resultados evaluados con esa misma rúbrica: traducir un ID persistido
  // bajo v5/legacy con el QUESTION_NUMBER de v6 produciría una tarjeta para
  // una pregunta distinta a la que el participante realmente respondió (ej.
  // P14 en v5 era E6, en v6 es C3) — silenciosamente incorrecto, no solo
  // vacío. Por eso las filas que no son v6 degradan a recomendaciones: [].
  const isCurrentRubric = result?.rubricVersion === "v6";

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
    recomendaciones: isCurrentRubric ? recommendationCardsFromIds(recomendacionesIds, { nombre, empresa }) : [],
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

  if (!requireSessionSecret(context, headers)) return;

  // ── validate: verifica token y devuelve perfil completo ─────────────────
  if (mode === "validate") {
    const token = body.sessionToken || "";
    const tokenEmail = validateSessionToken(token, email);
    if (!tokenEmail) {
      context.res = { status: 401, headers, body: JSON.stringify({ valid: false }) };
      return;
    }

    // Cargar perfil del participante para hidratar el dashboard
    try {
      const resultsClient = createTableClient(conn, "assessmentResults");
      let result = null;
      for await (const entity of resultsClient.listEntities({
        queryOptions: { filter: odata`email eq ${email}` },
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
      queryOptions: { filter: odata`email eq ${email}` }
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
      if (password.length < 8) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres." }) };
        return;
      }
      await coachClient.upsertEntity({
        partitionKey: email,
        rowKey:       "session",
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
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
      const { valid, needsMigration } = await verifyPassword(password, session.passwordHash);
      if (!valid) {
        context.res = { status: 401, headers, body: JSON.stringify({ error: "Contraseña incorrecta." }) };
        return;
      }
      if (needsMigration) {
        // Cuenta creada antes de bcrypt — se re-hashea de forma transparente,
        // sin pedirle al usuario que resetee su contraseña.
        await coachClient.updateEntity(
          { partitionKey: email, rowKey: "session", passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
          "Merge"
        );
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
