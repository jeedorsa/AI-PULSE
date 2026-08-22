/**
 * report-processor — Queue-triggered Azure Function
 *
 * Se dispara cuando results-save encola { email, empresa, token } en
 * la queue "report-generation". Genera el informe AIQ individual en
 * background, lo guarda en Blob Storage y activa coachEnabled en
 * Table Storage. El admin sólo lee el blob — respuesta instantánea.
 *
 * Retry automático: Azure reencola si falla, hasta maxDequeueCount=5.
 */

const { TableClient } = require("@azure/data-tables");
const { BlobServiceClient } = require("@azure/storage-blob");

const { chatCompletion } = require("../shared/llmClient");

// ── Constantes (idénticas a api/report-generate/index.js) ────────
const V2_OPT = { 1: 'Colaborador individual', 2: 'Manager o Líder de equipo', 3: 'Director', 4: 'VP o C-Suite' };
const V3_OPT = { 1: 'Menos de 1 año', 2: '1 a 3 años', 3: '3 a 5 años', 4: 'Más de 5 años' };
const E3_OPT = { 1: 'No lo noto', 2: 'Repito la pregunta igual', 3: 'Ajusto el prompt manualmente', 4: 'Aplico un proceso sistemático de corrección', 5: 'Comparto la lección con mi equipo' };
const E4_OPT = { 1: 'No la uso', 2: 'Busco definiciones rápidas', 3: 'Pido analogías y explicaciones adaptadas a mi contexto', 4: 'Diseño un plan de estudio y genero casos prácticos con la IA' };
const B1_OPT = { 1: 'Confío si suena bien', 2: 'Búsqueda rápida en Google', 3: 'Método sistemático de verificación cruzada' };
const D1_OPT = { 1: 'Nunca ha habido incentivo', 2: 'Menciones generales sin acciones', 3: 'He recibido recursos o tiempo específico', 4: 'Existe una estrategia clara con liderazgo' };
const D9_OPT = { 1: 'Me genera incertidumbre', 2: 'Tengo curiosidad pero no sé cómo afectará', 3: 'Lo veo como oportunidad de crecimiento', 4: 'La IA ya es central en mi desarrollo profesional' };
const E5_OPT = { 1: 'No', 2: 'Comparto prompts puntuales', 3: 'Enseño técnicas y resuelvo dudas', 4: 'Lidero la adopción y creo recursos compartidos' };
const NIVEL_NOMBRES = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4: 'Amplificador' };
const NIVEL_SIGUIENTE = { L1: 'L2', L2: 'L3', L3: 'L4', L4: 'L4' };

function blobNameForEmail(email) {
  return `individual/${email.replace(/[@.]/g, '_')}.html`;
}

