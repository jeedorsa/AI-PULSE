// Valores derivados para el PDF, portados de src/pages/CoachPage.tsx
// (normalizeLevel líneas 48-52, dimLevelInt líneas 54-60, fechaPerfil
// líneas 300-304) con una corrección de escala respecto al original — ver
// dimLevelInt() abajo.

function normalizeLevel(level) {
  if (level === "L4T" || level === "L4L" || level === "L4") return "L4";
  if (level === "L1" || level === "L2" || level === "L3") return level;
  return "L1";
}

// CoachPage.tsx:57-60 solo trata "v5" como ya-entero (1-4) y reescala todo lo
// demás con /5*4, incluyendo "v6" — pero se verificó en aiqEvaluatorV6.js
// (computeSectionLevel, líneas 361-365) y results-save/index.js (líneas
// 301-315) que los registros v6 también guardan sectionA/B/C como enteros
// 1-4 ya calculados, igual que v5. Solo los registros legacy (rubricVersion
// ausente) usan un promedio ponderado 0-5 que sí necesita reescalarse.
function dimLevelInt(value, rubricVersion) {
  const raw = rubricVersion === "v5" || rubricVersion === "v6" ? value : (value / 5) * 4;
  return Math.max(1, Math.min(4, Math.round(raw || 1)));
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fechaPerfil(completedAt) {
  const fecha = completedAt ? new Date(completedAt) : new Date();
  try {
    const s = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    if (/^\d/.test(s)) return capitalize(s);
  } catch {
    // sigue al formateador manual de respaldo
  }
  return `${fecha.getDate()} de ${MESES_ES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

module.exports = { normalizeLevel, dimLevelInt, fechaPerfil };
