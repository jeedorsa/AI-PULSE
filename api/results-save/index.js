const { TableClient } = require("@azure/data-tables");
const { AzureOpenAI } = require("@azure/openai");
const { SearchClient, AzureKeyCredential } = require("@azure/search-documents");

module.exports = async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 200 };
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    
    if (!body?.token || !body?.aiqResult?.score) {
      context.res = { status: 400, body: { error: "Faltan datos mínimos" } };
      return;
    }

    const token = body.token;
    const participant = body.participant || {};
    const answers = body.answers || {};
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;

    // 1. Validar Token
    const participantsClient = TableClient.fromConnectionString(conn, "participants");
    let pEntity = null;
    for await (const e of participantsClient.listEntities({ filter: `RowKey eq '${token}'` })) {
      pEntity = e;
      break;
    }

    if (!pEntity) {
      context.res = { status: 401, body: { error: "Token inválido" } };
      return;
    }

    // 2. Persistencia en Table Storage
    const resultsClient = TableClient.fromConnectionString(conn, "assessmentResults");
    const resultEntity = {
      partitionKey: (participant.empresa || "default").trim(),
      rowKey: token,
      email: participant.email || "",
      nombre: participant.nombre || "",
      posicion: participant.posicion || "",
      departamento: participant.departamento || "",
      aiqScore: Number(body.aiqResult.score),
      aiqLevel: body.aiqResult.level || "N/A",
      sectionA: Number(body.aiqResult.sectionScores?.A?.avg || 0),
      sectionB: Number(body.aiqResult.sectionScores?.B?.avg || 0),
      sectionC: Number(body.aiqResult.sectionScores?.C?.avg || 0),
      challengeProfile: body.aiqResult.challengeProfile || "unknown",
      alerts: JSON.stringify(body.aiqResult.alerts || []),
      answers: JSON.stringify(answers),
      aiScores: JSON.stringify(body.aiScores || {}),
      vectorId: token,
      completedAt: body.metadata?.completedAt || new Date().toISOString(),
      durationMinutes: Number(body.metadata?.durationMinutes || 0)
    };

    await resultsClient.upsertEntity(resultEntity, "Replace");

    // 3. Generar Embedding.
    const textToEmbed = `
      PERFIL:
      Posición: ${participant.posicion || "N/A"}
      Empresa: ${participant.empresa || "N/A"}
      Departamento: ${participant.departamento || "N/A"}

      SECCIÓN B - SEGURIDAD:
      [B1] ${answers.B1 || ""}
      [B2] ${answers.B2 || ""}
      [B3] ${answers.B3 || ""}
      [B4] ${answers.B4?.text || ""}
      [B5] ${answers.B5 || ""}
      [B6] ${answers.B6 || ""}

      SECCIÓN C - PROMPTING:
      [C1] ${answers.C1?.text || ""}
      [C2] ${answers.C2?.text || ""}
      [C3] ${answers.C3?.text || ""}
      [C4] ${answers.C4?.text || ""}
      [C5] ${answers.C5?.text || ""}

      SECCIÓN D/E - HERRAMIENTAS Y ESCENARIOS:
      [D1] ${answers.D1?.text || ""}
      [D2] ${answers.D2 || ""}
      [E1] ${answers.E1 || ""}
      [E2] ${answers.E2?.text || ""}
      [E3] ${answers.E3 || ""}
      [E4] ${answers.E4 || ""}
      [E5] ${answers.E5 || ""}

      SECCIÓN G - GAPS:
      [G1] ${answers.G1?.text || ""}
      [G2] ${answers.G2?.text || ""}
    `.trim(); // Compactamos espacios para ahorrar tokens

    // 4. OpenAI Embedding
    const openai = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
    });

    const emb = await openai.getEmbeddings(
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
      [textToEmbed]
    );
    const vector = emb.data[0].embedding;

    // 5. Azure AI Search
    const searchClient = new SearchClient(
      process.env.VECTOR_DB_ENDPOINT,
      process.env.VECTOR_COLLECTION_NAME,
      new AzureKeyCredential(process.env.VECTOR_DB_API_KEY)
    );

    await searchClient.mergeOrUploadDocuments([{
      id: token,
      assessmentId: token,
      empresa: participant.empresa || "N/A",
      departamento: participant.departamento || "N/A",
      aiqLevel: body.aiqResult.level || "N/A",
      aiqScore: Number(body.aiqResult.score),
      challengeProfile: body.aiqResult.challengeProfile || "unknown",
      completedAt: resultEntity.completedAt,
      contentVector: vector
    }]);

    // 6. Finalizar
    pEntity.status = "completed";
    pEntity.completedAt = resultEntity.completedAt;
    await participantsClient.upsertEntity(pEntity, "Replace");

    context.res = {
      status: 200,
      body: { success: true, assessmentId: token }
    };

  } catch (err) {
    context.log.error("Error crítico:", err.message);
    context.res = { status: 500, body: { error: err.message } };
  }
};