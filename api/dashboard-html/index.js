const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../shared/adminAuth");
const fs = require("fs");
const path = require("path");

// ── Helpers de extracción de respuestas ─────────────────────────────────────

function assembleAnswers(entity) {
  if (entity.answersV !== undefined || entity.answersA !== undefined) {
    const out = {};
    for (const field of ["answersV", "answersA", "answersB", "answersC", "answersD"]) {
      try { Object.assign(out, JSON.parse(entity[field] || "{}")); } catch {}
    }
    return out;
  }
  try { return JSON.parse(entity.answers || "{}"); } catch { return {}; }
}

function numVal(answer) {
  if (!answer) return null;
  if (typeof answer === "number") return answer;
  if (answer.value !== undefined) return answer.value;
  return null;
}

function arrVal(answer) {
  if (!answer) return [];
  if (Array.isArray(answer)) return answer;
  if (answer.selected) return answer.selected;
  return [];
}

function choiceVal(answer) {
  if (!answer) return null;
  if (typeof answer === "string") return answer;
  if (answer.choice) return answer.choice;
  return null;
}

// ── Transformaciones por tipo de dashboard ──────────────────────────────────

function toPersonas(results) {
  return results.map(r => ({
    email:            r.email,
    nombre:           r.nombre,
    cargo:            r.posicion,
    empresa:          r.empresa,
    area:             r.departamento,
    sucursal:         "",         // enriquecido con maestro en el futuro
    nivel:            "",         // enriquecido con maestro en el futuro
    director_can:     false,      // enriquecido con maestro en el futuro
    pulse_completed:  true,
    p1:               numVal(r.answers.V1),
    p3:               arrVal(r.answers.V3),
    p4:               arrVal(r.answers.V4),
    p9:               numVal(r.answers.B1),
    p18:              numVal(r.answers.D1),
    p18b:             numVal(r.answers.D1b),
    p22:              choiceVal(r.answers.D5),
    p23:              numVal(r.answers.D6),
    p25:              numVal(r.answers.D9),
    cop_interacciones: 0,         // enriquecido con copilot report en el futuro
  }));
}

function toRaw(results) {
  return results.map(r => ({
    empresa:          r.empresa,
    area:             r.departamento,
    sucursal:         "",
    nivel:            "",
    V1:               numVal(r.answers.V1),
    V2:               arrVal(r.answers.V2),
    V3:               arrVal(r.answers.V3),
    V4:               arrVal(r.answers.V4),
    B1:               numVal(r.answers.B1),
    D1:               numVal(r.answers.D1),
    D1b:              numVal(r.answers.D1b),
    D5:               choiceVal(r.answers.D5),
    D6:               numVal(r.answers.D6),
    D9:               numVal(r.answers.D9),
    cop_interacciones: 0,
    cop_activo:       false,
  }));
}

function toNivelData(results) {
  const out = {};
  for (const r of results) {
    const nivel = r.nivel || "Sin nivel";
    if (!out[nivel]) out[nivel] = [];
    out[nivel].push({
      n:     r.nombre,
      e:     r.email,
      c:     r.empresa,
      s:     "completed",
      nv:    nivel,
      cargo: r.posicion,
      area:  r.departamento,
    });
  }
  return out;
}

// ── Plantillas HTML ─────────────────────────────────────────────────────────

function getTemplatePath(tipo) {
  // Las plantillas viven en public/dashboards/ que en Azure SWA
  // está en ../../public/dashboards/ relativo a api/dashboard-html/
  const candidates = [
    path.join(__dirname, "../../public/dashboards", `dashboard-${tipo}.html`),
    path.join(__dirname, "../../../public/dashboards", `dashboard-${tipo}.html`),
    path.join(process.cwd(), "public/dashboards", `dashboard-${tipo}.html`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function injectData(html, tipo, data) {
  const json = JSON.stringify(data);
  switch (tipo) {
    case "adopcion":
      return html.replace("const PERSONAS = /*__PERSONAS__*/[];", `const PERSONAS = ${json};`);
    case "diagnostico":
      return html.replace("const RAW = /*__RAW__*/[];", `const RAW = ${json};`);
    case "participacion":
      return html.replace("var NIVEL_DATA = /*__NIVEL_DATA__*/{};", `var NIVEL_DATA = ${json};`);
    default:
      return html;
  }
}

// ── Handler principal ───────────────────────────────────────────────────────

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers: { ...headers, "Content-Type": "text/plain" }, body: "" };
    return;
  }

  if (!requireAdmin(context, req)) return;

  const tipo = (req.query.type || "").toLowerCase();
  if (!["adopcion", "diagnostico", "participacion"].includes(tipo)) {
    context.res = { status: 400, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "type debe ser adopcion | diagnostico | participacion" }) };
    return;
  }

  // Leer plantilla HTML
  const templatePath = getTemplatePath(tipo);
  if (!templatePath) {
    context.res = { status: 404, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: `Template ${tipo} no encontrado en ${templatePath}` }) };
    return;
  }

  let html;
  try {
    html = fs.readFileSync(templatePath, "utf-8");
  } catch (err) {
    context.res = { status: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Error leyendo template" }) };
    return;
  }

  // Obtener datos de Azure Table Storage
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    context.res = { status: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "AZURE_STORAGE_CONNECTION_STRING no configurada" }) };
    return;
  }

  try {
    const resultsClient = TableClient.fromConnectionString(connectionString, "assessmentResults");
    const rawResults = [];

    for await (const entity of resultsClient.listEntities()) {
      const answers = assembleAnswers(entity);
      rawResults.push({
        email:       entity.email || "",
        nombre:      entity.nombre || "",
        posicion:    entity.posicion || "",
        empresa:     entity.partitionKey || "",
        departamento: entity.departamento || "",
        nivel:       entity.nivel || "",
        sucursal:    entity.sucursal || "",
        answers,
      });
    }

    // Transformar según el tipo de dashboard
    let data;
    switch (tipo) {
      case "adopcion":     data = toPersonas(rawResults);  break;
      case "diagnostico":  data = toRaw(rawResults);       break;
      case "participacion": data = toNivelData(rawResults); break;
    }

    // Inyectar en la plantilla
    html = injectData(html, tipo, data);

    context.res = {
      status: 200,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
      body: html,
      isRaw: true,
    };

  } catch (err) {
    context.log.error("dashboard-html error:", err);
    context.res = { status: 500, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Error obteniendo datos" }) };
  }
};
