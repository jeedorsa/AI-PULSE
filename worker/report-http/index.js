/**
 * report-http — HTTP-triggered Azure Function (worker)
 *
 * Llamado directamente desde api/report-generate cuando no existe blob.
 * Sin límite de 4 min — esta Function App tiene timeout de 10 minutos.
 * Protegido por function key (header x-functions-key).
 */

const { TableClient } = require("@azure/data-tables");
const { BlobServiceClient } = require("@azure/storage-blob");

const V1_OPT = { 1: 'Aún no la he usado ni explorado', 2: 'La he probado pero no le he encontrado utilidad real en mi trabajo', 3: 'La uso de vez en cuando para tareas puntuales', 4: 'La uso regularmente y forma parte de cómo trabajo' };
const B1_OPT = { 1: 'La acepto si suena lógica o coherente con lo que sé', 2: 'La busco en Google u otra fuente que tengo a mano', 3: 'Verifico cuando voy a usarlo para tomar una decisión o compartirlo', 4: 'La contrasto siempre con una fuente confiable antes de usarla', 5: 'Generalmente la uso sin verificar, no siempre sé cómo hacerlo' };
const D1_OPT = { 1: 'Nunca lo ha mencionado ni promovido', 2: 'Lo menciona ocasionalmente pero sin acciones concretas', 3: 'Me ha dado espacio o recursos para explorarlo', 4: 'Lo promueve activamente y da el ejemplo' };
const D1B_OPT = { 1: 'No he visto ninguna iniciativa o comunicación al respecto', 2: 'He escuchado menciones generales pero sin acciones concretas', 3: 'Hay herramientas disponibles pero no hay formación ni seguimiento', 4: 'Existe una estrategia clara con formación, seguimiento y liderazgo visible' };
const D6_OPT = { 1: 'Sí, la conozco y sé lo que dice', 2: 'Sí, sé que existe pero no la he leído', 3: 'No sé si existe alguna política al respecto', 4: 'No sé qué es una política de uso de IA' };
const D9_OPT = { 1: 'Me genera dudas — no sé bien qué significa para mi trabajo', 2: 'Tengo curiosidad pero todavía no sé cómo me va a afectar', 3: 'Lo veo como una oportunidad clara para crecer en mi rol', 4: 'Ya la incorporé como parte natural de cómo trabajo' };
const NIVEL_NOMBRES = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4: 'Amplificador' };
const NIVEL_SIGUIENTE = { L1: 'L2', L2: 'L3', L3: 'L4', L4: 'L4' };

function blobNameForEmail(email) {
  return `individual/${email.replace(/[@.]/g, '_')}.html`;
}

function resolveAnswer(id, raw) {
  if (raw === undefined || raw === null) return '(no respondida)';
  switch (id) {
    case 'V1': return V1_OPT[raw?.value] || '';
    case 'V2': return (raw?.selected || []).join(', ');
    case 'V3': return (raw?.selected || []).join(', ');
    case 'V4': return (raw?.selected || []).join(', ');
    case 'E2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'E3': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'E5': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B1': return B1_OPT[raw?.value] || '';
    case 'B2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B4': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'C1': return raw?.text || '';
    case 'C2': return raw?.text || '';
    case 'C3': return raw?.text || '';
    case 'D1': return D1_OPT[raw?.value] || '';
    case 'D1b': return D1B_OPT[raw?.value] || '';
    case 'D2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D4': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D5': return [raw?.choice || '', raw?.text || ''].filter(Boolean).join(' — ');
    case 'D6': return D6_OPT[raw?.value] || '';
    case 'D7': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D9': return D9_OPT[raw?.value] || '';
    default: return typeof raw === 'string' ? raw : JSON.stringify(raw);
  }
}