function resolveAnswer(id, raw) {
  if (raw === undefined || raw === null) return '(no respondida)';
  switch (id) {
    case 'V1': return typeof raw === 'string' ? raw : '';
    case 'V2': return V2_OPT[raw?.value] || '';
    case 'V3': return V3_OPT[raw?.value] || '';
    case 'V4': return (raw?.selected || []).join(', ');
    case 'E2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'E3': return E3_OPT[raw?.value] || '';
    case 'E4': return E4_OPT[raw?.value] || '';
    case 'E5': return typeof raw === 'string' ? raw : (E5_OPT[raw?.value] || '');
    case 'B1': return B1_OPT[raw?.value] || '';
    case 'B2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B3': return (raw?.selected || []).join(', ');
    case 'B4': return [(raw?.selected || []).join(', '), raw?.text || ''].filter(Boolean).join(' — ');
    case 'B5': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B6': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'C1': return raw?.text || '';
    case 'C2': return raw?.text || '';
    case 'C3': return raw?.text || '';
    case 'D1': return [D1_OPT[raw?.value] || '', raw?.text || ''].filter(Boolean).join(' — ');
    case 'D2': return typeof raw === 'string' ? raw : '';
    case 'D3': {
      const sel = raw?.selected || [];
      const ori = raw?.origins || {};
      return sel.map(t => ori[t] ? `${t} (${ori[t]})` : t).join(', ');
    }
    case 'D4': return typeof raw === 'string' ? raw : '';
    case 'D5': return [raw?.choice || '', raw?.text || ''].filter(Boolean).join(' — ');
    case 'D6': return typeof raw === 'string' ? raw : '';
    case 'D7': return typeof raw === 'string' ? raw : '';
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
- Área declarada: ${ans('V1')}
- Nivel jerárquico: ${ans('V2')}
- Años en el rol: ${ans('V3')}
- Herramientas IA que usa: ${ans('V4')}

RESULTADO AIQ:
- Nivel: ${nivel} — ${nivelNombre}
- Score total: ${scores.aiqScore?.toFixed(2)} / 5.0
- Dimensión A (Experiencia Real, 30%): ${scores.sectionA?.toFixed(2)} / 5.0
- Dimensión B (Criterio Técnico, 30%): ${scores.sectionB?.toFixed(2)} / 5.0
- Dimensión C (Laboratorio de Ejecución, 40%): ${scores.sectionC?.toFixed(2)} / 5.0

RESPUESTAS COMPLETAS DEL PARTICIPANTE:

[BLOQUE A — EXPERIENCIA REAL CON IA]
E2 — Último entregable con IA:
"${ans('E2')}"

E3 — Reacción ante resultado incorrecto de la IA:
"${ans('E3')}"

E4 — Cómo usa la IA ante un tema desconocido:
"${ans('E4')}"

E5 — Qué ha enseñado o compartido sobre IA:
"${ans('E5')}"

[BLOQUE B — CRITERIO Y CAPACIDADES TÉCNICAS]
B1 — Cómo verifica datos de la IA:
"${ans('B1')}"

B2 — Información corporativa que evita compartir:
"${ans('B2')}"

B3 — Usos de IA este mes:
"${ans('B3')}"

B4 — Tipos de archivos analizados con IA:
"${ans('B4')}"

B5 — Tarea repetitiva delegada a la IA:
"${ans('B5')}"

B6 — IA con información específica de la empresa:
"${ans('B6')}"

[BLOQUE C — LABORATORIO DE EJECUCIÓN]
C1 — Prompt email cliente VIP con retraso:
"${ans('C1')}"

C2 — Mejora de prompt:
"${ans('C2')}"

C3 — Prompt con razonamiento paso a paso:
"${ans('C3')}"

[BLOQUE D — CULTURA Y FUTURO]
D1 — Apoyo de la empresa al uso de IA:
"${ans('D1')}"

D2 — IA mal vista en el equipo:
"${ans('D2')}"

D3 — Herramientas que usa (empresa vs. propias):
"${ans('D3')}"

D4 — Herramienta que necesita y no tiene:
"${ans('D4')}"

D5 — Espacios para compartir IA en la empresa:
"${ans('D5')}"

D6 — Políticas de uso responsable que conoce:
"${ans('D6')}"

D7 — Decisión de NO usar IA por razones éticas:
"${ans('D7')}"

D9 — Cómo ve el futuro de su rol con la IA:
"${ans('D9')}"

INSTRUCCIONES:
Genera el análisis narrativo para el informe AIQ individual. Responde SOLO con un objeto JSON válido, sin markdown ni texto extra, con exactamente esta estructura:

{
  "dim_a_interpretacion": "2-3 oraciones analizando la Dimensión A basadas EN LAS RESPUESTAS REALES.",
  "dim_a_gap": "1 oración concreta sobre qué falta en esta dimensión para subir de nivel.",
  "dim_b_interpretacion": "2-3 oraciones analizando la Dimensión B.",
  "dim_b_gap": "1 oración concreta sobre qué falta en esta dimensión.",
  "dim_c_interpretacion": "2-3 oraciones analizando los prompts C1, C2, C3.",
  "dim_c_gap": "1 oración concreta sobre qué falta en los prompts para el siguiente nivel.",
  "brecha_detectada": true o false,
  "brecha_texto": "Si brecha_detectada es true: 1-2 oraciones. Si es false: string vacío.",
  "fortalezas": [{"titulo": "...", "descripcion": "..."}],
  "oportunidades": [{"titulo": "...", "descripcion": "..."}],
  "proximo_nivel_descripcion": "2 oraciones sobre qué significa ser ${nivelSiguienteNombre} en su contexto.",
  "gaps": [{"titulo": "...", "accion": "..."}],
  "frase_cierre": "1 frase final motivacional pero honesta."
}

REGLAS: Mínimo 2 fortalezas, máximo 3. Mínimo 2 oportunidades, máximo 3. Exactamente 3 gaps. NUNCA elogios vacíos. Tono consultor senior, no coach motivacional. Adapta al nivel jerárquico: ${ans('V2')}.`;
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

  const topPct = niveles.filter(n => niveles.indexOf(n) >= niveles.indexOf(nivel)).reduce((acc, n) => acc + (companyDist[n] || 0), 0);
  const topPctText = companyDist.total > 1 ? `Estás en el top ${Math.round((topPct / companyDist.total) * 100)}% de la organización` : '';

  const fortalezasHTML = (analysis.fortalezas || []).map(f => `
    <div class="insight">
      <div style="width:3px;background:var(--p);border-radius:2px;align-self:stretch;min-height:60px;"></div>
      <div>
        <div class="insight-type insight-type-pos">Fortaleza detectada</div>
        <div class="insight-title">${f.titulo}</div>
        <div class="insight-desc">${f.descripcion}</div>
      </div>
    </div>`).join('');

  const oportunidadesHTML = (analysis.oportunidades || []).map(o => `
    <div class="insight">
      <div style="width:3px;background:var(--g4);border-radius:2px;align-self:stretch;min-height:60px;"></div>
      <div>
        <div class="insight-type insight-type-neg">Oportunidad de desarrollo</div>
        <div class="insight-title">${o.titulo}</div>
        <div class="insight-desc">${o.descripcion}</div>
      </div>
    </div>`).join('');

  const gapsHTML = (analysis.gaps || []).map((g, i) => `
    <div class="gap-item">
      <div class="gap-n">${i + 1}</div>
      <div>
        <div class="gap-title">${g.titulo}</div>
        <div class="gap-action">${g.accion}</div>
      </div>
    </div>`).join('');

  const brechaHTML = analysis.brecha_detectada ? `
    <div class="brecha-alert">
      <div class="brecha-alert-title">⚠ Brecha detectada — perfil desequilibrado</div>
      <div class="brecha-alert-desc">${analysis.brecha_texto}</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Informe AIQ — ${participant.nombre}</title>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--p:#FE3C1C;--p10:rgba(254,60,28,0.07);--p20:rgba(254,60,28,0.15);--p40:rgba(254,60,28,0.3);--bk:#FFFFFF;--d1:#F7F7F7;--d2:#F0F0F0;--d3:#E4E4E4;--g4:#AAAAAA;--g3:#777777;--g2:#444444;--wh:#111111;--border:#E4E4E4;--warn:#D97706;--warn10:rgba(217,119,6,0.07);--warn20:rgba(217,119,6,0.18);}
body{background:var(--bk);color:var(--wh);font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased;}
.doc{max-width:860px;margin:0 auto;padding:0 0 80px;}
.hdr{padding:48px 60px 40px;border-bottom:1px solid var(--border);}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;}
.brand-mark{display:flex;align-items:center;gap:12px;}
.brand-icon{width:36px;height:36px;border:1px solid var(--p40);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--p10);}
.brand-icon span{font-family:'Big Shoulders Display',sans-serif;font-size:13px;font-weight:700;color:var(--p);letter-spacing:.05em;}
.brand-name{font-family:'Big Shoulders Display',sans-serif;font-size:18px;font-weight:700;color:var(--wh);letter-spacing:.08em;text-transform:uppercase;}
.brand-sub{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.25em;text-transform:uppercase;margin-top:2px;}
.meta-date{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);letter-spacing:.2em;text-transform:uppercase;}
.meta-conf{font-family:'DM Mono',monospace;font-size:10px;color:var(--p);letter-spacing:.15em;text-transform:uppercase;margin-top:4px;}
.recipient-name{font-family:'Big Shoulders Display',sans-serif;font-size:42px;font-weight:700;line-height:1;color:var(--wh);text-transform:uppercase;letter-spacing:.5px;}
.recipient-role{font-size:13px;color:var(--g3);margin-top:6px;display:flex;align-items:center;gap:8px;}
.recipient-role span{color:var(--g2);font-weight:500;}
.role-sep{width:3px;height:3px;border-radius:50%;background:var(--g4);}
.sec{padding:48px 60px;border-bottom:1px solid var(--border);}
.sec:last-child{border-bottom:none;}
.sec-label{display:flex;align-items:center;gap:14px;margin-bottom:28px;}
.sec-num{font-family:'DM Mono',monospace;font-size:10px;color:var(--p);opacity:.5;letter-spacing:.2em;}
.sec-title{font-family:'Big Shoulders Display',sans-serif;font-size:11px;letter-spacing:.35em;text-transform:uppercase;color:var(--g4);}
.sec-line{flex:1;height:1px;background:linear-gradient(to right,var(--border),transparent);}
.intro-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-top:20px;}
.intro-card{padding:22px 20px;background:var(--d1);}
.intro-card-lbl{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);margin-bottom:10px;}
.intro-card-name{font-size:13px;font-weight:600;color:var(--wh);margin-bottom:6px;}
.intro-card-desc{font-size:11.5px;color:var(--g3);line-height:1.55;font-weight:300;}
.intro-note{margin-top:20px;padding:16px 20px;background:var(--p10);border-left:2px solid var(--p);font-size:12.5px;color:var(--g2);line-height:1.6;}
.result-main{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:center;}
.result-name-big{font-family:'Big Shoulders Display',sans-serif;font-size:64px;font-weight:900;line-height:.9;color:var(--wh);text-transform:uppercase;letter-spacing:-1px;margin-bottom:4px;}
.result-name-big em{color:var(--p);font-style:normal;}
.result-tag{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.25em;color:var(--p);text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:10px;}
.result-desc{font-size:13.5px;color:var(--g2);line-height:1.7;font-weight:300;max-width:480px;}
.result-desc strong{color:var(--wh);font-weight:600;}
.level-bar{display:flex;gap:3px;margin-top:28px;}
.lbar-item{flex:1;padding:12px 10px 10px;background:var(--d1);}
.lbar-item.active{background:var(--p10);border:1px solid var(--p40);}
.lbar-item.past{opacity:.5;}
.lbar-name{display:block;font-size:11px;font-weight:500;color:var(--wh);margin-bottom:4px;}
.lbar-code{display:block;font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.1em;}
.lbar-item.active .lbar-code{color:var(--p);}
.dims{display:flex;flex-direction:column;gap:3px;}
.dim{display:grid;grid-template-columns:140px 1fr;gap:0;background:var(--d1);}
.dim-left{padding:24px 20px;border-right:1px solid var(--border);}
.dim-right{padding:24px 24px;}
.dim-code{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);margin-bottom:8px;}
.dim-name{font-family:'Big Shoulders Display',sans-serif;font-size:22px;font-weight:700;line-height:1.1;color:var(--wh);}
.dim-interpretation{font-size:13px;color:var(--g2);line-height:1.7;font-weight:300;margin-bottom:12px;}
.dim-signal{font-size:12px;color:var(--g3);line-height:1.6;padding:10px 14px;background:var(--d2);border-left:2px solid var(--g4);}
.brecha-alert{margin-top:20px;padding:18px 22px;background:var(--warn10);border:1px solid var(--warn20);border-left:3px solid var(--warn);}
.brecha-alert-title{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--warn);margin-bottom:8px;}
.brecha-alert-desc{font-size:13px;color:var(--g2);line-height:1.6;}
.insights{display:flex;flex-direction:column;gap:20px;}
.insight{display:grid;grid-template-columns:3px 1fr;gap:16px;align-items:start;}
.insight-type{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px;}
.insight-type-pos{color:var(--p);}
.insight-type-neg{color:var(--g4);}
.insight-title{font-size:14px;font-weight:600;color:var(--wh);margin-bottom:8px;line-height:1.4;}
.insight-desc{font-size:13px;color:var(--g2);line-height:1.7;font-weight:300;}
.next-from-to{display:flex;align-items:center;gap:20px;margin-bottom:20px;}
.next-lvl{padding:16px 20px;background:var(--d1);flex:1;}
.next-lvl.target{background:var(--p10);border:1px solid var(--p40);}
.next-lvl-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);display:block;margin-bottom:6px;}
.next-lvl.target .next-lvl-label{color:var(--p);}
.next-lvl-name{font-family:'Big Shoulders Display',sans-serif;font-size:20px;font-weight:700;color:var(--wh);}
.next-arrow{font-size:24px;color:var(--g4);flex-shrink:0;}
.next-desc{font-size:13.5px;color:var(--g2);line-height:1.7;font-weight:300;margin-bottom:24px;}
.gaps{display:flex;flex-direction:column;gap:3px;}
.gap-item{display:grid;grid-template-columns:36px 1fr;gap:16px;padding:20px;background:var(--d1);align-items:start;}
.gap-n{font-family:'Big Shoulders Display',sans-serif;font-size:28px;font-weight:900;color:var(--p);line-height:1;}
.gap-title{font-size:13.5px;font-weight:600;color:var(--wh);margin-bottom:8px;}
.gap-action{font-size:13px;color:var(--g2);line-height:1.65;font-weight:300;}
.context-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:32px;}
.ctx-card{padding:24px;background:var(--d1);}
.ctx-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);margin-bottom:16px;}
.dist-row{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.dist-lbl{font-size:11px;color:var(--g3);width:130px;flex-shrink:0;}
.dist-track{flex:1;height:3px;background:var(--d3);border-radius:2px;overflow:hidden;}
.dist-fill{height:100%;border-radius:2px;}
.dist-fill-neutral{background:var(--g4);}
.dist-fill-you{background:var(--p);}
.you-row .dist-lbl{color:var(--wh);font-weight:600;}
.dist-pct{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);width:30px;text-align:right;}
.dist-footnote{font-family:'DM Mono',monospace;font-size:9px;color:var(--p);letter-spacing:.1em;margin-top:12px;}
.close-quote{padding:28px 36px;background:var(--d1);border-left:3px solid var(--p);}
.close-quote-text{font-size:15px;color:var(--g2);line-height:1.75;font-weight:300;font-style:italic;}
.ftr{padding:32px 60px;border-top:1px solid var(--border);}
.ftr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;}
</style>
</head>
<body>
<div class="doc">

