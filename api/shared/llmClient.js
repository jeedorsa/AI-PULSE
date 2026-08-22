/**
 * llmClient.js — Adaptador de proveedor LLM para las llamadas de generación.
 *
 * Todo el código de AI Pulse hablaba directo con el REST de Azure OpenAI. Este
 * módulo interpone una capa mínima para poder cambiar de proveedor por
 * configuración, sin tocar los llamadores.
 *
 *   AIQ_LLM_PROVIDER=azure     -> Azure OpenAI (por defecto, comportamiento previo)
 *   AIQ_LLM_PROVIDER=bedrock   -> Amazon Bedrock (Claude)
 *
 * `chatCompletion()` acepta el mismo body que la API de chat completions de
 * OpenAI y devuelve un objeto con la forma de una Response de fetch
 * (`ok` / `status` / `json()` / `text()`), de modo que los llamadores que hacían
 * `const r = await fetch(url, ...)` solo cambian esa línea y conservan intacto
 * su manejo de errores y de la respuesta.
 *
 * NOTA: este archivo está duplicado en `worker/shared/llmClient.js`. El worker
 * se despliega como paquete independiente (`package: worker` en el workflow),
 * así que no puede importar desde `api/`. Si se toca uno, sincronizar el otro.
 *
 * Los embeddings NO pasan por acá: siguen yendo a Azure OpenAI
 * (text-embedding-3-large), porque cambiarlos invalidaría la Vector DB.
 */

const MAX_TOKENS_ANTHROPIC = 64000;

// Bedrock impone un tope de *requests por minuto* por modelo, y en cuentas
// nuevas arranca bajo (10/min para Haiku 4.5). El motor AIQ dispara 9 llamadas
// en paralelo por assessment, así que sin control se estrangula solo y las
// preguntas caen en EVAL_ERROR -> L1, hundiendo el puntaje. Dos defensas:
// un límite de concurrencia y reintentos con backoff ante throttling.
const MAX_CONCURRENCIA = Number(process.env.BEDROCK_MAX_CONCURRENCIA || 2);
const MAX_REINTENTOS_THROTTLE = Number(process.env.BEDROCK_MAX_REINTENTOS || 5);

let enVuelo = 0;
const esperando = [];

function adquirir() {
  if (enVuelo < MAX_CONCURRENCIA) {
    enVuelo++;
    return Promise.resolve();
  }
  return new Promise((resolve) => esperando.push(resolve));
}

function liberar() {
  const siguiente = esperando.shift();
  if (siguiente) siguiente();
  else enVuelo--;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function proveedorActivo() {
  return (process.env.AIQ_LLM_PROVIDER || "azure").toLowerCase() === "bedrock" ? "bedrock" : "azure";
}

function modeloActivo() {
  return proveedorActivo() === "bedrock"
    ? process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    : process.env.AZURE_OPENAI_DEPLOYMENT || "";
}

/** Envuelve un payload en algo con la interfaz de una Response de fetch. */
function comoRespuesta(ok, status, payload) {
  const cuerpo = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    ok,
    status,
    json: async () => (typeof payload === "string" ? JSON.parse(payload) : payload),
    text: async () => cuerpo,
  };
}

// ── Azure OpenAI ────────────────────────────────────────────────────────────

async function chatAzure(body) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const version = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  if (!endpoint || !apiKey || !deployment) {
    return comoRespuesta(false, 500, { error: { message: "Azure OpenAI no configurado (ENDPOINT/API_KEY/DEPLOYMENT)" } });
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify(body),
  });

  // Se devuelve la Response nativa: ya tiene la interfaz que esperan los llamadores.
  return res;
}

// ── Amazon Bedrock (Claude) ─────────────────────────────────────────────────

let clienteBedrock = null;
function getBedrock() {
  if (!clienteBedrock) {
    // require perezoso: si el proveedor es azure, el SDK de AWS no hace falta.
    const { BedrockRuntimeClient } = require("@aws-sdk/client-bedrock-runtime");
    clienteBedrock = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
    });
  }
  return clienteBedrock;
}

/**
 * Traduce un body de OpenAI al formato de la Messages API de Anthropic.
 *
 * Diferencias que hay que salvar:
 *  - el `system` va como campo aparte, no como un mensaje más;
 *  - la conversación tiene que empezar con `user`;
 *  - no se aceptan dos mensajes seguidos del mismo rol.
 */
