const { TableClient, odata } = require("@azure/data-tables");
const { AzureOpenAI } = require("openai");
const { SearchClient, AzureKeyCredential } = require("@azure/search-documents");
const { v4: uuidv4 } = require("uuid");

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
    const { token, participant = {}, answers = {}, aiScores = {}, aiqResult = {}, metadata = {} } = body;

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const participantsClient = TableClient.fromConnectionString(conn, "participants");
    const resultsClient = TableClient.fromConnectionString(conn, "assessmentResults");

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


    const completedAt = metadata.completedAt || new Date().toISOString();
    const vectorId = metadata.vectorId || token?.replace(/[^a-zA-Z0-9_-]/g, '_') || uuidv4();
    const safeNumber = (value, fallback = 0) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const aiqScore = safeNumber(aiqResult.score, 0);
    const sectionA = safeNumber(aiqResult.sectionScores?.A?.avg, 0);
    const sectionB = safeNumber(aiqResult.sectionScores?.B?.avg, 0);
    const sectionC = safeNumber(aiqResult.sectionScores?.C?.avg, 0);
    const durationMinutes = metadata.durationMinutes != null ? safeNumber(metadata.durationMinutes, null) : null;

    // ESTRUCTURA DEL TEXTO PARA EMBEDDING — v2.0 (25 preguntas)
    const textToEmbed = `
      Área: ${answers.V1 || ""}
      Nivel jerárquico: ${answers.V2?.value || ""}
      Años en rol: ${answers.V3?.value || ""}
      Herramientas usadas: ${(answers.V4?.selected || []).join(", ")}
      Posición: ${participant.posicion}
      Empresa: ${participant.empresa}
      Departamento: ${participant.departamento}

      [E2 - Último entregable] ${answers.E2 || ""}
      [E3 - Reacción a error IA] ${answers.E3?.value || ""}
      [E4 - IA ante tema desconocido] ${answers.E4?.value || ""}
      [E5 - Enseñanza sobre IA] ${answers.E5 || ""}

      [B1 - Verificación datos] ${answers.B1?.value || ""}
      [B2 - Seguridad datos] ${answers.B2 || ""}
      [B3 - Casos de uso este mes] ${(answers.B3?.selected || []).join(", ")}
      [B4 - Archivos analizados] ${(answers.B4?.selected || []).join(", ")} — ${answers.B4?.text || ""}
      [B5 - Automatización] ${answers.B5 || ""}
      [B6 - IA con info empresa] ${answers.B6 || ""}

      [C1 - Prompt email cliente] ${answers.C1?.text || ""}
      [C2 - Mejora de prompt] ${answers.C2?.text || ""}
      [C3 - Prompt razonamiento] ${answers.C3?.text || ""}

      [D1 - Apoyo empresa] ${answers.D1?.value || ""} — ${answers.D1?.text || ""}
      [D2 - IA mal vista] ${answers.D2 || ""}
      [D3 - Herramientas] ${(answers.D3?.selected || []).join(", ")}
      [D4 - Herramienta que necesita] ${answers.D4 || ""}
      [D5 - Espacios compartir IA] ${answers.D5?.choice || ""} — ${answers.D5?.text || ""}
      [D6 - Políticas uso responsable] ${answers.D6 || ""}
      [D7 - No usar IA por ética] ${answers.D7 || ""}
      [D9 - Futuro del rol] ${answers.D9?.value || ""}
    `.replace(/\s+/g, ' ').trim();

    // GENERACIÓN DEL EMBEDDING 
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: "2024-12-01-preview"
    });

    let vector;
    try {
      const response = await client.embeddings.create({
        model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        input: textToEmbed,
        dimensions: 1536
      });
      vector = response.data[0].embedding;
    } catch (err) {
      if (err?.statusCode === 404 || (err?.message && err.message.includes("404"))) {
        err.message = `Deployment de embeddings no encontrado: "${process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT}". Verifica en Azure OpenAI Studio que exista un deployment con ese nombre y que tu Function App tenga la variable AZURE_OPENAI_EMBEDDING_DEPLOYMENT configurada con ese valor.`;
      }
      throw err;
    }

    // INDEXACIÓN EN VECTOR DB
    if (process.env.VECTOR_DB_ENDPOINT) {
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
        aiqLevel: aiqResult.level,
        aiqScore: Number(aiqResult.score),
        challengeProfile: aiqResult.challengeProfile,
        completedAt: completedAt,
        contentVector: vector
      }]);
    }

    // Persistencia en Table Storage
    // Partir answers en bloques para evitar el límite de 32KB de Azure Table Storage
    const answersV = JSON.stringify({ V1: answers.V1, V2: answers.V2, V3: answers.V3, V4: answers.V4 });
    const answersA = JSON.stringify({ E2: answers.E2, E3: answers.E3, E4: answers.E4, E5: answers.E5 });
    const answersB = JSON.stringify({ B1: answers.B1, B2: answers.B2, B3: answers.B3, B4: answers.B4, B5: answers.B5, B6: answers.B6 });
    const answersC = JSON.stringify({ C1: answers.C1, C2: answers.C2, C3: answers.C3 });
    const answersD = JSON.stringify({ D1: answers.D1, D2: answers.D2, D3: answers.D3, D4: answers.D4, D5: answers.D5, D6: answers.D6, D7: answers.D7, D9: answers.D9 });

    await resultsClient.upsertEntity({
      partitionKey: (participant.empresa || "General").trim(),
      rowKey: token,
      email: participant.email || "",
      nombre: participant.nombre || "",
      posicion: participant.posicion || "",
      departamento: participant.departamento || "",
      aiqScore: aiqScore,
      aiqLevel: aiqResult.level || "N/A",
      sectionA: sectionA,
      sectionB: sectionB,
      sectionC: sectionC,
      challengeProfile: aiqResult.challengeProfile || "unknown",
      alerts: JSON.stringify(aiqResult.alerts || []),
      answersV,
      answersA,
      answersB,
      answersC,
      answersD,
      aiScores: JSON.stringify(aiScores),
      vectorId,
      completedAt: completedAt,
      durationMinutes: durationMinutes
    }, "Replace");

    // ACTUALIZAR STATUS DEL PARTICIPANTE
    pEntity.status = "completed";
    pEntity.completedAt = completedAt;

    await participantsClient.updateEntity(pEntity, "Merge");
    context.res = { status: 200, body: { success: true, assessmentId: token } };

  } catch (err) {
    context.log.error("Error en persistencia vectorial:", err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};