function buildPrompt(participant, answers, scores, companyDistribution) {
  const ans = (id) => resolveAnswer(id, answers[id]);
  const nivel = scores.aiqLevel;
  const nivelNombre = NIVEL_NOMBRES[nivel] || nivel;
  const nivelSiguienteKey = NIVEL_SIGUIENTE[nivel] || 'L4';
  const nivelSiguienteNombre = NIVEL_NOMBRES[nivelSiguienteKey] || nivelSiguienteKey;

  return `Eres el analista principal de AI Pulse, una consultora experta en diagnósticos de madurez en inteligencia artificial para empresas. Tu trabajo es generar el análisis narrativo personalizado de un informe AIQ individual.

DATOS DEL PARTICIPANTE:
- Nombre: ${participant.nombre}
- Empresa: ${participant.empresa}
- Posición: ${participant.posicion}
- Departamento: ${participant.departamento}
- Autopercepción IA: ${ans('V1')}
- Herramientas exploradas: ${ans('V2')}
- Barreras para usar IA: ${ans('V3')}
- Superpoderes elegidos: ${ans('V4')}

RESULTADO AIQ:
- Nivel: ${nivel} — ${nivelNombre}
- Score total: ${scores.aiqScore?.toFixed(2)} / 5.0
- Dimensión A (Experiencia Real, 30%): ${scores.sectionA?.toFixed(2)} / 5.0
- Dimensión B (Criterio Técnico, 30%): ${scores.sectionB?.toFixed(2)} / 5.0
- Dimensión C (Laboratorio de Ejecución, 40%): ${scores.sectionC?.toFixed(2)} / 5.0

RESPUESTAS COMPLETAS:
[A] E2 — Último entregable con IA: "${ans('E2')}"
[A] E3 — Reacción ante resultado incorrecto: "${ans('E3')}"
[A] E5 — Compartió sobre IA con compañeros: "${ans('E5')}"
[B] B1 — Cómo verifica datos de la IA: "${ans('B1')}"
[B] B2 — Información que no compartiría con IA: "${ans('B2')}"
[B] B4 — Uso multimodal (más allá del texto): "${ans('B4')}"
[C] C1 — Prompt para comunicar retraso de vehículo: "${ans('C1')}"
[C] C2 — Mejora de prompt deficiente: "${ans('C2')}"
[C] C3 — Prompt con razonamiento paso a paso: "${ans('C3')}"
[D] D1 — Apoyo del jefe directo: "${ans('D1')}"
[D] D1b — Apoyo de ${participant.empresa} como empresa: "${ans('D1b')}"
[D] D2 — Desconfianza o incomodidad al usar IA: "${ans('D2')}"
[D] D4 — Herramienta que necesitaría y no tiene: "${ans('D4')}"
[D] D5 — Espacios en ${participant.empresa} para compartir IA: "${ans('D5')}"
[D] D6 — Conoce política oficial de IA de ${participant.empresa}: "${ans('D6')}"
[D] D7 — Decidió NO usar IA por razones éticas: "${ans('D7')}"
[D] D9 — Cómo ve el futuro de su rol con la IA: "${ans('D9')}"

Responde SOLO con JSON válido, sin markdown:
{
  "dim_a_interpretacion": "2-3 oraciones sobre Dimensión A basadas en respuestas reales.",
  "dim_a_gap": "1 oración concreta sobre qué falta.",
  "dim_b_interpretacion": "2-3 oraciones sobre Dimensión B.",
  "dim_b_gap": "1 oración concreta.",
  "dim_c_interpretacion": "2-3 oraciones sobre prompts C1/C2/C3.",
  "dim_c_gap": "1 oración concreta.",
  "brecha_detectada": true,
  "brecha_texto": "1-2 oraciones si hay brecha, vacío si no.",
  "fortalezas": [{"titulo": "...", "descripcion": "..."}],
  "oportunidades": [{"titulo": "...", "descripcion": "..."}],
  "proximo_nivel_descripcion": "2 oraciones sobre ${nivelSiguienteNombre}.",
  "gaps": [{"titulo": "...", "accion": "..."}],
  "frase_cierre": "1 frase final."
}
Mínimo 2 fortalezas, mínimo 2 oportunidades, exactamente 3 gaps. Tono consultor senior. IMPORTANTE: usa siempre tuteo (tú/tu/tus/te) — nunca usted/su/sus.`;
}

