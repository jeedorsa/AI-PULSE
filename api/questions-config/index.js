const { BlobServiceClient } = require("@azure/storage-blob");
const { requireAdmin } = require("../shared/adminAuth");

const CONTAINER = "config";
const BLOB_NAME = "questions.json";

function getBlobClient() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("AZURE_STORAGE_CONNECTION_STRING no configurada");
  return BlobServiceClient
    .fromConnectionString(conn)
    .getContainerClient(CONTAINER)
    .getBlockBlobClient(BLOB_NAME);
}

async function readConfig() {
  const client = getBlobClient();
  try {
    const buf = await client.downloadToBuffer();
    return JSON.parse(buf.toString("utf8"));
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function writeConfig(payload) {
  const client = getBlobClient();
  await client.getContainerClient?.().createIfNotExists?.();
  const containerClient = BlobServiceClient
    .fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING)
    .getContainerClient(CONTAINER);
  await containerClient.createIfNotExists();
  const body = JSON.stringify(payload);
  await client.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: "application/json" },
    overwrite: true,
  });
}

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  try {
    if (req.method === "GET") {
      const config = await readConfig();
      context.res = {
        status: 200,
        headers,
        body: JSON.stringify(config || { questions: null, updatedAt: null }),
      };
      return;
    }

    if (req.method === "POST") {
      if (!requireAdmin(context, req)) return;
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      if (!Array.isArray(body.questions)) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: "questions debe ser array" }) };
        return;
      }
      const payload = {
        questions: body.questions,
        updatedAt: new Date().toISOString(),
      };
      await writeConfig(payload);
      context.res = { status: 200, headers, body: JSON.stringify({ success: true, count: body.questions.length, updatedAt: payload.updatedAt }) };
      return;
    }

    context.res = { status: 405, headers, body: JSON.stringify({ error: "Método no permitido" }) };
  } catch (err) {
    context.log.error("questions-config error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
