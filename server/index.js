/**
 * Host Express para las Azure Functions de AI Pulse.
 *
 * Permite correr las mismas functions (modelo de programación v3:
 * `module.exports = async (context, req)` + `function.json`) fuera de Azure,
 * sin modificar una sola línea de los handlers. Se usa para el despliegue en
 * EC2; en Azure el runtime de Functions sigue siendo el host real.
 *
 * - httpTrigger  -> se monta en /api/<carpeta> con los métodos declarados.
 * - queueTrigger -> se sondea la cola de Azure Storage con un poller.
 */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const express = require("express");

const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 8080;

// El .env vive fuera del repo (permisos 600) — nunca versionado.
require("dotenv").config({ path: process.env.AI_PULSE_ENV_FILE || "/etc/ai-pulse/env" });

const app = express();
app.disable("x-powered-by");

// Los uploads de participantes viajan como Excel en base64 dentro de un JSON.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.text({ limit: "50mb", type: ["text/*"] }));

/** Logger con la misma forma que el `context.log` de Azure Functions. */
function makeLog(name) {
  const stamp = () => new Date().toISOString();
  const log = (...a) => console.log(stamp(), `[${name}]`, ...a);
  log.info = (...a) => console.log(stamp(), `[${name}] INFO`, ...a);
  log.warn = (...a) => console.warn(stamp(), `[${name}] WARN`, ...a);
  log.error = (...a) => console.error(stamp(), `[${name}] ERROR`, ...a);
  log.verbose = (...a) => console.log(stamp(), `[${name}] VERBOSE`, ...a);
  return log;
}

/** Traduce el `context.res` que dejó el handler a una respuesta de Express. */
function sendContextRes(context, res, name) {
  const r = context.res;
  if (!r) {
    // El handler no asignó context.res — mismo comportamiento que Azure: 204.
    return res.status(204).end();
  }
  res.status(r.status || 200);
  for (const [k, v] of Object.entries(r.headers || {})) res.setHeader(k, v);

  const body = r.body;
  if (body === undefined || body === null) return res.end();
  if (Buffer.isBuffer(body) || typeof body === "string") return res.send(body);
  return res.json(body);
}

/** Descubre las carpetas que tienen function.json dentro de `base`. */
function discover(base) {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, "function.json")))
    .map((d) => ({ name: d.name, dir: path.join(base, d.name) }));
}

const httpMounted = [];
const queueBindings = [];

for (const base of [path.join(ROOT, "api"), path.join(ROOT, "worker")]) {
  for (const { name, dir } of discover(base)) {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, "function.json"), "utf8"));
    const inBinding = (cfg.bindings || []).find((b) => b.direction === "in") || {};

    if (inBinding.type === "httpTrigger") {
      const route = "/api/" + (inBinding.route || name);
      const methods = (inBinding.methods || ["get", "post"]).map((m) => m.toLowerCase());
      const handler = require(path.join(dir, "index.js"));

      for (const m of methods) {
        app[m](route, async (req, res) => {
          const context = { log: makeLog(name), req, res: undefined, bindings: {}, invocationId: `${name}-${Date.now()}` };
          try {
            await handler(context, req);
            sendContextRes(context, res, name);
          } catch (err) {
            console.error(new Date().toISOString(), `[${name}] UNHANDLED`, err);
            if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
          }
        });
      }
      httpMounted.push(`${methods.join(",").toUpperCase()} ${route}`);
    }

    if (inBinding.type === "queueTrigger") {
      queueBindings.push({ name, dir, queueName: inBinding.queueName, connection: inBinding.connection || "AZURE_STORAGE_CONNECTION_STRING" });
    }
  }
}

/**
 * Poller de colas — reemplaza al queueTrigger del runtime de Azure.
 * Azure entrega el mensaje ya decodificado de base64; acá se replica.
 */
function startQueuePoller({ name, dir, queueName, connection }) {
  const workerRequire = createRequire(path.join(ROOT, "worker", "package.json"));
  const { QueueServiceClient } = workerRequire("@azure/storage-queue");

  const conn = process.env[connection];
  if (!conn) {
    console.warn(`[${name}] sin ${connection} — poller no iniciado`);
    return;
  }

  const handler = require(path.join(dir, "index.js"));
  const isHttp = /^DefaultEndpointsProtocol=http;/i.test(conn);
  const client = QueueServiceClient
    .fromConnectionString(conn, isHttp ? { allowInsecureConnection: true } : undefined)
    .getQueueClient(queueName);

  const MAX_DEQUEUE = 5;   // mismo tope que host.json en Azure
  const IDLE_MS = 5000;

  (async () => {
    await client.createIfNotExists();
    console.log(`[${name}] poller escuchando la cola "${queueName}"`);
    for (;;) {
      try {
        // visibilityTimeout alto: generar un informe puede tardar minutos.
        const { receivedMessageItems: msgs } = await client.receiveMessages({ numberOfMessages: 1, visibilityTimeout: 600 });
        if (!msgs || msgs.length === 0) {
          await new Promise((r) => setTimeout(r, IDLE_MS));
          continue;
        }
        const m = msgs[0];
        const texto = Buffer.from(m.messageText, "base64").toString("utf8");
        const context = { log: makeLog(name), bindings: {}, invocationId: m.messageId };
        try {
          await handler(context, texto);
          await client.deleteMessage(m.messageId, m.popReceipt);
        } catch (err) {
          console.error(`[${name}] fallo procesando ${m.messageId} (intento ${m.dequeueCount}):`, err.message);
          if (m.dequeueCount >= MAX_DEQUEUE) {
            console.error(`[${name}] descartando ${m.messageId} tras ${MAX_DEQUEUE} intentos`);
            await client.deleteMessage(m.messageId, m.popReceipt);
          }
          // Si no se borra, el mensaje reaparece al vencer el visibilityTimeout.
        }
      } catch (err) {
        console.error(`[${name}] error en el poller:`, err.message);
        await new Promise((r) => setTimeout(r, IDLE_MS));
      }
    }
  })();
}

// Liveness del host en sí. El /api/health real lo sirve la function `health`.
app.get("/_healthz", (_req, res) => res.json({ ok: true, functions: httpMounted.length, queues: queueBindings.length }));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`AI Pulse — host de functions en http://127.0.0.1:${PORT}`);
  console.log(`  ${httpMounted.length} endpoints HTTP montados`);
  for (const r of httpMounted.sort()) console.log(`    ${r}`);
  for (const q of queueBindings) startQueuePoller(q);
});
