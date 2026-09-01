const { createTableClient } = require("../shared/tableClient");
const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");
const { requireAdmin } = require("../shared/adminAuth");
const { corsHeaders } = require("../shared/cors");

module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "POST, OPTIONS", extra: "X-Admin-Token" });

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  if (!requireAdmin(context, req)) return;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "AZURE_STORAGE_CONNECTION_STRING no configurada" }) };
    return;
  }

  try {
    // Parse the uploaded file - accept base64 JSON or raw binary
    let bodyBuffer;
    if (req.headers["content-type"] && req.headers["content-type"].includes("application/json")) {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || !body.fileData) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: "No se recibió el archivo. Envía fileData en base64." }) };
        return;
      }
      bodyBuffer = Buffer.from(body.fileData, "base64");
    } else {
      bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    }

    const workbook = XLSX.read(bodyBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows || rows.length === 0) {
      context.res = { status: 400, headers, body: JSON.stringify({ error: "El archivo está vacío o no tiene el formato correcto" }) };
      return;
    }

    // Validate required columns
    const firstRow = rows[0];
    const requiredColumns = ["email", "nombre", "posicion", "empresa", "departamento"];
    const missingColumns = requiredColumns.filter(col => {
      // Check case-insensitive
      return !Object.keys(firstRow).some(k => k.toLowerCase().trim() === col);
    });

    if (missingColumns.length > 0) {
      context.res = {
        status: 400,
        headers,
        body: JSON.stringify({ error: `Columnas faltantes en el Excel: ${missingColumns.join(", ")}` })
      };
      return;
    }

    // Create table if it doesn't exist
    const tableClient = createTableClient(connectionString, "participants");
    try {
      await tableClient.createTable();
    } catch (e) {
      // Table already exists - that's fine
      if (e.statusCode !== 409) throw e;
    }

    const participants = [];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    for (const row of rows) {
      // Normalize column names (case-insensitive)
      const normalizedRow = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[key.toLowerCase().trim()] = value;
      }

      const email = String(normalizedRow.email || "").trim().toLowerCase();
      if (!email) continue;

      const token = uuidv4();

      const entity = {
        partitionKey: String(normalizedRow.empresa || "default").trim(),
        rowKey: email,
        email: email,
        nombre: String(normalizedRow.nombre || "").trim(),
        posicion: String(normalizedRow.posicion || "").trim(),
        empresa: String(normalizedRow.empresa || "").trim(),
        departamento: String(normalizedRow.departamento || "").trim(),
        token: token,
        tokenExpiresAt: expiresAt.toISOString(),
        status: "pending",
        createdAt: now.toISOString()
      };

      // Upsert - if participant already exists, update their token
      await tableClient.upsertEntity(entity, "Replace");

      participants.push({
        email: entity.email,
        nombre: entity.nombre,
        posicion: entity.posicion,
        empresa: entity.empresa,
        departamento: entity.departamento,
        status: entity.status
      });
    }

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        message: `${participants.length} participantes procesados`,
        participants
      })
    };

  } catch (err) {
    context.log.error("participants/upload error:", err);
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: "Error al procesar el archivo: " + err.message })
    };
  }
};
