const { TableClient, odata } = require("@azure/data-tables");
const { AzureOpenAI } = require("openai");
const { SearchClient, AzureKeyCredential } = require("@azure/search-documents");

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

    //Persistencia en Table Storage
    await resultsClient.upsertEntity({
      partitionKey: (participant.empresa || "General").trim(),
      rowKey: token,
      email: participant.email || "",
      nombre: participant.nombre || "",
      posicion: participant.posicion || "",
      departamento: participant.departamento || "",
      aiqScore: Number(aiqResult.score),
      aiqLevel: aiqResult.level || "N/A",
      challengeProfile: aiqResult.challengeProfile || "unknown",
      answers: JSON.stringify(answers),
      aiScores: JSON.stringify(aiScores),
      completedAt: completedAt
    }, "Replace");

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

    const response = await client.embeddings.create({
      model: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
      input: textToEmbed
    });
    
    const vector = response.data[0].embedding;
 
    //INDEXACIÓN EN VECTOR DB (Azure AI Search)
    if (process.env.VECTOR_DB_ENDPOINT) {
      const searchClient = new SearchClient(
        process.env.VECTOR_DB_ENDPOINT,
        process.env.VECTOR_COLLECTION_NAME,
        new AzureKeyCredential(process.env.VECTOR_DB_API_KEY)
      );

      await searchClient.mergeOrUploadDocuments([{
        id: token.replace(/[^a-zA-Z0-9_-]/g, '_'),
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

    //Actualizar status del participante
    pEntity.status = "completed";
    pEntity.completedAt = completedAt;
    await participantsClient.upsertEntity(pEntity, "Replace");

    context.res = { status: 200, body: { success: true, assessmentId: token } };

  } catch (err) {
    context.log.error("Error en persistencia vectorial:", err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};