#!/usr/bin/env node
/**
 * migrate-data.js — Copia toda la data de AI Pulse de un storage account a otro.
 *
 * Se usó para poblar el ambiente de AWS (`aipulsedataws`) con los datos de
 * producción (`aipulsedata`). Copia las 6 tablas y los 3 contenedores de blobs.
 *
 * Es de solo-lectura sobre el origen: nunca escribe ni borra en SRC.
 *
 *   SRC_CONN=... DST_CONN=... node migrate-data.cjs --count
 *   SRC_CONN=... DST_CONN=... node migrate-data.cjs --dry-run
 *   SRC_CONN=... DST_CONN=... node migrate-data.cjs --write --backup-file=./backup.json
 *
 * Flags: --tabla=<nombre> limita a una tabla · --sin-blobs omite los blobs
 */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

// Las dependencias de Azure viven en api/node_modules.
const apiRequire = createRequire(path.resolve(__dirname, "../../api/package.json"));
const { TableClient } = apiRequire("@azure/data-tables");
const { BlobServiceClient } = apiRequire("@azure/storage-blob");

const TABLAS = ["assessmentProgress", "assessmentResults", "coachSessions", "companies", "participants", "waitlist"];
const CONTENEDORES = ["aiq-reports", "company-data", "config"];

const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);
const valor = (f) => { const a = args.find((x) => x.startsWith(f + "=")); return a ? a.split("=").slice(1).join("=") : null; };

const MODO_ESCRITURA = tiene("--write");
const SOLO_CONTAR = tiene("--count");
const BACKUP = valor("--backup-file");
const SOLO_TABLA = valor("--tabla");
const SIN_BLOBS = tiene("--sin-blobs");

const SRC = process.env.SRC_CONN;
const DST = process.env.DST_CONN;

if (!SRC) { console.error("Falta SRC_CONN"); process.exit(1); }
if (!SOLO_CONTAR && !DST) { console.error("Falta DST_CONN"); process.exit(1); }
if (MODO_ESCRITURA && !BACKUP) {
  console.error("--write exige --backup-file=<ruta>. No se escribe nada sin respaldo del origen.");
  process.exit(1);
}

const opciones = (conn) => (/^DefaultEndpointsProtocol=http;/i.test(conn) ? { allowInsecureConnection: true } : undefined);
const tabla = (conn, nombre) => TableClient.fromConnectionString(conn, nombre, opciones(conn));

/** Quita los campos que gestiona el servicio: no se copian, los regenera el destino. */
function limpiar(entidad) {
  const { etag, timestamp, ...resto } = entidad;
  delete resto["odata.etag"];
  delete resto["odata.metadata"];
  return resto;
}

async function leerTabla(nombre) {
  const cliente = tabla(SRC, nombre);
  const filas = [];
  for await (const e of cliente.listEntities()) filas.push(limpiar(e));
  return filas;
}

async function migrarTabla(nombre, respaldo) {
  process.stdout.write(`  ${nombre.padEnd(20)} leyendo... `);
  let filas;
  try {
    filas = await leerTabla(nombre);
  } catch (err) {
    console.log(`SIN TABLA EN ORIGEN (${err.statusCode || err.message})`);
    return { tabla: nombre, origen: 0, escritas: 0, fallidas: 0 };
  }
  respaldo[nombre] = filas;
  process.stdout.write(`${filas.length} filas`);

  if (SOLO_CONTAR || !MODO_ESCRITURA) { console.log(" (no se escribe)"); return { tabla: nombre, origen: filas.length, escritas: 0, fallidas: 0 }; }

  const destino = tabla(DST, nombre);
  await destino.createTable().catch(() => {});
  let ok = 0; const errores = [];
  for (const fila of filas) {
    try { await destino.upsertEntity(fila, "Replace"); ok++; }
    catch (err) { errores.push({ pk: fila.partitionKey, rk: fila.rowKey, error: err.message }); }
    if (ok % 100 === 0 && ok) process.stdout.write(".");
  }
  console.log(` -> ${ok} escritas${errores.length ? `, ${errores.length} FALLIDAS` : ""}`);
  for (const e of errores.slice(0, 5)) console.log(`      fallo ${e.pk}/${e.rk}: ${e.error}`);
  return { tabla: nombre, origen: filas.length, escritas: ok, fallidas: errores.length };
}