function generateHTML(participant, scores, answers, analysis, companyDist) {
  const nivel = scores.aiqLevel;
  const nivelNombre = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4: 'Amplificador' }[nivel] || nivel;
  const nivelSigKey = { L1: 'L2', L2: 'L3', L3: 'L4', L4: 'L4' }[nivel];
  const nivelSigNombre = { L1: 'Experimentador', L2: 'Practicante', L3: 'Amplificador', L4: 'Amplificador' }[nivel];
  const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const herramientas = (answers.V4?.selected || []).join(', ') || '—';
  const niveles = ['L1', 'L2', 'L3', 'L4'];
  const nivelesNombres = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4: 'Amplificador' };

  const barraHTML = niveles.map(n => `
    <div class="lbar-item ${n === nivel ? 'active' : niveles.indexOf(n) < niveles.indexOf(nivel) ? 'past' : ''}">
      <span class="lbar-name">${nivelesNombres[n]}</span>
      <span class="lbar-code">${n === nivel ? `${n} · Tu nivel` : n}</span>
    </div>`).join('');

  const distHTML = niveles.map(n => {
    const count = companyDist[n] || 0;
    const pct = companyDist.total > 0 ? Math.round((count / companyDist.total) * 100) : 0;
    const isYou = n === nivel;
    return `<div class="dist-row ${isYou ? 'you-row' : ''}">
      <div class="dist-lbl">${nivelesNombres[n]}${isYou ? ' — tú' : ''}</div>
      <div class="dist-track"><div class="dist-fill ${isYou ? 'dist-fill-you' : 'dist-fill-neutral'}" style="width:${Math.max(pct, 4)}%;"></div></div>
      <div class="dist-pct">${pct}%</div>
    </div>`;
  }).join('');

  const fortalezasHTML = (analysis.fortalezas || []).map(f => `
    <div class="insight">
      <div style="width:3px;background:var(--p);border-radius:2px;align-self:stretch;min-height:60px;"></div>
      <div><div class="insight-type insight-type-pos">Fortaleza detectada</div>
      <div class="insight-title">${f.titulo}</div><div class="insight-desc">${f.descripcion}</div></div>
    </div>`).join('');

  const oportunidadesHTML = (analysis.oportunidades || []).map(o => `
    <div class="insight">
      <div style="width:3px;background:var(--g4);border-radius:2px;align-self:stretch;min-height:60px;"></div>
      <div><div class="insight-type insight-type-neg">Oportunidad de desarrollo</div>
      <div class="insight-title">${o.titulo}</div><div class="insight-desc">${o.descripcion}</div></div>
    </div>`).join('');

  const gapsHTML = (analysis.gaps || []).map((g, i) => `
    <div class="gap-item">
      <div class="gap-n">${i + 1}</div>
      <div><div class="gap-title">${g.titulo}</div><div class="gap-action">${g.accion}</div></div>
    </div>`).join('');

  const brechaHTML = analysis.brecha_detectada ? `
    <div class="brecha-alert">
      <div class="brecha-alert-title">⚠ Brecha detectada</div>
      <div class="brecha-alert-desc">${analysis.brecha_texto}</div>
    </div>` : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe AIQ — ${participant.nombre}</title>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--p:#FE3C1C;--p10:rgba(254,60,28,0.07);--p40:rgba(254,60,28,0.3);--bk:#FFFFFF;--d1:#F7F7F7;--d2:#F0F0F0;--d3:#E4E4E4;--g4:#AAAAAA;--g3:#777777;--g2:#444444;--wh:#111111;--border:#E4E4E4;--warn:#D97706;--warn10:rgba(217,119,6,0.07);--warn20:rgba(217,119,6,0.18);}
