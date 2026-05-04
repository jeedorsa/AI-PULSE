const { BlobServiceClient } = require("@azure/storage-blob");
const { requireAdmin } = require("../shared/adminAuth");
const XLSX = require("xlsx");

const CONTAINER = "company-data";

function getContainer(conn) {
  return BlobServiceClient.fromConnectionString(conn).getContainerClient(CONTAINER);
}

// ── Parsers por tipo de archivo ─────────────────────────────────────────────

function parseMaestro(workbook) {
  // La hoja tiene 2 filas de encabezado: fila 1 = grupos, fila 2 = columnas reales
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Fila 2 (índice 1) = headers: #, Nombre, Correo, Empresa, Área, Sucursal, Cargo, Nivel, Director CAN, ...
  const headers = rows[1];
  const idx = {
    nombre:       headers.indexOf("Nombre"),
    email:        headers.indexOf("Correo"),
    empresa:      headers.indexOf("Empresa"),
    area:         headers.indexOf("Área"),
    sucursal:     headers.indexOf("Sucursal"),
    cargo:        headers.indexOf("Cargo"),
    nivel:        headers.indexOf("Nivel"),
    directorCan:  headers.indexOf("Director CAN"),
  };

  const data = {};
  let count = 0;
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    const email = (r[idx.email] || "").toString().toLowerCase().trim();
    if (!email || !email.includes("@")) continue;
    data[email] = {
      nombre:      (r[idx.nombre]    || "").toString().trim(),
      cargo:       (r[idx.cargo]     || "").toString().trim(),
      empresa:     (r[idx.empresa]   || "").toString().trim(),
      area:        (r[idx.area]      || "").toString().trim(),
      sucursal:    (r[idx.sucursal]  || "").toString().trim(),
      nivel:       (r[idx.nivel]     || "").toString().trim(),
      director_can: !!(r[idx.directorCan]),
    };
    count++;
  }
  return { data, count };
}

function parseCopilot(workbook) {
  // Sheet "Report" tiene datos pre-agregados: col B = UserId, col C = Count of accesses
  // Fila 4 (índice 3) = headers, datos desde fila 5 (índice 4)
  const ws = workbook.Sheets["Report"] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Buscar fila de encabezados (contiene "UserId")
  let dataStart = 4;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i] && rows[i].some(c => c && c.toString().toLowerCase().includes("userid"))) {
      dataStart = i + 1;
      break;
    }
  }

  const data = {};
  let totalCount = 0;
  for (let i = dataStart; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const email = (r[1] || "").toString().toLowerCase().trim();
    const count = parseInt(r[2]) || 0;
    if (!email || !email.includes("@")) continue;
    data[email] = { count, activo: count >= 5 };
    totalCount += count;
  }
  return { data, count: totalCount, users: Object.keys(data).length };
}

// ── Handler ─────────────────────────────────────────────────────────────────

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const { tipo, filename, data: base64 } = req.body || {};
  if (!tipo || !base64) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "tipo y data son requeridos" }) };
    return;
  }
  if (!["maestro", "copilot", "otro"].includes(tipo)) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "tipo debe ser maestro | copilot | otro" }) };
    return;
  }

  try {
    // Decodificar base64 → buffer → workbook
    // Para copilot solo parsear la hoja "Report" (evita leer 242k filas de "Data")
    const buffer = Buffer.from(base64, "base64");
    const xlsxOpts = tipo === "copilot"
      ? { type: "buffer", sheets: "Report" }
      : { type: "buffer" };
    const workbook = XLSX.read(buffer, xlsxOpts);

    let parsed;
    switch (tipo) {
      case "maestro":  parsed = parseMaestro(workbook);  break;
      case "copilot":  parsed = parseCopilot(workbook);  break;
      case "otro":
        // Para "otro": guardar la primera hoja como array de objetos genérico
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
        parsed = { data: rows, count: rows.length };
        break;
    }

    const meta = {
      tipo,
      filename: filename || `${tipo}.xlsx`,
      uploadedAt: new Date().toISOString(),
      count: parsed.count,
      ...(parsed.users !== undefined ? { users: parsed.users } : {}),
    };

    const containerClient = getContainer(conn);
    await containerClient.createIfNotExists();

    // Guardar datos
    const dataBlob = containerClient.getBlockBlobClient(`${tipo}.json`);
    const payload = JSON.stringify({ ...meta, data: parsed.data });
    await dataBlob.upload(payload, Buffer.byteLength(payload), {
      blobHTTPHeaders: { blobContentType: "application/json" },
      overwrite: true,
    });

    context.log.info(`company-upload: ${tipo} subido — ${parsed.count} registros`);
    context.res = { status: 200, headers, body: JSON.stringify({ success: true, ...meta }) };

  } catch (err) {
    context.log.error("company-upload error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
