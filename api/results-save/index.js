const { TableClient, odata } = require("@azure/data-tables");
const { AzureOpenAI } = require("@azure/openai");
const { SearchClient, AzureKeyCredential } = require("@azure/search-documents");

module.exports = async function (context, req) {

  if (req.method === "OPTIONS") {
    context.res = { status: 200 };
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { token, participant = {}, answers = {}, aiScores = {}, aiqResult = {}, metadata = {} } = body;

    if (!token || !aiqResult.score) {
      context.res = { status: 400, body: { error: "Faltan datos requeridos" } };
      return;
    }

    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;

    //Validar Token de forma segura contra inyección OData
    const participantsClient = TableClient.fromConnectionString(conn, "participants");
    let pEntity = null;
    
    const entities = participantsClient.listEntities({ filter: odata`RowKey eq ${token}` });
    for await (const e of entities) {
      pEntity = e;
      break;
    }

    if (!pEntity) {
      context.res = { status: 401, body: { error: "Token inválido o no encontrado" } };
      return;
    }

    //Persistir en assessmentResults
    const resultsClient = TableClient.fromConnectionString(conn, "assessmentResults");
    const resultEntity = {
      partitionKey: (participant.empresa || "default").trim(),
      rowKey: token,
      email: participant.email || "",
      nombre: participant.nombre || "",
      posicion: participant.posicion || "",
      departamento: participant.departamento || "",
      aiqScore: Number(aiqResult.score),
      aiqLevel: aiqResult.level || "N/A",
      sectionA: Number(aiqResult.sectionScores?.A?.avg || 0),
      sectionB: Number(aiqResult.sectionScores?.B?.avg || 0),
      sectionC: Number(aiqResult.sectionScores?.C?.avg || 0),
      challengeProfile: aiqResult.challengeProfile || "unknown",
      alerts: JSON.stringify(aiqResult.alerts || []),
      answers: JSON.stringify(answers),
      aiScores: JSON.stringify(aiScores),
      vectorId: token,
      completedAt: metadata.completedAt || new Date().toISOString(),
      durationMinutes: Number(metadata.durationMinutes || 0)
    };

    await resultsClient.upsertEntity(resultEntity, "Replace");

    // 3. Generar Embedding con las respuestas abiertas correctas según el JSON
    const textToEmbed = `
      Posición: ${participant.posicion}
      Empresa: ${participant.empresa}
      Departamento: ${participant.departamento}
      [E1] ${answers.E1 || ""}
      [E2] ${answers.E2?.text || ""}
      [E3] ${answers.E3 || ""}
      [E4] ${answers.E4 || ""}
      [E5] ${answers.E5 || ""}
      [B1] ${answers.B1 || ""}
      [B2] ${answers.B2 || ""}
      [B3] ${answers.B3 || ""}
      [B4] ${answers.B4?.text || ""}
      [B5] ${answers.B5 || ""}
      [B6] ${answers.B6 || ""}
      [C1] ${answers.C1?.text || ""}
      [C2] ${answers.C2?.text || ""}
      [C3] ${answers.C3?.text || ""}
      [C4] ${answers.C4?.text || ""}
      [C5] ${answers.C5?.text || ""}
      [G1] ${answers.G1?.text || ""}
      [G2] ${answers.G2?.text || ""}
    `.replace(/\s+/g, ' ').trim(); // Compactamos para ahorrar tokens

    const openai = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY
    });

    const emb = await openai.getEmbeddings(process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT, [textToEmbed]);
    const vector = emb.data[0].embedding;

    //Indexar en Vector DB (Azure AI Search)
    const searchClient = new SearchClient(
      process.env.VECTOR_DB_ENDPOINT,
      process.env.VECTOR_COLLECTION_NAME,
      new AzureKeyCredential(process.env.VECTOR_DB_API_KEY)
    );

    await searchClient.mergeOrUploadDocuments([{
      id: token.replace(/[^a-zA-Z0-9_-]/g, '_'), // Limpiamos ID por restricciones de Search
      assessmentId: token,
      empresa: participant.empresa,
      departamento: participant.departamento,
      aiqLevel: aiqResult.level,
      aiqScore: Number(aiqResult.score),
      challengeProfile: aiqResult.challengeProfile,
      completedAt: resultEntity.completedAt,
      contentVector: vector
    }]);

    // 5. Marcar participante como completado
    pEntity.status = "completed";
    pEntity.completedAt = resultEntity.completedAt;
    await participantsClient.upsertEntity(pEntity, "Replace");

    context.res = { status: 200, body: { success: true, assessmentId: token } };

  } catch (err) {
    context.log.error("Error crítico en results-save:", err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};