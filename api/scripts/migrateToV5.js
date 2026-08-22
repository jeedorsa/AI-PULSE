#!/usr/bin/env node
/**
 * migrateToV5.js — Migración one-time de la tabla `assessmentResults` al
 * formato de la rúbrica v5.
 *
 * INERTE desde el reemplazo v5 → v6: este script solo aplica al salto
 * legacy→v5 y depende de `aiqEvaluatorV5.js`, que fue eliminado como parte
 * de ese reemplazo (rúbrica v6 = reemplazo total, no migración). La
 * migración v5→v6 fue una decisión de producto explícita de NO hacer
 * recompute retroactivo — los resultados v5 existentes se dejan tal cual.
 * Se conserva este archivo solo como referencia histórica del patrón
 * (dry-run/backup obligatorio/batches/reporte de fallbacks); no usarlo como
 * base para un eventual script v6 sin confirmar antes con producto que la
 * decisión de "sin recompute" cambió.
 *
 * Recalcula nivel/puntaje/A/B/C/flags/recomendaciones_ids para CADA
 * participante ya evaluado, usando el mismo motor (aiqEvaluatorV5) que usa
 * `results-save` para assessments nuevos, y persiste el resultado con
 * `rubricVersion: "v5"`.
 *
 * Uso:
 *   node api/scripts/migrateToV5.js --dry-run
 *       Calcula y loguea lo que se escribiría, sin persistir nada.
 *
 *   node api/scripts/migrateToV5.js --write --backup-file=./backup-assessmentResults.json
 *       Corre en modo escritura real. Requiere --backup-file: antes de
 *       escribir absolutamente nada, exporta TODAS las entidades actuales
 *       a ese archivo como punto de rollback.
 *
 * Opciones:
 *   --batch-size=N   Cuántos participantes procesar en paralelo (default 3)
 *   --delay-ms=N     Pausa entre lotes, para no saturar Azure OpenAI (default 1000)
 *   --empresa=X      Solo migrar una empresa (PartitionKey) puntual, para pruebas
 *
 * Es idempotente: cualquier entidad con rubricVersion === "v5" se salta.
 * Se puede cortar y volver a correr sin duplicar trabajo ni recalcular de nuevo.
 */

const fs = require("fs");
const path = require("path");
const { createTableClient } = require("../shared/tableClient");
const { assembleAnswers } = require("../shared/assembleAnswers");
// El motor v5 fue eliminado en el reemplazo v5 -> v6. El require queda
// diferido para que ejecutar este script falle con el mensaje de abajo, y no
// con un MODULE_NOT_FOUND que no explica nada.
function cargarMotorV5() {
  try {
    return require("../shared/aiqEvaluatorV5").evaluateAssessment;
  } catch (err) {
    console.error(
      "\nEste script está INERTE: migra legacy -> v5 y depende de aiqEvaluatorV5.js,\n" +
      "que se eliminó al reemplazar la rúbrica v5 por la v6.\n\n" +
      "La migración v5 -> v6 fue una decisión de producto explícita de NO recomputar\n" +
      "los resultados existentes. Si esa decisión cambió, escribe un script nuevo\n" +
      "sobre aiqEvaluatorV6 usando este como referencia del patrón (dry-run, backup\n" +
      "obligatorio, batches, reporte de fallbacks).\n"
    );
    process.exit(1);
  }
}

