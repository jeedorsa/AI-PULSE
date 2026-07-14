const { AzureOpenAI } = require("openai");
const { SearchClient, AzureKeyCredential } = require("@azure/search-documents");
const { EmailClient } = require("@azure/communication-email");
const { v4: uuidv4 } = require("uuid");
const { createTableClient } = require("../shared/tableClient");
const { evaluateAssessment } = require("../shared/aiqEvaluatorV5");

// Esquema público exacto del resultado (ver plan): nombre/email/empresa/nivel/
// puntaje/A/B/C/flags/recomendaciones_ids. rubricVersion/perQuestionLevels son
// detalle interno de persistencia/auditoría, no se exponen en la respuesta.
function publicResultado(r) {
  return {
    nombre: r.nombre || "",
    email: r.email || "",
    empresa: r.empresa || "",
    nivel: r.nivel,
    puntaje: r.puntaje,
    A: r.A,
    B: r.B,
    C: r.C,
    flags: r.flags,
    recomendaciones_ids: r.recomendaciones_ids,
  };
}

function resultadoFromEntity(entity) {
  return publicResultado({
    nombre: entity.nombre,
    email: entity.email,
    empresa: entity.partitionKey,
    nivel: entity.aiqLevel,
    puntaje: entity.aiqScore,
    A: entity.sectionA,
    B: entity.sectionB,
    C: entity.sectionC,
    flags: JSON.parse(entity.alerts || "[]"),
    recomendaciones_ids: JSON.parse(entity.recomendacionesIds || "[]"),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Si dos requests concurrentes llegan con el mismo token (doble submit del
// frontend, reintento de red) antes de que la primera evaluación termine de
// persistir, el check de idempotencia por rubricVersion no alcanza a verlas
// — ambas dispararían 8 llamadas LLM cada una. Este lock usa createEntity
// (falla con 409 si la fila ya existe) como primitiva atómica para que solo
// una gane el derecho a evaluar; la otra espera a que la ganadora termine.
const LOCK_STALE_MS = 120000;
const LOCK_POLL_MS = 1500;

async function acquireEvalLock(resultsClient, partitionKey, token) {
  try {
    await resultsClient.createEntity({
      partitionKey,
      rowKey: token,
      status: "evaluating",
      lockedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    if (err.statusCode === 409) return false;
    throw err;
  }
}

module.exports = async function (context, req) {
  // Manejo de CORS
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    };
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { token, participant = {}, answers = {}, metadata = {} } = body;

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const participantsClient = createTableClient(conn, "participants");
    const resultsClient = createTableClient(conn, "assessmentResults");

    // ──────────────────────────────────────────────────────────────
    // Validar y obtener el participante EXACTO usando PartitionKey + RowKey
    // PartitionKey = empresa, RowKey = email
    // ──────────────────────────────────────────────────────────────
    const partitionKey = (participant.empresa || "General").trim();
    const rowKey = participant.email?.trim();

    if (!rowKey) {
      return context.res = { status: 400, body: { error: "Falta el email del participante en el request" } };
    }

    let pEntity;
    try {
      pEntity = await participantsClient.getEntity(partitionKey, rowKey);
    } catch (err) {
      if (err.statusCode === 404) {
        return context.res = { status: 401, body: { error: "Participante no encontrado o token inválido" } };
      }
      context.log.error("Error al obtener participante:", err.message);
      throw err;
    }

    // ──────────────────────────────────────────────────────────────
    // IDEMPOTENCIA + LOCK: si este token ya fue evaluado bajo la rúbrica v5,
    // no se vuelve a evaluar (el LLM no es determinista entre corridas) —
    // se devuelve el resultado ya persistido, sin repetir efectos
    // secundarios (email, encolado de informe, embeddings). Si otra request
    // concurrente para el mismo token está evaluando en este momento, se
    // espera su resultado en vez de disparar 8 llamadas LLM duplicadas.
    // ──────────────────────────────────────────────────────────────
    const gotLock = await acquireEvalLock(resultsClient, partitionKey, token);

    if (!gotLock) {
      let existing = await resultsClient.getEntity(partitionKey, token);
      const deadline = Date.now() + LOCK_STALE_MS;
      while (existing.status === "evaluating" && Date.now() < deadline) {
        await sleep(LOCK_POLL_MS);
        existing = await resultsClient.getEntity(partitionKey, token);
      }

      if (existing.rubricVersion === "v5") {
        return context.res = {
          status: 200,
          body: { success: true, assessmentId: token, resultado: resultadoFromEntity(existing) }
        };
      }

      // Lock obsoleto (la evaluación anterior nunca terminó de escribir, ej.
      // crash del proceso) — lo tomamos nosotros y seguimos con el flujo normal.
      // IMPORTANTE: partimos de {...existing} (no de un objeto pelado) porque
      // "existing" puede ser una fila real con datos históricos, no solo un
      // lock vacío — con "Replace" y un objeto bare se borraban esos datos
      // antes de siquiera empezar a evaluar de nuevo. Se limpian los metadatos
      // de solo lectura que devuelve el SDK (mismo patrón que migrateToV5.js).
      // OPTIMISTIC LOCK: preservamos el etag de `existing` y lo pasamos al
      // updateEntity. Si en el ínterin (entre el último poll y este Replace)
      // otro proceso escribió la fila — típicamente porque estaba corriendo
      // legítimamente y terminó de evaluar justo después de que expirara
      // nuestro deadline — Table Storage devuelve 412 PreconditionFailed y
      // NO sobreescribimos los datos válidos que el otro dejó. En ese caso
      // releemos, verificamos si ya es v5 (return cached) y si sigue sin
      // serlo, reintentamos el take-over con el etag nuevo.
      const MAX_TAKEOVER_ATTEMPTS = 3;
      for (let attempt = 0; attempt < MAX_TAKEOVER_ATTEMPTS; attempt++) {
        const preserved = { ...existing };
        const priorEtag = existing.etag;
        delete preserved.etag;
        delete preserved.timestamp;
        delete preserved["odata.metadata"];
        try {
          await resultsClient.updateEntity(
            { ...preserved, partitionKey, rowKey: token, status: "evaluating", lockedAt: new Date().toISOString() },
            "Replace",
            { etag: priorEtag }
          );
          break;
        } catch (err) {
          if (err.statusCode !== 412) throw err;
          // Otro proceso ganó la carrera y actualizó la fila. Releer y decidir.
          existing = await resultsClient.getEntity(partitionKey, token);
          if (existing.rubricVersion === "v5") {
            return context.res = {
              status: 200,
              body: { success: true, assessmentId: token, resultado: resultadoFromEntity(existing) }
            };
          }
          // Sigue sin ser v5 (legacy re-lockeado, o crash en cadena) — reintentar.
          if (attempt === MAX_TAKEOVER_ATTEMPTS - 1) throw err;
        }
      }
    }

    const completedAt = metadata.completedAt || new Date().toISOString();
    const vectorId = metadata.vectorId || token?.replace(/[^a-zA-Z0-9_-]/g, '_') || uuidv4();
    const safeNumber = (value, fallback = 0) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };
    const durationMinutes = metadata.durationMinutes != null ? safeNumber(metadata.durationMinutes, null) : null;

    // ──────────────────────────────────────────────────────────────
    // EVALUACIÓN AIQ — rúbrica v5 (motor server-side, ver api/shared/aiqEvaluatorV5.js)
    // ──────────────────────────────────────────────────────────────
    const resultado = await evaluateAssessment(answers, {
      nombre: participant.nombre || "",
      email: participant.email || "",
      empresa: partitionKey,
    });

    // ESTRUCTURA DEL TEXTO PARA EMBEDDING — Inchcape v1.0
    const textToEmbed = `
      Autopercepción IA: ${answers.V1?.value || ""}
      Herramientas exploradas: ${(answers.V2?.selected || []).join(", ")}
      Barreras para usar IA: ${(answers.V3?.selected || []).join(", ")}
      Superpoderes elegidos: ${(answers.V4?.selected || []).join(", ")}
      Posición: ${participant.posicion}
      Empresa: ${participant.empresa}
      Departamento: ${participant.departamento}

      [E2 - Último entregable] ${answers.E2 || ""}
      [E3 - Reacción a resultado incorrecto] ${answers.E3 || ""}
      [E5 - Compartió sobre IA] ${answers.E5 || ""}
      [E6 - Qué es un agente de IA] ${answers.E6 || ""}

      [B1 - Cómo verifica datos IA] ${answers.B1?.value || ""}
      [B2 - Info que no compartiría con IA] ${answers.B2 || ""}
      [B4 - Uso multimodal] ${answers.B4 || ""}

      [C1 - Prompt vehículo con retraso] ${answers.C1?.text || ""}
      [C2 - Mejora de prompt] ${answers.C2?.text || ""}
      [C3 - Prompt con razonamiento] ${answers.C3?.text || ""}

      [D1 - Apoyo jefe directo] ${answers.D1?.value || ""}
      [D1b - Apoyo ${participant.empresa} como empresa] ${answers.D1b?.value || ""}
      [D2 - IA generó desconfianza] ${answers.D2 || ""}
      [D4 - Herramienta que necesita] ${answers.D4 || ""}
      [D5 - Espacios compartir IA en ${participant.empresa}] ${answers.D5?.choice || ""} — ${answers.D5?.text || ""}
      [D6 - Conoce política oficial de IA] ${answers.D6?.value || ""}
      [D7 - No usar IA por ética] ${answers.D7 || ""}
      [D9 - Futuro del rol] ${answers.D9?.value || ""}
    `.replace(/\s+/g, ' ').trim();

    // GENERACIÓN DEL EMBEDDING (best-effort — solo si Vector DB está activo)
    let vector;
    if (process.env.VECTOR_DB_ENDPOINT) {
      try {
        const client = new AzureOpenAI({
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
          apiKey: process.env.AZURE_OPENAI_API_KEY,
          apiVersion: "2024-12-01-preview"
        });
        const response = await client.embeddings.create({
          model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
          input: textToEmbed,
          dimensions: 1536
        });
        vector = response.data[0].embedding;
      } catch (err) {
        context.log.warn("Embedding generation failed (continuing without vector):", err.message);
      }
    }

    // INDEXACIÓN EN VECTOR DB (best-effort — no debe bloquear el guardado del result)
    if (process.env.VECTOR_DB_ENDPOINT) {
      try {
        const searchClient = new SearchClient(
          process.env.VECTOR_DB_ENDPOINT,
          process.env.VECTOR_COLLECTION_NAME,
          new AzureKeyCredential(process.env.VECTOR_DB_API_KEY)
        );

        await searchClient.mergeOrUploadDocuments([{
          id: vectorId,
          assessmentId: token,
          empresa: participant.empresa,
          departamento: participant.departamento,
          aiqLevel: resultado.nivel,
          aiqScore: Number(resultado.puntaje),
          completedAt: completedAt,
          contentVector: vector
        }]);
      } catch (vectorErr) {
        context.log.warn("Vector DB indexing failed (continuing without index):", vectorErr.message);
      }
    }

    // Persistencia en Table Storage
    // Partir answers en bloques para evitar el límite de 32KB de Azure Table Storage
    const answersV = JSON.stringify({ V1: answers.V1, V2: answers.V2, V3: answers.V3, V4: answers.V4 });
    const answersA = JSON.stringify({ E2: answers.E2, E3: answers.E3, E5: answers.E5, E6: answers.E6 });
    const answersB = JSON.stringify({ B1: answers.B1, B2: answers.B2, B4: answers.B4 });
    const answersC = JSON.stringify({ C1: answers.C1, C2: answers.C2, C3: answers.C3 });
    const answersD = JSON.stringify({ D1: answers.D1, D1b: answers.D1b, D2: answers.D2, D4: answers.D4, D5: answers.D5, D6: answers.D6, D7: answers.D7, D9: answers.D9 });

    await resultsClient.upsertEntity({
      partitionKey: (participant.empresa || "General").trim(),
      rowKey: token,
      email: participant.email || "",
      nombre: participant.nombre || "",
      posicion: participant.posicion || "",
      departamento: participant.departamento || "",
      aiqScore: resultado.puntaje,
      aiqLevel: resultado.nivel,
      sectionA: resultado.A,
      sectionB: resultado.B,
      sectionC: resultado.C,
      alerts: JSON.stringify(resultado.flags),
      recomendacionesIds: JSON.stringify(resultado.recomendaciones_ids),
      rubricVersion: "v5",
      answersV,
      answersA,
      answersB,
      answersC,
      answersD,
      vectorId,
      completedAt: completedAt,
      durationMinutes: durationMinutes
    }, "Replace");

    // ACTUALIZAR STATUS DEL PARTICIPANTE
    pEntity.status = "completed";
    pEntity.completedAt = completedAt;

    await participantsClient.updateEntity(pEntity, "Merge");

    // NOTIFICACIÓN DE EMAIL AL ADMIN (non-blocking)
    try {
      const emailConnStr = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
      const senderAddress = process.env.EMAIL_SENDER_ADDRESS || "DoNotReply@aipulse.com";

      if (emailConnStr && adminEmail) {
        const emailClient = new EmailClient(emailConnStr);
        const scoreStr = resultado.puntaje.toFixed ? resultado.puntaje.toFixed(2) : resultado.puntaje;
        await emailClient.beginSend({
          senderAddress,
          recipients: { to: [{ address: adminEmail }] },
          content: {
            subject: `AI Pulse — Nueva encuesta completada: ${participant.nombre || participant.email}`,
            plainText: `Una nueva encuesta ha sido completada.\n\nParticipante: ${participant.nombre || ""}\nEmail: ${participant.email || ""}\nEmpresa: ${participant.empresa || ""}\nPosición: ${participant.posicion || ""}\nDepartamento: ${participant.departamento || ""}\n\nAIQ Score: ${scoreStr}\nNivel AIQ: ${resultado.nivel}\n\nCompletado el: ${completedAt}`,
            html: `<p>Una nueva encuesta ha sido completada.</p><table style="font-family:sans-serif;font-size:14px;border-collapse:collapse"><tr><td style="padding:4px 12px 4px 0;color:#666">Participante</td><td style="padding:4px 0"><strong>${participant.nombre || ""}</strong></td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td style="padding:4px 0">${participant.email || ""}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">Empresa</td><td style="padding:4px 0">${participant.empresa || ""}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">Posición</td><td style="padding:4px 0">${participant.posicion || ""}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">Departamento</td><td style="padding:4px 0">${participant.departamento || ""}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">AIQ Score</td><td style="padding:4px 0"><strong style="color:#FE3C1C">${scoreStr}</strong></td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">Nivel AIQ</td><td style="padding:4px 0">${resultado.nivel}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666">Completado</td><td style="padding:4px 0">${new Date(completedAt).toLocaleString("es-CL")}</td></tr></table>`
          }
        });
        context.log.info(`Admin notification sent to ${adminEmail} for ${participant.email}`);
      }
    } catch (emailErr) {
      context.log.warn("Admin email notification failed (non-blocking):", emailErr.message);
    }

    // ENCOLAR GENERACIÓN DE INFORME (non-blocking)
    try {
      const { QueueServiceClient } = require("@azure/storage-queue");
      const isHttp = /^DefaultEndpointsProtocol=http;/i.test(conn || "");
      const queueClient = QueueServiceClient
        .fromConnectionString(conn, isHttp ? { allowInsecureConnection: true } : undefined)
        .getQueueClient("report-generation");
      await queueClient.createIfNotExists();
      const msgPayload = Buffer.from(JSON.stringify({
        email: participant.email,
        empresa: (participant.empresa || "General").trim(),
        token
      })).toString("base64");
      await queueClient.sendMessage(msgPayload);
      context.log.info(`Enqueued report generation for ${participant.email}`);
    } catch (qErr) {
      context.log.warn("Queue enqueue failed (non-blocking):", qErr.message);
    }

    context.res = { status: 200, body: { success: true, assessmentId: token, resultado: publicResultado(resultado) } };

  } catch (err) {
    context.log.error("Error en persistencia vectorial:", err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};
