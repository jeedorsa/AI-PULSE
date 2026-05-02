const { BlobServiceClient } = require("@azure/storage-blob");
const { requireAdmin } = require("../shared/adminAuth");

const CONTAINER = "company-data";
const TIPOS = ["maestro", "copilot", "otro"];

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  if (!requireAdmin(context, req)) return;

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Storage no configurado" }) };
    return;
  }

  try {
    const containerClient = BlobServiceClient
      .fromConnectionString(conn)
      .getContainerClient(CONTAINER);

    const files = {};
    for (const tipo of TIPOS) {
      try {
        const blob = containerClient.getBlockBlobClient(`${tipo}.json`);
        const props = await blob.getProperties();
        // Leer solo los primeros 500 bytes para obtener la metadata (inicio del JSON)
        const download = await blob.download(0, 500);
        const chunks = [];
        for await (const chunk of download.readableStreamBody) chunks.push(chunk);
        const preview = Buffer.concat(chunks).toString("utf-8");
        // Extraer campos de meta sin parsear todo el archivo (puede ser grande)
        const uploadedAt = preview.match(/"uploadedAt":"([^"]+)"/)?.[1] || null;
        const count      = preview.match(/"count":(\d+)/)?.[1] || null;
        const users      = preview.match(/"users":(\d+)/)?.[1] || null;
        const filename   = preview.match(/"filename":"([^"]+)"/)?.[1] || null;
        files[tipo] = {
          exists: true,
          uploadedAt,
          count: count ? parseInt(count) : null,
          ...(users ? { users: parseInt(users) } : {}),
          filename,
          size: props.contentLength,
        };
      } catch {
        files[tipo] = { exists: false };
      }
    }

    context.res = { status: 200, headers, body: JSON.stringify({ files }) };
  } catch (err) {
    context.log.error("company-files-list error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
