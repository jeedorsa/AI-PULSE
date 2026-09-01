// Pool de concurrencia acotada para generación de PDFs (trabajo CPU-bound,
// sin llamadas a LLM). No es el mismo caso que el throttle de llmClient.js
// (que maneja reintentos/backoff ante 429 de un proveedor externo) — acá
// solo se busca no disparar N renders en paralelo sin control cuando una
// empresa tiene muchos participantes.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

module.exports = { mapWithConcurrency };
