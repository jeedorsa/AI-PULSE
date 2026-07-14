const { createTableClient } = require("../shared/tableClient");
const { corsHeaders } = require("../shared/cors");
const crypto = require("crypto");

/**
 * POST /api/coach-chat
 * Headers: X-Coach-Token, X-Coach-Email
 * Body: { message: string }
 *
 * Maneja la conversación con el coach.
 * Mantiene historial de los últimos 30 mensajes.
 * El coach siempre tiene contexto del diagnóstico AIQ.
 */

const MAX_HISTORY = 30;

function validateCoachToken(token, email) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, lastColon);
    const sig     = decoded.slice(lastColon + 1);
    const expected = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("hex");
    if (sig !== expected) return false;
    const parts = payload.split(":");
    const ts = parseInt(parts[parts.length - 1], 10);
    if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;
    return parts.slice(0, -1).join(":") === email;
  } catch { return false; }
}

function buildSystemPrompt(result, analysis, tasks) {
  const nivel    = result.aiqLevel || "L2";
  const nombre   = result.nombre || "";
  const posicion = result.posicion || "";
  const empresa  = result.partitionKey || "";
  const escalaMax = result.rubricVersion === "v5" ? 4 : 5;

  const tareasTexto = tasks.map(t =>
    `- [${t.completada ? "✅ Completada" : "⬜ Pendiente"}] ${t.titulo}: ${t.descripcion}`
  ).join("\n");

  return `Eres el coach personal de AI Pulse para ${nombre}. Tu rol es ayudar a esta persona a desarrollar su madurez en inteligencia artificial de forma práctica y concreta.

PERFIL DEL PARTICIPANTE:
- Nombre: ${nombre}
- Cargo: ${posicion}
- Empresa: ${empresa}
- Nivel AIQ: ${nivel}
- Bloque A (Experiencia Real): ${(result.sectionA || 0).toFixed(2)} / ${escalaMax}.0
- Bloque B (Criterio Técnico): ${(result.sectionB || 0).toFixed(2)} / ${escalaMax}.0
- Bloque C (Laboratorio): ${(result.sectionC || 0).toFixed(2)} / ${escalaMax}.0

ANÁLISIS DE SU DIAGNÓSTICO:
- Fortaleza colectiva: ${analysis.fortaleza_colectiva || ""}
- Brecha crítica: ${analysis.brecha_critica || ""}
- Fortalezas individuales: ${JSON.stringify(analysis.fortalezas || [])}
- Oportunidades: ${JSON.stringify(analysis.oportunidades || [])}
- Gaps accionables: ${JSON.stringify(analysis.gaps || [])}

SUS TAREAS ACTUALES:
${tareasTexto || "Aún no se han generado tareas."}

REGLAS DE CONDUCTA:
1. Habla siempre con base en SUS datos reales — no des consejos genéricos sobre IA.
2. Si pregunta algo relacionado con sus tareas, explica cómo avanzar en ellas con ejemplos concretos.
3. Si pregunta sobre su nivel o scores, interprétalos en el contexto de su cargo y empresa.
4. Tono: consultor cercano y directo, no coach motivacional. Sin elogios vacíos.
5. Respuestas cortas y accionables (máximo 4 párrafos). Si necesita más detalle, el usuario preguntará.
6. Si pregunta algo fuera del ámbito de IA y desarrollo profesional, redirige amablemente.`;
}

module.exports = async function (context, req) {
  const headers = corsHeaders(req, {
    methods: "POST, OPTIONS",
    extra: "X-Coach-Token, X-Coach-Email",
  });

  if (req.method === "OPTIONS") { context.res = { status: 204, headers, body: "" }; return; }

  const email = (req.headers["x-coach-email"] || "").trim().toLowerCase();
  const token = req.headers["x-coach-token"] || "";

  if (!email || !validateCoachToken(token, email)) {
    context.res = { status: 401, headers, body: JSON.stringify({ error: "Sesión inválida." }) };
    return;
  }

  const body    = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const message = (body.message || "").trim();

  if (!message) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Mensaje vacío." }) };
    return;
  }

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const openaiEndpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const openaiKey        = process.env.AZURE_OPENAI_API_KEY;
  const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const openaiVersion    = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  try {
    const coachClient   = createTableClient(conn, "coachSessions");
    const resultsClient = createTableClient(conn, "assessmentResults");

    // Cargar sesión y resultado
    const session = await coachClient.getEntity(email, "session");
    let history = JSON.parse(session.chatHistory || "[]");
    const tasks = JSON.parse(session.tasks || "[]");

    let result = null;
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `email eq '${email}'` }
    })) { result = entity; break; }

    let analysis = {};
    try { analysis = JSON.parse(result?.reportAnalysis || "{}"); } catch {}

    // Construir mensajes para OpenAI
    const systemPrompt = buildSystemPrompt(result || {}, analysis, tasks);

    // Limitar historial a MAX_HISTORY mensajes
    const trimmedHistory = history.slice(-MAX_HISTORY);

    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    const url = `${openaiEndpoint.replace(/\/$/, "")}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiVersion}`;
    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": openaiKey },
      body: JSON.stringify({ messages, max_completion_tokens: 20000 })
    });

    if (!aiRes.ok) throw new Error(`Azure OpenAI error ${aiRes.status}`);
    const aiData = await aiRes.json();
    const reply  = aiData?.choices?.[0]?.message?.content || "Hubo un problema al procesar tu mensaje. Intenta de nuevo.";

    // Actualizar historial
    history.push({ role: "user",      content: message, ts: Date.now() });
    history.push({ role: "assistant", content: reply,   ts: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);

    await coachClient.updateEntity({
      partitionKey: email,
      rowKey:       "session",
      chatHistory:  JSON.stringify(history),
      lastActiveAt: new Date().toISOString(),
    }, "Merge");

    context.res = { status: 200, headers, body: JSON.stringify({ reply, history }) };

  } catch (err) {
    context.log.error("coach-chat error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error en el chat. Intenta de nuevo." }) };
  }
};