<header class="hdr">
  <div class="hdr-top">
    <div class="brand-mark">
      <div class="brand-icon"><span>AIQ</span></div>
      <div>
        <div class="brand-name">AI Pulse</div>
        <div class="brand-sub">Diagnóstico de Madurez en IA</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);margin-top:4px;">Preparado por <span style="color:var(--wh);font-weight:500;">Javier Cruz</span> · javiercruz.ai</div>
      </div>
    </div>
    <div>
      <div class="meta-date">${fecha} · Diagnóstico Enterprise v2.0</div>
      <div class="meta-conf">Confidencial · Solo para el evaluado</div>
    </div>
  </div>
  <div style="display:flex;align-items:baseline;gap:20px;flex-wrap:wrap;">
    <div class="recipient-name">${participant.nombre}</div>
    <div style="display:flex;align-items:baseline;gap:8px;padding-bottom:4px;">
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:42px;font-weight:900;line-height:1;color:var(--p);letter-spacing:-1px;">${nivel}</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:24px;font-weight:700;color:var(--g3);text-transform:uppercase;">${nivelNombre}</div>
    </div>
  </div>
  <div class="recipient-role">
    <span>${participant.empresa}</span>
    <div class="role-sep"></div>
    <span>${participant.departamento}</span>
    <div class="role-sep"></div>
    <span>${participant.posicion}</span>
  </div>