async function migrarBlobs() {
  const src = BlobServiceClient.fromConnectionString(SRC);
  const dst = DST ? BlobServiceClient.fromConnectionString(DST) : null;
  const resumen = [];

  for (const nombre of CONTENEDORES) {
    const cs = src.getContainerClient(nombre);
    if (!(await cs.exists())) { console.log(`  ${nombre.padEnd(20)} no existe en origen`); continue; }

    const blobs = [];
    for await (const b of cs.listBlobsFlat()) blobs.push(b.name);
    process.stdout.write(`  ${nombre.padEnd(20)} ${blobs.length} blobs`);

    if (SOLO_CONTAR || !MODO_ESCRITURA) { console.log(" (no se escribe)"); resumen.push({ contenedor: nombre, origen: blobs.length, escritos: 0 }); continue; }

    const cd = dst.getContainerClient(nombre);
    await cd.createIfNotExists();
    let ok = 0;
    for (const b of blobs) {
      const desc = await cs.getBlockBlobClient(b).download();
      const trozos = [];
      for await (const t of desc.readableStreamBody) trozos.push(t);
      const datos = Buffer.concat(trozos);
      await cd.getBlockBlobClient(b).upload(datos, datos.length, {
        blobHTTPHeaders: { blobContentType: desc.contentType || "application/octet-stream" },
      });
      ok++;
    }
    console.log(` -> ${ok} copiados`);
    resumen.push({ contenedor: nombre, origen: blobs.length, escritos: ok });
  }
  return resumen;
}

(async () => {
  const modo = SOLO_CONTAR ? "CONTEO" : MODO_ESCRITURA ? "ESCRITURA REAL" : "DRY-RUN";
  console.log(`\n=== Migración de datos AI Pulse — modo ${modo} ===\n`);

  const respaldo = {};
  const lista = SOLO_TABLA ? [SOLO_TABLA] : TABLAS;

  console.log("Tablas:");
  const resultados = [];
  for (const t of lista) resultados.push(await migrarTabla(t, respaldo));

  let blobs = [];
  if (!SIN_BLOBS) { console.log("\nBlobs:"); blobs = await migrarBlobs(); }

  if (BACKUP) {
    fs.writeFileSync(BACKUP, JSON.stringify(respaldo, null, 2));
    console.log(`\nRespaldo del origen escrito en ${BACKUP} (${(fs.statSync(BACKUP).size / 1048576).toFixed(1)} MB)`);
  }

  console.log("\n--- Resumen ---");
  let totalOrigen = 0, totalEscritas = 0, totalFallidas = 0;
  for (const r of resultados) {
    console.log(`  ${r.tabla.padEnd(20)} origen=${String(r.origen).padStart(5)}  escritas=${String(r.escritas).padStart(5)}  fallidas=${r.fallidas}`);
    totalOrigen += r.origen; totalEscritas += r.escritas; totalFallidas += r.fallidas;
  }
  for (const b of blobs) console.log(`  ${b.contenedor.padEnd(20)} origen=${String(b.origen).padStart(5)}  copiados=${String(b.escritos).padStart(5)}`);
  console.log(`  ${"TOTAL tablas".padEnd(20)} origen=${String(totalOrigen).padStart(5)}  escritas=${String(totalEscritas).padStart(5)}  fallidas=${totalFallidas}`);

  process.exit(totalFallidas > 0 ? 1 : 0);
})().catch((err) => { console.error("\nERROR FATAL:", err); process.exit(1); });
