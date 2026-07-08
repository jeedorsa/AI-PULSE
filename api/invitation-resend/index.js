const { createTableClient } = require("../shared/tableClient");
const { EmailClient } = require("@azure/communication-email");
const { requireAdmin } = require("../shared/adminAuth");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }
  if (!requireAdmin(context, req)) return;

  const { email, empresa } = req.body || {};
  if (!email) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta el email" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const emailConnectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  const senderAddress = process.env.EMAIL_SENDER_ADDRESS || "DoNotReply@aipulse.com";
  const appBaseUrl = process.env.APP_BASE_URL || "https://red-plant-0b6124f10.azurestaticapps.net";

  try {
    const tableClient = createTableClient(connectionString, "participants");
    const emailClient = new EmailClient(emailConnectionString);

    // Buscar participante por email
    let participant = null;
    for await (const entity of tableClient.listEntities()) {
      if (entity.email === email) { participant = entity; break; }
    }

    if (!participant) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: "Participante no encontrado" }) };
      return;
    }

    const verifyUrl = `${appBaseUrl}/verify?token=${participant.token}`;

    const emailMessage = {
      senderAddress,
      replyTo: [{ address: "contacto@javiercruz.ai", displayName: "AI Pulse" }],
      content: {
        subject: "AI Pulse — Tu diagnóstico de madurez en IA te espera",
        html: buildEmailHtml(participant.nombre || "Participante", participant.empresa, verifyUrl),
        plainText: `Hola ${participant.nombre?.split(" ")[0] || ""},\n\nTe reenviamos tu link para el Diagnóstico de Madurez en IA.\n\n${verifyUrl}\n\nEl link expira en 14 días.\n\n— AI PULSE`
      },
      recipients: {
        to: [{ address: participant.email, displayName: participant.nombre || "Participante" }]
      }
    };

    const poller = await emailClient.beginSend(emailMessage);
    await poller.pollUntilDone();

    // Actualizar status a invited si estaba pending
    if (participant.status === "pending") {
      participant.status = "invited";
      participant.invitedAt = new Date().toISOString();
      await tableClient.updateEntity(participant, "Merge");
    }

    context.res = { status: 200, headers, body: JSON.stringify({ success: true, message: "Invitación reenviada" }) };
  } catch (err) {
    context.log.error("invitation-resend error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function buildEmailHtml(nombre, empresa, verifyUrl) {
  const firstName = nombre.split(" ")[0];
  const safeEmpresa = empresa || "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:40px 20px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding-bottom:32px;"><span style="font-size:22px;letter-spacing:3px;color:#111111;font-weight:bold;">AI <span style="color:#FE3C1C;">PULSE</span></span></td></tr>
<tr><td style="padding-bottom:16px;"><h1 style="margin:0;font-size:28px;color:#111111;line-height:1.2;">Hola, <span style="color:#FE3C1C;">${firstName}</span></h1></td></tr>
<tr><td style="padding-bottom:24px;"><p style="margin:0;font-size:15px;color:#444444;line-height:1.6;">Te reenviamos tu invitación al <strong style="color:#111111;">Diagnóstico de Madurez en IA</strong>${safeEmpresa ? ` de <strong style="color:#111111;">${safeEmpresa}</strong>` : ""}.</p></td></tr>
<tr><td style="padding-bottom:28px;"><a href="${verifyUrl}" style="display:inline-block;background-color:#FE3C1C;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:14px;font-weight:600;">Comenzar mi diagnóstico &rarr;</a></td></tr>
<tr><td><p style="margin:0;font-size:12px;color:#666666;line-height:1.5;">Link personal e intransferible. Expira en 14 días.</p></td></tr>
<tr><td style="border-top:1px solid #E0E0E0;padding-top:16px;margin-top:16px;"><p style="margin:0;font-size:9px;color:#888888;text-transform:uppercase;letter-spacing:2px;">AI PULSE · Diagnóstico de Madurez en IA</p></td></tr>
</table></td></tr></table></body></html>`;
}