function aFormatoAnthropic(body) {
  const mensajes = Array.isArray(body.messages) ? body.messages : [];

  const system = mensajes
    .filter((m) => m.role === "system")
    .map((m) => String(m.content ?? ""))
    .join("\n\n")
    .trim();

  let conversacion = mensajes
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }));

  while (conversacion.length && conversacion[0].role !== "user") conversacion.shift();

  const fusionados = [];
  for (const m of conversacion) {
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += "\n\n" + m.content;
    else fusionados.push({ ...m });
  }
  if (fusionados.length === 0) fusionados.push({ role: "user", content: " " });

  const pedidos = body.max_tokens || body.max_completion_tokens || 2000;
  const temperatura = body.temperature !== undefined
    ? body.temperature
    : Number(process.env.BEDROCK_TEMPERATURE ?? 0);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: Math.min(pedidos, MAX_TOKENS_ANTHROPIC),
    temperature: temperatura,
    messages: fusionados,
  };
  if (system) payload.system = system;
  return payload;
}

/** Devuelve la respuesta de Anthropic con la forma que espera un llamador de OpenAI. */
function aFormatoOpenAI(respuesta, modelo) {
  const texto = (respuesta.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const uso = respuesta.usage || {};
  return {
    id: respuesta.id,
    object: "chat.completion",
    model: modelo,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: texto },
        finish_reason: respuesta.stop_reason === "max_tokens" ? "length" : "stop",
      },
    ],
    usage: {
      prompt_tokens: uso.input_tokens || 0,
      completion_tokens: uso.output_tokens || 0,
      total_tokens: (uso.input_tokens || 0) + (uso.output_tokens || 0),
    },
  };
}

function esThrottling(err) {
  return err.name === "ThrottlingException" || err.$metadata?.httpStatusCode === 429;
}

async function chatBedrock(body) {
  const { InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
  const modelo = modeloActivo();
  const payload = JSON.stringify(aFormatoAnthropic(body));

  await adquirir();
  try {
    let ultimoError;
    for (let intento = 0; intento <= MAX_REINTENTOS_THROTTLE; intento++) {
      try {
        const salida = await getBedrock().send(
          new InvokeModelCommand({
            modelId: modelo,
            contentType: "application/json",
            accept: "application/json",
            body: payload,
          })
        );
        const cruda = JSON.parse(Buffer.from(salida.body).toString("utf8"));
        return comoRespuesta(true, 200, aFormatoOpenAI(cruda, modelo));
      } catch (err) {
        ultimoError = err;
        if (!esThrottling(err) || intento === MAX_REINTENTOS_THROTTLE) break;
        // Backoff exponencial con jitter: 1s, 2s, 4s, 8s, 16s (±25%).
        const base = 1000 * 2 ** intento;
        await dormir(base * (0.75 + Math.random() * 0.5));
      }
    }
    // Se replica la semántica HTTP para que el manejo de errores de los
    // llamadores (que distinguen 4xx de 5xx) siga funcionando igual que con Azure.
    const status = ultimoError.$metadata?.httpStatusCode || (esThrottling(ultimoError) ? 429 : 500);
    return comoRespuesta(false, status, {
      error: { message: `Bedrock ${ultimoError.name || "Error"}: ${ultimoError.message}`, type: ultimoError.name },
    });
  } finally {
    liberar();
  }
}

// ── Punto de entrada ────────────────────────────────────────────────────────

/**
 * @param {object} body body de chat completions de OpenAI ({messages, max_completion_tokens, ...})
 * @returns {Promise<{ok:boolean,status:number,json:Function,text:Function}>}
 */
async function chatCompletion(body) {
  return proveedorActivo() === "bedrock" ? chatBedrock(body) : chatAzure(body);
}

/** Atajo para los llamadores que solo quieren el texto de la respuesta. */
async function chatTexto(body) {
  const res = await chatCompletion(body);
  if (!res.ok) {
    const detalle = await res.text();
    const err = new Error(`LLM ${res.status}: ${detalle.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const datos = await res.json();
  return datos?.choices?.[0]?.message?.content || "";
}

module.exports = { chatCompletion, chatTexto, proveedorActivo, modeloActivo };
