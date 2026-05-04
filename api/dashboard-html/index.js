const { TableClient } = require("@azure/data-tables");
const { BlobServiceClient } = require("@azure/storage-blob");
const { requireAdmin } = require("../shared/adminAuth");
const fs = require("fs");
const path = require("path");

// ── Carga de datos de enriquecimiento desde Blob ─────────────────────────────

async function loadEnrichment(conn) {
  const maestro = {};
  const copilot = {};
  try {
    const container = BlobServiceClient
      .fromConnectionString(conn)
      .getContainerClient("company-data");

    for (const tipo of ["maestro", "copilot"]) {
      try {
        const blob = container.getBlockBlobClient(`${tipo}.json`);
        const buf = await blob.downloadToBuffer();
        const parsed = JSON.parse(buf.toString("utf-8"));
        if (tipo === "maestro") Object.assign(maestro, parsed.data || {});
        if (tipo === "copilot") Object.assign(copilot, parsed.data || {});
      } catch { /* archivo no subido aún — silencioso */ }
    }
  } catch { /* container no existe aún */ }
  return { maestro, copilot };
}

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

function toPersonas(results, maestro, copilot) {
  return results.map(r => {
    const email = r.email.toLowerCase().trim();
    const m = maestro[email] || {};
    const c = copilot[email] || {};
    return {
      email,
      nombre:           m.nombre      || r.nombre,
      cargo:            m.cargo       || r.posicion,
      empresa:          m.empresa     || r.empresa,
      area:             m.area        || r.departamento,
      sucursal:         m.sucursal    || "",
      nivel:            m.nivel       || "",
      director_can:     m.director_can || false,
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
      cop_interacciones: c.count || 0,
    };
  });
}

function toRaw(results, maestro, copilot) {
  return results.map(r => {
    const email = r.email.toLowerCase().trim();
    const m = maestro[email] || {};
    const c = copilot[email] || {};
    return {
      empresa:          m.empresa     || r.empresa,
      area:             m.area        || r.departamento,
      sucursal:         m.sucursal    || "",
      nivel:            m.nivel       || "",
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
      cop_interacciones: c.count  || 0,
      cop_activo:        c.activo || false,
    };
  });
}

function toNivelData(results, maestro) {
  const out = {};
  for (const r of results) {
    const email = r.email.toLowerCase().trim();
    const m = maestro[email] || {};
    const nivel = m.nivel || r.nivel || "Sin nivel";
    if (!out[nivel]) out[nivel] = [];
    out[nivel].push({
      n:     m.nombre   || r.nombre,
      e:     email,
      c:     m.empresa  || r.empresa,
      s:     "completed",
      nv:    nivel,
      cargo: m.cargo    || r.posicion,
      area:  m.area     || r.departamento,
    });
  }
  return out;
}

// ── Plantillas HTML ─────────────────────────────────────────────────────────

function getTemplatePath(tipo, context) {
  const candidates = [
    // Primero buscar en api/dashboard-html/templates/ (funciona en Azure SWA)
    path.join(__dirname, "templates", `dashboard-${tipo}.html`),
    // Fallback local dev
    path.join(__dirname, "../../public/dashboards", `dashboard-${tipo}.html`),
    path.join(process.cwd(), "public/dashboards", `dashboard-${tipo}.html`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      if (context) context.log.info(`Template encontrado: ${p}`);
      return p;
    }
  }
  if (context) context.log.error(`Template dashboard-${tipo}.html no encontrado. Intentados: ${candidates.join(", ")}`);
  return null;
}

function injectData(html, tipo, data) {
  // Escapar </script> dentro del JSON para no romper el parser HTML
  const json = JSON.stringify(data).replace(/<\/script>/gi, "<\\/script>");
  const placeholders = {
    adopcion:      ["const PERSONAS = /*__PERSONAS__*/[];",   `const PERSONAS = ${json};`],
    diagnostico:   ["const RAW = /*__RAW__*/[];",             `const RAW = ${json};`],
    participacion: ["var NIVEL_DATA = /*__NIVEL_DATA__*/{};", `var NIVEL_DATA = ${json};`],
  };
  const [placeholder, replacement] = placeholders[tipo] || [];
  if (!placeholder) return html;
  const result = html.replace(placeholder, replacement);
  return result;
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
  const templatePath = getTemplatePath(tipo, context);
  if (!templatePath) {
    context.res = { status: 404, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ error: `Template dashboard-${tipo}.html no encontrado. Revisa que public/dashboards/ esté deployado.` }) };
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

    // Cargar datos de enriquecimiento (maestro + copilot) — opcionales
    const { maestro, copilot } = await loadEnrichment(connectionString);
    context.log.info(`Enriquecimiento: ${Object.keys(maestro).length} maestro, ${Object.keys(copilot).length} copilot`);

    // Transformar según el tipo de dashboard
    let data;
    switch (tipo) {
      case "adopcion":      data = toPersonas(rawResults, maestro, copilot);  break;
      case "diagnostico":   data = toRaw(rawResults, maestro, copilot);       break;
      case "participacion": data = toNivelData(rawResults, maestro);          break;
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
