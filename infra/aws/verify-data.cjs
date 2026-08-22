#!/usr/bin/env node
/**
 * verify-data.cjs — Compara origen y destino tras la migración.
 *
 * Verifica conteos, claves y el contenido de cada propiedad de cada fila, y el
 * contenido byte a byte de cada blob. Es de solo lectura sobre ambos lados.
 *
 *   SRC_CONN=... DST_CONN=... node verify-data.cjs
 */
const path = require("path");
const crypto = require("crypto");
const { createRequire } = require("module");

const apiRequire = createRequire(path.resolve(__dirname, "../../api/package.json"));
const { TableClient } = apiRequire("@azure/data-tables");
const { BlobServiceClient } = apiRequire("@azure/storage-blob");

const TABLAS = ["assessmentProgress", "assessmentResults", "coachSessions", "companies", "participants", "waitlist"];
const CONTENEDORES = ["aiq-reports", "company-data", "config"];

const SRC = process.env.SRC_CONN;
const DST = process.env.DST_CONN;

const cliente = (conn, t) => TableClient.fromConnectionString(conn, t);

/** Huella estable de una fila, ignorando los campos que gestiona el servicio. */
function huella(entidad) {
  const { etag, timestamp, ...resto } = entidad;
  delete resto["odata.etag"];
  delete resto["odata.metadata"];
  const norm = {};
  for (const k of Object.keys(resto).sort()) {
    const v = resto[k];
    norm[k] = v instanceof Date ? v.toISOString() : v;
  }
  return crypto.createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

async function leerTabla(conn, t) {
  const m = new Map();
  for await (const e of cliente(conn, t).listEntities()) {
    m.set(e.partitionKey + " | " + e.rowKey, huella(e));
  }
  return m;
}

async function hashBlobs(conn, contenedor) {
  const m = new Map();
  const cc = BlobServiceClient.fromConnectionString(conn).getContainerClient(contenedor);
  if (!(await cc.exists())) return m;
  for await (const b of cc.listBlobsFlat()) {
    const d = await cc.getBlockBlobClient(b.name).download();
    const trozos = [];
    for await (const x of d.readableStreamBody) trozos.push(x);
    m.set(b.name, crypto.createHash("sha256").update(Buffer.concat(trozos)).digest("hex"));
  }
  return m;
}

(async () => {
  console.log("=== Verificacion origen vs destino ===");
  console.log("");
  let problemas = 0;

  for (const t of TABLAS) {
    const [a, b] = await Promise.all([leerTabla(SRC, t), leerTabla(DST, t)]);
    const faltan = [...a.keys()].filter((k) => !b.has(k));
    const sobran = [...b.keys()].filter((k) => !a.has(k));
    const difieren = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
    const ok = faltan.length === 0 && sobran.length === 0 && difieren.length === 0;
    if (!ok) problemas++;
    const detalle = ok
      ? "IDENTICAS"
      : "faltan=" + faltan.length + " sobran=" + sobran.length + " difieren=" + difieren.length;
    console.log("  " + t.padEnd(20) + " origen=" + String(a.size).padStart(5) + " destino=" + String(b.size).padStart(5) + "  " + detalle);
    for (const k of [...faltan, ...difieren].slice(0, 3)) console.log("      ! " + k);
  }

  console.log("");
  for (const c of CONTENEDORES) {
    const [a, b] = await Promise.all([hashBlobs(SRC, c), hashBlobs(DST, c)]);
    const malos = [...a.keys()].filter((k) => a.get(k) !== b.get(k));
    if (malos.length) problemas++;
    const detalle = malos.length ? "DIFIEREN " + malos.length : "BYTE A BYTE IDENTICOS";
    console.log("  " + c.padEnd(20) + " origen=" + String(a.size).padStart(5) + " destino=" + String(b.size).padStart(5) + "  " + detalle);
  }

  console.log("");
  console.log(problemas === 0 ? "TODO VERIFICADO: destino identico al origen" : problemas + " discrepancias encontradas");
  process.exit(problemas ? 1 : 0);
})().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
