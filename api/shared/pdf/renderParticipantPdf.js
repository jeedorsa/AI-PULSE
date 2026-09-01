const { renderToBuffer } = require("@react-pdf/renderer");
const { registerFonts } = require("./fonts");
const { buildAiqReportDocument } = require("./AiqReportDocument");

async function renderParticipantPdf(profile) {
  registerFonts();
  return renderToBuffer(buildAiqReportDocument(profile));
}

module.exports = { renderParticipantPdf };