function loadLocalSettingsIntoEnv() {
  const settingsPath = path.join(__dirname, "..", "local.settings.json");
  if (!fs.existsSync(settingsPath)) return;
  try {
    const { Values } = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    for (const [key, value] of Object.entries(Values || {})) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (err) {
    console.warn(`No se pudo leer local.settings.json: ${err.message}`);
  }
}

function parseArgs(argv) {
  const args = { dryRun: true, batchSize: 3, delayMs: 1000 };
  for (const raw of argv.slice(2)) {
    if (raw === "--write") args.dryRun = false;
    else if (raw === "--dry-run") args.dryRun = true;
    else if (raw.startsWith("--batch-size=")) args.batchSize = Number(raw.split("=")[1]) || 3;
    else if (raw.startsWith("--delay-ms=")) args.delayMs = Number(raw.split("=")[1]) || 1000;
    else if (raw.startsWith("--backup-file=")) args.backupFile = raw.split("=")[1];
    else if (raw.startsWith("--empresa=")) args.empresa = raw.split("=")[1];
  }
  return args;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllEntities(client, empresaFilter) {
  const entities = [];
  const queryOptions = empresaFilter ? { queryOptions: { filter: `PartitionKey eq '${empresaFilter}'` } } : undefined;
  for await (const entity of client.listEntities(queryOptions)) {
    entities.push(entity);
  }
  return entities;
}

async function backupEntities(entities, backupFile) {
  fs.writeFileSync(backupFile, JSON.stringify(entities, null, 2), "utf8");
  console.log(`Backup escrito en ${backupFile} (${entities.length} entidades).`);
}

async function migrateOne(client, entity, { dryRun }) {
  if (entity.rubricVersion === "v5") {
    return { rowKey: entity.rowKey, skipped: true };
  }

  const answers = assembleAnswers(entity);
  const participant = {
    nombre: entity.nombre || "",
    email: entity.email || "",
    empresa: entity.partitionKey || "",
  };

  const resultado = await cargarMotorV5()(answers, participant);

  const fallbackFlags = (resultado.flags || []).filter((f) => f.startsWith("EVAL_ERROR_"));

  // IMPORTANTE: Azure Table Storage no soporta borrar propiedades vía Merge
  // (Merge solo agrega/actualiza). Para eliminar challengeProfile de verdad
  // (decisión confirmada en el plan), hay que reemplazar la entidad completa
  // — por eso partimos de una copia de la entidad original y le quitamos
  // los metadatos de solo lectura antes de mandarla de vuelta con "Replace".
  const updated = { ...entity };
  delete updated.challengeProfile;
  delete updated.etag;
  delete updated.timestamp;
  delete updated["odata.metadata"];
  Object.assign(updated, {
    aiqScore: resultado.puntaje,
    aiqLevel: resultado.nivel,
    sectionA: resultado.A,
    sectionB: resultado.B,
    sectionC: resultado.C,
    alerts: JSON.stringify(resultado.flags),
    recomendacionesIds: JSON.stringify(resultado.recomendaciones_ids),
    rubricVersion: "v5",
  });

  if (!dryRun) {
    await client.updateEntity(updated, "Replace");
  }

  return {
    rowKey: entity.rowKey,
    empresa: entity.partitionKey,
    skipped: false,
    before: { aiqScore: entity.aiqScore, aiqLevel: entity.aiqLevel },
    after: { aiqScore: resultado.puntaje, aiqLevel: resultado.nivel },
    fallbackFlags,
  };
}

async function main() {
  // Se comprueba de entrada, no al migrar el primer participante: si el motor
  // v5 ya no está, hay que decirlo antes de leer nada de la base.
  cargarMotorV5();

  loadLocalSettingsIntoEnv();
  const args = parseArgs(process.argv);

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    console.error("AZURE_STORAGE_CONNECTION_STRING no está configurada. Abortando.");
    process.exit(1);
  }

  if (!args.dryRun && !args.backupFile) {
    console.error("Modo --write requiere --backup-file=<ruta>. Abortando sin escribir nada.");
    process.exit(1);
  }

  const client = createTableClient(conn, "assessmentResults");

  console.log(`Modo: ${args.dryRun ? "DRY-RUN (no se escribe nada)" : "WRITE (escritura real)"}`);
  console.log("Cargando entidades de assessmentResults...");
  const entities = await fetchAllEntities(client, args.empresa);
  console.log(`${entities.length} entidades encontradas${args.empresa ? ` para empresa "${args.empresa}"` : ""}.`);

  if (!args.dryRun) {
    await backupEntities(entities, args.backupFile);
  }

  const pending = entities.filter((e) => e.rubricVersion !== "v5");
  const alreadyMigrated = entities.length - pending.length;
  console.log(`${alreadyMigrated} ya estaban en v5 (se saltan). ${pending.length} pendientes de migrar.`);

  const results = [];
  const batches = chunk(pending, args.batchSize);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Lote ${i + 1}/${batches.length} (${batch.length} participantes)...`);
    const batchResults = await Promise.all(batch.map((entity) => migrateOne(client, entity, args)));
    results.push(...batchResults);
    for (const r of batchResults) {
      if (r.fallbackFlags && r.fallbackFlags.length > 0) {
        console.warn(`  ⚠ ${r.rowKey} (${r.empresa}): fallback en ${r.fallbackFlags.join(", ")} — revisar manualmente`);
      }
    }
    if (i < batches.length - 1) await sleep(args.delayMs);
  }

  const withFallback = results.filter((r) => r.fallbackFlags && r.fallbackFlags.length > 0);
  console.log("\n=== Resumen ===");
  console.log(`Procesados: ${results.length}`);
  console.log(`Con fallback (revisión manual recomendada): ${withFallback.length}`);
  if (withFallback.length > 0) {
    console.log("Filas con fallback:", withFallback.map((r) => r.rowKey).join(", "));
  }
  console.log(args.dryRun ? "\nDRY-RUN completo. Nada fue escrito." : "\nMigración completa.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Error fatal en migración:", err);
    process.exit(1);
  });
}

module.exports = { migrateOne, fetchAllEntities };
