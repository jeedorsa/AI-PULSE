/**
 * assembleAnswers.js — Reconstruye el objeto `answers` completo de una
 * entidad de la tabla `assessmentResults`.
 *
 * Extraído de la lógica duplicada (con variaciones) en api/results-list,
 * api/dashboard-html, api/report-generate(-company), worker/report-http,
 * worker/report-processor y worker/company-report-*. Todo consumidor nuevo
 * debería importar esta función en vez de reimplementarla.
 *
 * Soporta el formato nuevo particionado (answersV/A/B/C/D, para esquivar el
 * límite de 32KB por propiedad de Azure Table Storage) y el formato legado
 * de un único campo `answers` (potencialmente truncado).
 */
function assembleAnswers(entity) {
  if (entity.answersV !== undefined || entity.answersA !== undefined) {
    const out = {};
    for (const field of ["answersV", "answersA", "answersB", "answersC", "answersD"]) {
      try {
        Object.assign(out, JSON.parse(entity[field] || "{}"));
      } catch {
        // bloque parcial/corrupto: se ignora ese bloque, no toda la entidad
      }
    }
    return out;
  }
  try {
    return JSON.parse(entity.answers || "{}");
  } catch {
    return {};
  }
}

module.exports = { assembleAnswers };