body{background:#fff;color:var(--wh);font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.6;}
.doc{max-width:860px;margin:0 auto;padding:0 0 80px;}
.hdr{padding:48px 60px 40px;border-bottom:1px solid var(--border);}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;}
.brand-name{font-family:'Big Shoulders Display',sans-serif;font-size:18px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.meta-date{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);letter-spacing:.2em;text-transform:uppercase;}
.recipient-name{font-family:'Big Shoulders Display',sans-serif;font-size:42px;font-weight:700;line-height:1;text-transform:uppercase;}
.recipient-role{font-size:13px;color:var(--g3);margin-top:6px;display:flex;align-items:center;gap:8px;}
.role-sep{width:3px;height:3px;border-radius:50%;background:var(--g4);}
.sec{padding:48px 60px;border-bottom:1px solid var(--border);}
.sec-label{display:flex;align-items:center;gap:14px;margin-bottom:28px;}
.sec-num{font-family:'DM Mono',monospace;font-size:10px;color:var(--p);opacity:.5;letter-spacing:.2em;}
.sec-title{font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:.35em;text-transform:uppercase;color:var(--g4);}
.sec-line{flex:1;height:1px;background:linear-gradient(to right,var(--border),transparent);}
.level-bar{display:flex;gap:3px;margin-top:28px;}
.lbar-item{flex:1;padding:12px 10px 10px;background:var(--d1);}
.lbar-item.active{background:var(--p10);border:1px solid var(--p40);}
.lbar-item.past{opacity:.5;}
.lbar-name{display:block;font-size:11px;font-weight:500;margin-bottom:4px;}
.lbar-code{display:block;font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);}
.lbar-item.active .lbar-code{color:var(--p);}
.dims{display:flex;flex-direction:column;gap:3px;}
.dim{display:grid;grid-template-columns:140px 1fr;background:var(--d1);}
.dim-left{padding:24px 20px;border-right:1px solid var(--border);}
.dim-right{padding:24px 24px;}
.dim-code{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;color:var(--g4);margin-bottom:8px;}
.dim-name{font-family:'Big Shoulders Display',sans-serif;font-size:22px;font-weight:700;line-height:1.1;}
.dim-interpretation{font-size:13px;color:var(--g2);line-height:1.7;font-weight:300;margin-bottom:12px;}
.dim-signal{font-size:12px;color:var(--g3);padding:10px 14px;background:var(--d2);border-left:2px solid var(--g4);}
.brecha-alert{margin-top:20px;padding:18px 22px;background:var(--warn10);border-left:3px solid var(--warn);}
.brecha-alert-title{font-family:'DM Mono',monospace;font-size:10px;text-transform:uppercase;color:var(--warn);margin-bottom:8px;}
.brecha-alert-desc{font-size:13px;color:var(--g2);line-height:1.6;}
.insights{display:flex;flex-direction:column;gap:20px;}
.insight{display:grid;grid-template-columns:3px 1fr;gap:16px;align-items:start;}
.insight-type{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px;}
.insight-type-pos{color:var(--p);}
.insight-type-neg{color:var(--g4);}
.insight-title{font-size:14px;font-weight:600;margin-bottom:8px;}
.insight-desc{font-size:13px;color:var(--g2);line-height:1.7;font-weight:300;}
.gaps{display:flex;flex-direction:column;gap:3px;}
.gap-item{display:grid;grid-template-columns:36px 1fr;gap:16px;padding:20px;background:var(--d1);align-items:start;}
.gap-n{font-family:'Big Shoulders Display',sans-serif;font-size:28px;font-weight:900;color:var(--p);line-height:1;}
.gap-title{font-size:13.5px;font-weight:600;margin-bottom:8px;}
.gap-action{font-size:13px;color:var(--g2);line-height:1.65;font-weight:300;}
.dist-row{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.dist-lbl{font-size:11px;color:var(--g3);width:130px;flex-shrink:0;}
.dist-track{flex:1;height:3px;background:var(--d3);border-radius:2px;overflow:hidden;}
.dist-fill{height:100%;border-radius:2px;}
.dist-fill-neutral{background:var(--g4);}
.dist-fill-you{background:var(--p);}
.you-row .dist-lbl{color:var(--wh);font-weight:600;}
.dist-pct{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);width:30px;text-align:right;}
.close-quote{padding:28px 36px;background:var(--d1);border-left:3px solid var(--p);}
.close-quote-text{font-size:15px;color:var(--g2);line-height:1.75;font-weight:300;font-style:italic;}
.ftr{padding:32px 60px;border-top:1px solid var(--border);}
</style></head><body><div class="doc">
<header class="hdr">
  <div class="hdr-top">
    <div><div class="brand-name">AI Pulse</div><div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.25em;text-transform:uppercase;margin-top:2px;">Diagnóstico de Madurez en IA</div></div>
    <div style="text-align:right"><div class="meta-date">${fecha}</div><div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--p);margin-top:4px;">Confidencial</div></div>
  </div>
  <div style="display:flex;align-items:baseline;gap:20px;flex-wrap:wrap;">
    <div class="recipient-name">${participant.nombre}</div>
    <div style="font-family:'Big Shoulders Display',sans-serif;font-size:42px;font-weight:900;color:var(--p);">${nivel}</div>
    <div style="font-family:'Big Shoulders Display',sans-serif;font-size:24px;font-weight:700;color:var(--g3);text-transform:uppercase;">${nivelNombre}</div>
  </div>
  <div class="recipient-role">
    <span>${participant.empresa}</span><div class="role-sep"></div>
    <span>${participant.departamento}</span><div class="role-sep"></div>
    <span>${participant.posicion}</span>
  </div>
</header>

