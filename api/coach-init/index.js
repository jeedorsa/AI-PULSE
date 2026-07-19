const { createTableClient } = require("../shared/tableClient");
const { corsHeaders } = require("../shared/cors");
const { validateSessionToken, requireSessionSecret } = require("../shared/sessionAuth");

/**
 * POST /api/coach-init
 * Headers: X-Coach-Token + X-Coach-Email
 *
 * Genera el plan inicial del coach (3 tareas personalizadas).
 * Usa el reportAnalysis guardado cuando se generó el informe.
 * Si las tareas ya existen, las devuelve directamente.
 */

module.exports = async function (context, req) {
  const headers = corsHeaders(req, {
    methods: "POST, OPTIONS",
    extra: "X-Coach-Token, X-Coach-Email",
  });

  if (req.method === "OPTIONS") { context.res = { status: 204, headers, body: "" }; return; }

  const email = (req.headers["x-coach-email"] || "").trim().toLowerCase();
  const token = req.headers["x-coach-token"] || "";

  if (!requireSessionSecret(context, headers)) return;
  if (!email || !validateSessionToken(token, email)) {
    context.res = { status: 401, headers, body: JSON.stringify({ error: "Sesión inválida." }) };
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

    // Cargar sesión
    const session = await coachClient.getEntity(email, "session");
    const existingTasks = JSON.parse(session.tasks || "[]");

    // Si ya hay tareas, devolverlas directamente
    if (existingTasks.length > 0) {
      context.res = { status: 200, headers, body: JSON.stringify({ tasks: existingTasks }) };
      return;
    }

    // Buscar resultado y reportAnalysis (RowKey es el token, email es un campo)
    let result = null;
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `email eq '${email}'` }
    })) { result = entity; break; }

    if (!result) throw new Error("Resultado no encontrado");

    let analysis = {};
    try { analysis = JSON.parse(result.reportAnalysis || "{}"); } catch {}

    const nombre   = result.nombre || email;
    const nivel    = result.aiqLevel || "L2";
    const sectionA = result.sectionA || 0;
    const sectionB = result.sectionB || 0;
    const sectionC = result.sectionC || 0;
    const posicion = result.posicion || "";
    const empresa  = result.partitionKey || "";
    const escalaMax = result.rubricVersion === "v5" ? 4 : 5;

    const prompt = `Eres el coach de AI Pulse. Genera exactamente 3 tareas de desarrollo personalizadas para este participante, basadas en su diagnóstico AIQ real.

PARTICIPANTE:
- Nombre: ${nombre}
- Cargo: ${posicion}
- Empresa: ${empresa}
- Nivel AIQ: ${nivel}
- Bloque A (Experiencia Real): ${sectionA.toFixed(2)} / ${escalaMax}.0
- Bloque B (Criterio Técnico): ${sectionB.toFixed(2)} / ${escalaMax}.0
- Bloque C (Laboratorio): ${sectionC.toFixed(2)} / ${escalaMax}.0

ANÁLISIS DEL INFORME:
- Fortalezas: ${JSON.stringify(analysis.fortalezas || [])}
- Oportunidades: ${JSON.stringify(analysis.oportunidades || [])}
- Gaps: ${JSON.stringify(analysis.gaps || [])}
- Brecha crítica: ${analysis.brecha_critica || ""}

INSTRUCCIÓN:
Genera exactamente 3 tareas. Prioriza la dimensión más débil. Cada tarea debe ser concreta, accionable y hacer en máximo 1 semana. No genérica.

Responde SOLO con JSON válido:
[
  {
    "id": "t1",
    "titulo": "Título corto y directo (max 8 palabras)",
    "descripcion": "Qué hacer exactamente. 2-3 oraciones. Menciona el cargo o empresa si aplica.",
    "dimension": "A" o "B" o "C",
    "completada": false
  },
  { "id": "t2", ... },
  { "id": "t3", ... }
]`;

    const url = `${openaiEndpoint.replace(/\/$/, "")}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiVersion}`;
    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": openaiKey },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "Eres el coach de AI Pulse. Respondes SOLO con JSON válido, sin markdown." },
          { role: "user", content: prompt }
        ],
        max_completion_tokens: 20000
      })
    });

    if (!aiRes.ok) throw new Error(`Azure OpenAI error ${aiRes.status}`);
    const aiData = await aiRes.json();
    const rawText = aiData?.choices?.[0]?.message?.content || "[]";
    const tasks = JSON.parse(rawText.replace(/```json|```/g, "").trim());

    // Persistir tareas
    await coachClient.updateEntity({
      partitionKey: email,
      rowKey: "session",
      tasks: JSON.stringify(tasks),
    }, "Merge");

    context.res = { status: 200, headers, body: JSON.stringify({ tasks }) };

  } catch (err) {
    context.log.error("coach-init error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error generando tu plan. Intenta de nuevo." }) };
  }
};
