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

    //Validar Participante
    let pEntity = null;
    const entities = participantsClient.listEntities({ filter: odata`RowKey eq ${token}` });
    for await (const e of entities) { pEntity = e; break; }
    if (!pEntity) return context.res = { status: 401, body: { error: "Token inválido" } };

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

    //ESTRUCTURA DEL TEXTO PARA EMBEDDING
    const textToEmbed = `
      Posición: ${participant.posicion}
      Empresa: ${participant.empresa}
      Departamento: ${participant.departamento}

      [E1] ${answers.E1 || ""}
      [E2 texto] ${answers.E2?.text || ""}
      [E3] ${answers.E3 || ""}
      [E4] ${answers.E4 || ""}
      [E5] ${answers.E5 || ""}
      [B1] ${answers.B1 || ""}
      [B2] ${answers.B2 || ""}
      [B3] ${answers.B3 || ""}
      [B4 texto] ${answers.B4?.text || ""}
      [B5] ${answers.B5 || ""}
      [C1 texto] ${answers.C1?.text || ""}
      [C2 texto] ${answers.C2?.text || ""}
      [C3 texto] ${answers.C3?.text || ""}
      [G1 texto] ${answers.G1?.text || ""}
    `.replace(/\s+/g, ' ').trim();

    //GENERACIÓN DEL EMBEDDING 
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

 
    //INDEXACIÓN EN VECTOR DB
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

    //Persistencia en Table Storage (según requerimientos)
    await resultsClient.upsertEntity({
      partitionKey: (participant.empresa || "General").trim(),
      rowKey: token,
      email: participant.email || "",
      nombre: participant.nombre || "",
      posicion: participant.posicion || "",
      departamento: participant.departamento || "",
      // Resultados IAQ
      aiqScore: aiqScore,
      aiqLevel: aiqResult.level || "N/A",
      sectionA: sectionA,
      sectionB: sectionB,
      sectionC: sectionC,
      challengeProfile: aiqResult.challengeProfile || "unknown",
      alerts: JSON.stringify(aiqResult.alerts || []),
      // Datos completos
      answers: JSON.stringify(answers),
      aiScores: JSON.stringify(aiScores),
      vectorId,

      // Metadatos de ejecución
      completedAt: completedAt,
      durationMinutes: durationMinutes
    }, "Replace");

    //Actualizar status del participante
    pEntity.status = "completed";
    pEntity.completedAt = completedAt;
    await participantsClient.upsertEntity(pEntity, "Merge");

    context.res = { status: 200, body: { success: true, assessmentId: token } };

  } catch (err) {
    context.log.error("Error en persistencia vectorial:", err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};