<section class="sec">
  <div class="sec-label"><div class="sec-num">01</div><div class="sec-title">Tu Resultado AIQ</div><div class="sec-line"></div></div>
  <div style="display:flex;gap:36px;align-items:center;">
    <div>
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--p);text-transform:uppercase;letter-spacing:.25em;margin-bottom:8px;">Score total</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:64px;font-weight:900;color:var(--wh);line-height:1;">${scores.aiqScore?.toFixed(2)}</div>
      <div style="font-size:13px;color:var(--g4);">/ 5.0</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
      ${['A','B','C'].map(dim => {
        const score = dim==='A'?scores.sectionA:dim==='B'?scores.sectionB:scores.sectionC;
        const label = {A:'Experiencia Real',B:'Criterio Técnico',C:'Lab. Ejecución'}[dim];
        return `<div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--g3);margin-bottom:4px;">
            <span>${dim} — ${label}</span><span style="font-family:'DM Mono',monospace;color:var(--wh);">${score?.toFixed(2)}</span>
          </div>
          <div style="height:3px;background:var(--d3);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${Math.round((score/5)*100)}%;background:var(--p);border-radius:2px;"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div class="level-bar">${barraHTML}</div>
</section>

<section class="sec">
  <div class="sec-label"><div class="sec-num">02</div><div class="sec-title">Análisis por Dimensión</div><div class="sec-line"></div></div>
  <div class="dims">
    <div class="dim">
      <div class="dim-left"><div class="dim-code">Bloque A</div><div class="dim-name">Experiencia Real</div><div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--p);margin-top:8px;">${scores.sectionA?.toFixed(2)}</div></div>
      <div class="dim-right"><div class="dim-interpretation">${analysis.dim_a_interpretacion||''}</div><div class="dim-signal">${analysis.dim_a_gap||''}</div></div>
    </div>
    <div class="dim">
      <div class="dim-left"><div class="dim-code">Bloque B</div><div class="dim-name">Criterio Técnico</div><div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--p);margin-top:8px;">${scores.sectionB?.toFixed(2)}</div></div>
      <div class="dim-right"><div class="dim-interpretation">${analysis.dim_b_interpretacion||''}</div><div class="dim-signal">${analysis.dim_b_gap||''}</div></div>
    </div>
    <div class="dim">
      <div class="dim-left"><div class="dim-code">Bloque C</div><div class="dim-name">Lab. Ejecución</div><div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--p);margin-top:8px;">${scores.sectionC?.toFixed(2)}</div></div>
      <div class="dim-right"><div class="dim-interpretation">${analysis.dim_c_interpretacion||''}</div><div class="dim-signal">${analysis.dim_c_gap||''}</div></div>
    </div>
  </div>
  ${brechaHTML}
</section>

<section class="sec">
  <div class="sec-label"><div class="sec-num">03</div><div class="sec-title">Fortalezas y Oportunidades</div><div class="sec-line"></div></div>
  <div class="insights">${fortalezasHTML}${oportunidadesHTML}</div>
</section>

<section class="sec">
  <div class="sec-label"><div class="sec-num">04</div><div class="sec-title">Próximo Nivel — ${nivelSigNombre}</div><div class="sec-line"></div></div>
  <div style="font-size:13.5px;color:var(--g2);line-height:1.7;font-weight:300;margin-bottom:24px;">${analysis.proximo_nivel_descripcion||''}</div>
  <div class="gaps">${gapsHTML}</div>
</section>

<section class="sec">
  <div class="sec-label"><div class="sec-num">05</div><div class="sec-title">Contexto Organizacional</div><div class="sec-line"></div></div>
  <div style="margin-bottom:32px;">${distHTML}</div>
  <div class="close-quote"><div class="close-quote-text">${analysis.frase_cierre||''}</div></div>
</section>

<footer class="ftr">
  <div style="display:flex;justify-content:space-between;font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);">
    <span>AI Pulse · Diagnóstico AIQ Individual · ${fecha}</span>
    <span>javiercruz.ai</span>
  </div>
</footer>
</div></body></html>`;
}

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const { email } = body;
  if (!email) { context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta email" }) }; return; }

  const conn           = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const openaiKey      = process.env.AZURE_OPENAI_API_KEY;
  const openaiDeploy   = process.env.AZURE_OPENAI_DEPLOYMENT;
  const openaiVersion  = process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview";

  try {
    const resultsClient = TableClient.fromConnectionString(conn, "assessmentResults");
    let result = null;
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `email eq '${email}'` }
    })) { result = entity; break; }

    if (!result) { context.res = { status: 404, headers, body: JSON.stringify({ error: `No encontrado: ${email}` }) }; return; }

    let answers = {};
    try {
      if (result.answersA || result.answersB) {
        const v = result.answersV ? JSON.parse(result.answersV) : {};
        const a = result.answersA ? JSON.parse(result.answersA) : {};
        const b = result.answersB ? JSON.parse(result.answersB) : {};
        const cc = result.answersC ? JSON.parse(result.answersC) : {};
        const d = result.answersD ? JSON.parse(result.answersD) : {};
        answers = { ...v, ...a, ...b, ...cc, ...d };
      } else if (result.answers) { answers = JSON.parse(result.answers); }
    } catch {}

    const participant = { nombre: result.nombre||'', empresa: result.partitionKey||'', posicion: result.posicion||'', departamento: result.departamento||'' };
    const scores = { aiqScore: result.aiqScore||0, aiqLevel: result.aiqLevel||'L2', sectionA: result.sectionA||0, sectionB: result.sectionB||0, sectionC: result.sectionC||0 };

    const companyDist = { L1:0, L2:0, L3:0, L4:0, total:0 };
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${participant.empresa}'` }
    })) {
      const lvl = entity.aiqLevel;
      if (companyDist[lvl] !== undefined) companyDist[lvl]++;
      companyDist.total++;
    }

    const prompt = buildPrompt(participant, answers, scores, companyDist);
    const url = `${openaiEndpoint.replace(/\/$/, '')}/openai/deployments/${openaiDeploy}/chat/completions?api-version=${openaiVersion}`;

    let analysis;
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const aiResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': openaiKey },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'Eres el analista principal de AI Pulse. Respondes SOLO con JSON válido, sin markdown. Usa siempre tuteo (tú/tu/tus/te) — nunca usted/su/sus.' },
              { role: 'user', content: prompt }
            ],
            max_completion_tokens: 20000
          })
        });
        if (!aiResponse.ok) {
          const errBody = await aiResponse.text();
          throw new Error(`OpenAI ${aiResponse.status}: ${errBody.slice(0, 200)}`);
        }
        const aiData = await aiResponse.json();
        const rawText = aiData?.choices?.[0]?.message?.content || '';
        if (!rawText) {
          const reason = aiData?.choices?.[0]?.finish_reason;
          throw new Error(`OpenAI respuesta vacía. finish_reason=${reason}`);
        }
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        analysis = JSON.parse(cleaned);
        break;
      } catch (err) {
        lastErr = err;
        context.log.warn(`report-http OpenAI attempt ${attempt} failed: ${err.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 8000));
      }
    }
    if (!analysis) throw lastErr;
    const html = generateHTML(participant, scores, answers, analysis, companyDist);

    const lockName = `individual/${email.replace(/[@.]/g, '_')}_lock.json`;
    // Guardar blob
    try {
      const blobName = blobNameForEmail(email);
      const containerClient = BlobServiceClient.fromConnectionString(conn).getContainerClient("aiq-reports");
      await containerClient.createIfNotExists();
      const buf = Buffer.from(html, "utf-8");
      await containerClient.getBlockBlobClient(blobName).upload(buf, buf.length, {
        blobHTTPHeaders: { blobContentType: "text/html; charset=utf-8" }, overwrite: true
      });
      // Borrar lock — reporte listo
      await containerClient.getBlockBlobClient(lockName).deleteIfExists();
    } catch (blobErr) { context.log.warn("Blob save failed:", blobErr.message); }

    // Actualizar coachEnabled
    try {
      await resultsClient.updateEntity({
        partitionKey: result.partitionKey, rowKey: result.rowKey,
        coachEnabled: true, reportAnalysis: JSON.stringify(analysis),
        reportGeneratedAt: new Date().toISOString(), reportStatus: "ready",
      }, "Merge");
    } catch (persistErr) { context.log.warn("Persist failed:", persistErr.message); }

    context.res = { status: 200, headers, body: JSON.stringify({ success: true, html }) };

  } catch (err) {
    context.log.error("report-http error:", err.message);
    // Borrar lock en fallo para permitir reintento
    try {
      await BlobServiceClient.fromConnectionString(conn)
        .getContainerClient("aiq-reports")
        .getBlockBlobClient(`individual/${email.replace(/[@.]/g, '_')}_lock.json`)
        .deleteIfExists();
    } catch {}
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