</header>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">01</div>
    <div class="sec-title">Qué medimos y cómo</div>
    <div class="sec-line"></div>
  </div>
  <p style="font-size:14px;color:var(--g2);line-height:1.7;font-weight:300;margin-bottom:20px;max-width:640px;">
    Este diagnóstico no mide cuánto <em>sabes</em> sobre inteligencia artificial. Mide algo más valioso: <strong style="color:var(--wh);font-weight:600;">cómo la usas hoy en tu trabajo real</strong>.
  </p>
  <div class="intro-grid">
    <div class="intro-card">
      <div class="intro-card-lbl">Bloque A · 30%</div>
      <div class="intro-card-name">Tu Experiencia Real con IA</div>
      <div class="intro-card-desc">Comportamiento real ante situaciones concretas. Lo más difícil de falsificar.</div>
    </div>
    <div class="intro-card">
      <div class="intro-card-lbl">Bloque B · 30%</div>
      <div class="intro-card-name">Criterio y Capacidades Técnicas</div>
      <div class="intro-card-desc">Comprensión aplicada de los conceptos más relevantes para usar la IA con criterio.</div>
    </div>
    <div class="intro-card">
      <div class="intro-card-lbl">Bloque C · 40%</div>
      <div class="intro-card-name">Laboratorio de Ejecución</div>
      <div class="intro-card-desc">Escribiste prompts reales en vivo. Imposible inflar este resultado.</div>
    </div>
  </div>
  <div class="intro-note">
    El diagnóstico incluyó preguntas sobre <strong>cultura y contexto organizacional</strong>. Esa información alimenta el reporte de tu empresa, pero no afecta tu nivel AIQ individual.
  </div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">02</div>
    <div class="sec-title">Tu Resultado AIQ</div>
    <div class="sec-line"></div>
  </div>
  <div class="result-main">
    <div>
      <div class="result-tag"><span>Nivel actual</span></div>
      <div class="result-name-big"><em>${nivel}</em></div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:20px;color:var(--g3);text-transform:uppercase;margin-top:4px;">${nivelNombre}</div>
    </div>
    <div>
      <div class="result-tag">Score total — <strong style="color:var(--wh);">${scores.aiqScore?.toFixed(2)}</strong> / 5.0</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${['A','B','C'].map(dim => {
          const score = dim === 'A' ? scores.sectionA : dim === 'B' ? scores.sectionB : scores.sectionC;
          const pct = (score / 5) * 100;
          const label = { A: 'Experiencia Real', B: 'Criterio Técnico', C: 'Lab. Ejecución' }[dim];
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--g3);margin-bottom:4px;">
              <span>${dim} — ${label}</span><span style="font-family:'DM Mono',monospace;color:var(--wh);">${score?.toFixed(2)}</span>
            </div>
            <div style="height:3px;background:var(--d3);border-radius:2px;overflow:hidden;">
              <div style="height:100%;width:${Math.round(pct)}%;background:var(--p);border-radius:2px;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>
  <div class="level-bar">${barraHTML}</div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">03</div>
    <div class="sec-title">Análisis por Dimensión</div>
    <div class="sec-line"></div>
  </div>
  <div class="dims">
    <div class="dim">
      <div class="dim-left">
        <div class="dim-code">Bloque A</div>
        <div class="dim-name">Experiencia Real</div>
        <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--p);margin-top:8px;">${scores.sectionA?.toFixed(2)}</div>
      </div>
      <div class="dim-right">
        <div class="dim-interpretation">${analysis.dim_a_interpretacion || ''}</div>
        <div class="dim-signal">${analysis.dim_a_gap || ''}</div>
      </div>
    </div>
    <div class="dim">
      <div class="dim-left">
        <div class="dim-code">Bloque B</div>
        <div class="dim-name">Criterio Técnico</div>
        <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--p);margin-top:8px;">${scores.sectionB?.toFixed(2)}</div>
      </div>
      <div class="dim-right">
        <div class="dim-interpretation">${analysis.dim_b_interpretacion || ''}</div>
        <div class="dim-signal">${analysis.dim_b_gap || ''}</div>
      </div>
    </div>
    <div class="dim">
      <div class="dim-left">
        <div class="dim-code">Bloque C</div>
        <div class="dim-name">Lab. Ejecución</div>
        <div style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--p);margin-top:8px;">${scores.sectionC?.toFixed(2)}</div>
      </div>
      <div class="dim-right">
        <div class="dim-interpretation">${analysis.dim_c_interpretacion || ''}</div>
        <div class="dim-signal">${analysis.dim_c_gap || ''}</div>
      </div>
    </div>
  </div>
  ${brechaHTML}
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">04</div>
    <div class="sec-title">Fortalezas y Oportunidades</div>
    <div class="sec-line"></div>
  </div>
  <div class="insights">
    ${fortalezasHTML}
    ${oportunidadesHTML}
  </div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">05</div>
    <div class="sec-title">Próximo Nivel — ${nivelSigNombre}</div>
    <div class="sec-line"></div>
  </div>
  <div class="next-from-to">
    <div class="next-lvl"><span class="next-lvl-label">Nivel actual</span><div class="next-lvl-name">${nivel} — ${nivelNombre}</div></div>
    <div class="next-arrow">→</div>
    <div class="next-lvl target"><span class="next-lvl-label">Siguiente nivel</span><div class="next-lvl-name">${nivelSigKey} — ${nivelSigNombre}</div></div>
  </div>
  <div class="next-desc">${analysis.proximo_nivel_descripcion || ''}</div>
  <div class="gaps">${gapsHTML}</div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">06</div>
    <div class="sec-title">Contexto Organizacional</div>
    <div class="sec-line"></div>
  </div>
  <div class="context-grid">
    <div class="ctx-card">
      <div class="ctx-label">Distribución en ${participant.empresa}</div>
      ${distHTML}
      ${topPctText ? `<div class="dist-footnote">${topPctText}</div>` : ''}
    </div>
    <div class="ctx-card">
      <div class="ctx-label">Herramientas que utilizas</div>
      <div style="font-size:13px;color:var(--g2);line-height:1.7;">${herramientas}</div>
    </div>
  </div>
  <div class="close-quote">
    <div class="close-quote-text">${analysis.frase_cierre || ''}</div>
  </div>
