const JSZip = require("jszip");
const { requireAdmin } = require("../shared/adminAuth");
const { createTableClient } = require("../shared/tableClient");
const { corsHeaders } = require("../shared/cors");
const { renderParticipantPdf } = require("../shared/pdf/renderParticipantPdf");
const { sanitizeFilename } = require("../shared/pdf/sanitizeFilename");
const { mapWithConcurrency } = require("../shared/pdf/concurrency");

/**
 * report-generate-company-pdf — a diferencia de su vecino
 * report-generate-company (async, vía worker + polling porque llama a un
 * LLM), este endpoint es SÍNCRONO: no hay narrativa generada por IA, solo
 * se reformatean datos ya calculados y guardados en assessmentResults
 * (aiqScore/aiqLevel/sectionA-C) al formato del "Perfil AIQ" de CoachPage,
 * uno por participante, empaquetados en un .zip.
 */
module.exports = async function (context, req) {
  const headers = corsHeaders(req, { methods: "POST, OPTIONS", extra: "X-Admin-Token" });

  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }
  if (!requireAdmin(context, req)) return;

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const empresa = (body.empresa || "").trim();

  if (!empresa) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta el nombre de empresa" }) };
    return;
  }

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Configuración incompleta" }) };
    return;
  }

  try {
    const resultsClient = createTableClient(conn, "assessmentResults");
    const empresaFilter = empresa.replace(/'/g, "''");

    const profiles = [];
    for await (const entity of resultsClient.listEntities({ queryOptions: { filter: `PartitionKey eq '${empresaFilter}'` } })) {
      profiles.push({
        email: entity.email || "",
        nombre: entity.nombre || "",
        empresa: entity.partitionKey || "",
        aiqLevel: entity.aiqLevel || "L1",
        sectionA: entity.sectionA || 0,
        sectionB: entity.sectionB || 0,
        sectionC: entity.sectionC || 0,
        rubricVersion: entity.rubricVersion || "legacy",
        completedAt: entity.completedAt || "",
      });
    }

    if (profiles.length === 0) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: `No hay resultados completos para ${empresa}` }) };
      return;
    }

    const concurrencia = Number(process.env.PDF_MAX_CONCURRENCIA || 5);
    const pdfBuffers = await mapWithConcurrency(profiles, concurrencia, (profile) => renderParticipantPdf(profile));

    const zip = new JSZip();
    const usedNames = new Set();
    profiles.forEach((profile, i) => {
      let name = sanitizeFilename(profile.nombre || profile.email, `participante-${i + 1}`);
      if (usedNames.has(name)) name = `${name}-${sanitizeFilename(profile.email, String(i + 1))}`;
      usedNames.add(name);
      zip.file(`${name}.pdf`, pdfBuffers[i]);
    });

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const empresaSlug = empresa.replace(/[^a-zA-Z0-9]/g, "_");
    const fecha = new Date().toISOString().slice(0, 10);

    context.res = {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="reportes-pdf-${empresaSlug}-${fecha}.zip"`,
      },
      body: zipBuffer,
      isRaw: true,
    };
  } catch (err) {
    context.log.error("report-generate-company-pdf error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error generando los PDFs" }) };
  }
};
