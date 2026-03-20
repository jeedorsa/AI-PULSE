const { TableClient } = require("@azure/data-tables");
const { EmailClient } = require("@azure/communication-email");
const { requireAdmin } = require("../shared/adminAuth");

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 200, headers, body: "" };
    return;
  }

  if (!requireAdmin(context, req)) return;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const emailConnectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  const senderAddress = process.env.EMAIL_SENDER_ADDRESS || "DoNotReply@aipulse.com";
  const appBaseUrl = process.env.APP_BASE_URL || "https://red-plant-0b6124f10.azurestaticapps.net";

  if (!connectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "AZURE_STORAGE_CONNECTION_STRING no configurada" }) };
    return;
  }

  if (!emailConnectionString) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "AZURE_COMMUNICATION_CONNECTION_STRING no configurada" }) };
    return;
  }

  try {
    const tableClient = TableClient.fromConnectionString(connectionString, "participants");
    const emailClient = new EmailClient(emailConnectionString);

    // Get all pending participants
    const pendingParticipants = [];
    for await (const entity of tableClient.listEntities({
      queryOptions: { filter: "status eq 'pending'" }
    })) {
      pendingParticipants.push(entity);
    }

    if (pendingParticipants.length === 0) {
      context.res = { status: 200, headers, body: JSON.stringify({ message: "No hay participantes pendientes", sent: 0 }) };
      return;
    }

    let sent = 0;
    const errors = [];

    for (const participant of pendingParticipants) {
      try {
        const verifyUrl = `${appBaseUrl}/verify?token=${participant.token}`;

        const emailMessage = {
          senderAddress,
          content: {
            subject: "AI Pulse — Tu diagnóstico de madurez en IA te espera",
            html: buildEmailHtml(participant.nombre || "Participante", participant.empresa, verifyUrl),
            plainText: buildEmailPlainText(participant.nombre || "Participante", verifyUrl)
          },
          recipients: {
            to: [
              {
                address: participant.email,
                displayName: participant.nombre || "Participante"
              }
            ]
          }
        };

        const poller = await emailClient.beginSend(emailMessage);
        await poller.pollUntilDone();

        // Update status to 'invited'
        await tableClient.updateEntity(
          {
            partitionKey: participant.partitionKey,
            rowKey: participant.rowKey,
            status: "invited",
            invitedAt: new Date().toISOString()
          },
          "Merge"
        );
        await new Promise(resolve => setTimeout(resolve, 700));
        sent++;
      } catch (emailErr) {
        context.log.error(`Error sending email to ${participant.email}:`, emailErr);
        errors.push({ email: participant.email, error: emailErr.message });
      }
    }

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify({
        message: `${sent} de ${pendingParticipants.length} invitaciones enviadas`,
        sent,
        total: pendingParticipants.length,
        errors: errors.length > 0 ? errors : undefined
      })
    };

  } catch (err) {
    context.log.error("invitations/send error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Error al enviar invitaciones: " + err.message }) };
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildEmailHtml(nombre, empresa, verifyUrl) {
  const firstName = escapeHtml(nombre.split(" ")[0]);
  const safeEmpresa = escapeHtml(empresa);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#080808; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808; padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:22px; letter-spacing:3px; color:#ffffff; font-weight:bold;">
                AI <span style="color:#FE3C1C;">PULSE</span>
              </span>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding-bottom:16px;">
              <h1 style="margin:0; font-size:28px; color:#ffffff; line-height:1.2;">
                Hola, <span style="color:#FE3C1C;">${firstName}</span>
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-bottom:24px;">
              <p style="margin:0; font-size:15px; color:#B3B3B3; line-height:1.6;">
                Has sido invitado a participar en el <strong style="color:#ffffff;">Diagnóstico de Madurez en IA</strong>
                ${safeEmpresa ? ` de <strong style="color:#ffffff;">${safeEmpresa}</strong>` : ""}.
                Este diagnóstico mide tu AIQ — tu nivel de integración con inteligencia artificial.
              </p>
            </td>
          </tr>

          <!-- Info -->
          <tr>
            <td style="padding-bottom:28px;">
              <table cellpadding="0" cellspacing="0" style="background-color:#161616; border:1px solid #2a2a2a; width:100%;">
                <tr>
                  <td style="padding:16px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-size:11px; color:#808080; padding-right:16px;">
                          <span style="color:#FE3C1C; font-weight:bold;">25</span> preguntas
                        </td>
                        <td style="font-size:11px; color:#808080; padding-right:16px;">
                          <span style="color:#FE3C1C; font-weight:bold;">~12</span> minutos
                        </td>
                        <td style="font-size:11px; color:#808080;">
                          <span style="color:#FE3C1C; font-weight:bold;">100%</span> confidencial
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding-bottom:28px;">
              <a href="${verifyUrl}"
                 style="display:inline-block; background-color:#FE3C1C; color:#ffffff; text-decoration:none;
                        padding:14px 32px; font-size:14px; font-weight:600; letter-spacing:0.5px;">
                Comenzar mi diagnóstico &rarr;
              </a>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0; font-size:12px; color:#4D4D4D; line-height:1.5;">
                Este link es personal e intransferible. Al hacer clic, se te pedirá confirmar tu correo electrónico para verificar tu identidad.
                El link expira en 7 días.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #1a1a1a; padding-top:16px;">
              <p style="margin:0; font-size:9px; color:#333333; text-transform:uppercase; letter-spacing:2px;">
                AI PULSE &middot; Diagnóstico de Madurez en IA
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailPlainText(nombre, verifyUrl) {
  const firstName = nombre.split(" ")[0];
  return `Hola ${firstName},

Has sido invitado a participar en el Diagnóstico de Madurez en IA — AI Pulse.

Este diagnóstico mide tu AIQ, tu nivel de integración con inteligencia artificial.
Son 25 preguntas y toma aproximadamente 12 minutos. Es 100% confidencial.

Para comenzar, visita este link:
${verifyUrl}

Este link es personal e intransferible. Se te pedirá confirmar tu correo electrónico.
El link expira en 7 días.

— AI PULSE`;
}