</section>

<footer class="ftr">
  <div class="ftr-top">
    <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.15em;text-transform:uppercase;">AI Pulse · Diagnóstico AIQ Individual · ${fecha}</div>
    <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.1em;">Generado automáticamente · javiercruz.ai</div>
  </div>
</footer>

</div>
</body>
</html>`;
}

// ── Handler principal ─────────────────────────────────────────────
module.exports = async function (context, queueMessage) {
  // Azure Functions decodifica el base64 automáticamente
  let msg;
  try {
    msg = typeof queueMessage === 'string' ? JSON.parse(queueMessage) : queueMessage;
  } catch {
    context.log.error('Mensaje de queue inválido:', queueMessage);
    return; // drop — no reencolar
  }

  const { email, empresa } = msg;
  if (!email) { context.log.error('Mensaje sin email — drop'); return; }

  context.log.info(`[report-processor] Iniciando para ${email} (${empresa})`);

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const openaiKey = process.env.AZURE_OPENAI_API_KEY;
  const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const openaiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  const resultsClient = TableClient.fromConnectionString(conn, "assessmentResults");

  // 1. Obtener resultado del participante
  let result = null;
  for await (const entity of resultsClient.listEntities({
    queryOptions: { filter: `email eq '${email}'` }
  })) { result = entity; break; }

  if (!result) {
    context.log.error(`No se encontró resultado para ${email}`);
    return; // drop
  }

  // 2. Rearmar answers
  let answers = {};
  try {
    if (result.answersA || result.answersB || result.answersC) {
      const v = result.answersV ? JSON.parse(result.answersV) : {};
      const a = result.answersA ? JSON.parse(result.answersA) : {};
      const b = result.answersB ? JSON.parse(result.answersB) : {};
      const cc = result.answersC ? JSON.parse(result.answersC) : {};
      const d = result.answersD ? JSON.parse(result.answersD) : {};
      answers = { ...v, ...a, ...b, ...cc, ...d };
    } else if (result.answers) {
      answers = JSON.parse(result.answers);
    }
  } catch {}

  const participant = {
    nombre: result.nombre || '',
    empresa: result.partitionKey || '',
    posicion: result.posicion || '',
    departamento: result.departamento || ''
  };

  const scores = {
    aiqScore: result.aiqScore || 0,
    aiqLevel: result.aiqLevel || 'L2',
    sectionA: result.sectionA || 0,
    sectionB: result.sectionB || 0,
    sectionC: result.sectionC || 0
  };

  // 3. Distribución de empresa
  const companyDist = { L1: 0, L2: 0, L3: 0, L4: 0, total: 0 };
  for await (const entity of resultsClient.listEntities({
    queryOptions: { filter: `PartitionKey eq '${participant.empresa}'` }
  })) {
    const lvl = entity.aiqLevel;
    if (companyDist[lvl] !== undefined) companyDist[lvl]++;
    companyDist.total++;
  }

  // 4. Llamar Azure OpenAI
  context.log.info(`[report-processor] Llamando OpenAI para ${email}`);
  const prompt = buildPrompt(participant, answers, scores, companyDist);

  const aiResponse = await chatCompletion({
      messages: [
        { role: 'system', content: 'Eres el analista principal de AI Pulse. Respondes SOLO con JSON válido, sin markdown.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 20000
    });

  if (!aiResponse.ok) {
    const errBody = await aiResponse.text();
    context.log.error(`OpenAI error ${aiResponse.status}:`, errBody.slice(0, 300));
    throw new Error(`OpenAI ${aiResponse.status}`); // reencola automáticamente
  }

  const aiData = await aiResponse.json();
  const rawText = aiData?.choices?.[0]?.message?.content || '';
  if (!rawText) throw new Error('OpenAI devolvió respuesta vacía');

  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const analysis = JSON.parse(cleaned);

  // 5. Generar HTML
  const html = generateHTML(participant, scores, answers, analysis, companyDist);

  // 6. Guardar en Blob Storage
  const blobName = blobNameForEmail(email);
  const containerClient = BlobServiceClient
    .fromConnectionString(conn)
    .getContainerClient("aiq-reports");
  await containerClient.createIfNotExists();
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const htmlBuffer = Buffer.from(html, "utf-8");
  await blobClient.upload(htmlBuffer, htmlBuffer.length, {
    blobHTTPHeaders: { blobContentType: "text/html; charset=utf-8" },
    overwrite: true
  });
  context.log.info(`[report-processor] Blob guardado: ${blobName}`);

  // 7. Actualizar Table Storage
  await resultsClient.updateEntity({
    partitionKey: result.partitionKey,
    rowKey:       result.rowKey,
    coachEnabled:      true,
    reportAnalysis:    JSON.stringify(analysis),
    reportGeneratedAt: new Date().toISOString(),
    reportStatus:      "ready",
    reportBlobName:    blobName,
  }, "Merge");

  context.log.info(`[report-processor] Listo para ${email}`);
};
