/**
 * company-report-processor — Queue-triggered Azure Function
 * Queue: company-report-generation
 * Genera el informe enterprise AIQ en background y lo guarda en Blob Storage.
 */

const { TableClient } = require("@azure/data-tables");
const { BlobServiceClient } = require("@azure/storage-blob");

// ── Constantes ────────────────────────────────────────────────────
const V2_OPT = { 1: 'Colaborador individual', 2: 'Manager o Líder de equipo', 3: 'Director', 4: 'VP o C-Suite' };
const NIVEL_CODIGO = {
  'VP o C-Suite': 'EJE', 'Director': 'DIR',
  'Manager o Líder de equipo': 'MGR', 'Supervisor': 'SPV', 'Colaborador individual': 'COL'
};

function blobNameForEmpresa(empresa) {
  return `company/${empresa.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
}

function assembleAnswers(entity) {
  if (entity.answersV || entity.answersA) {
    const v  = entity.answersV ? JSON.parse(entity.answersV) : {};
    const a  = entity.answersA ? JSON.parse(entity.answersA) : {};
    const b  = entity.answersB ? JSON.parse(entity.answersB) : {};
    const cc = entity.answersC ? JSON.parse(entity.answersC) : {};
    const d  = entity.answersD ? JSON.parse(entity.answersD) : {};
    return { ...v, ...a, ...b, ...cc, ...d };
  }
  try { return JSON.parse(entity.answers || '{}'); } catch { return {}; }
}

function safeNum(v) { return typeof v === 'number' && !isNaN(v) ? v : 0; }

// ── Prompts (idénticos a api/report-generate-company) ────────────
function buildPrompt1(empresa, participantes) {
  const jsons = participantes.map(p => ({
    nombre: p.nombre, posicion: p.posicion, nivel_codigo: p.nivelCodigo,
    departamento: p.departamento, aiq_final: safeNum(p.aiqScore),
    nivel: p.aiqLevel, seccion_a: safeNum(p.sectionA),
    seccion_b: safeNum(p.sectionB), seccion_c: safeNum(p.sectionC),
    challenge_profile: p.challengeProfile, alerts: p.alerts || [],
    b2_score: p.b2_raw, d3_herramientas: p.answers?.D3?.selected || [],
    d5_espacios: p.answers?.D5?.choice || '', d6_politicas: p.answers?.D6 || '',
    d1_apoyo: p.answers?.D1?.value || 0,
  }));

  return `Eres el analizador Enterprise del AIQ Framework de AI Pulse.
Recibes los JSONs de evaluación individual de todos los encuestados de una organización
y produces un único objeto JSON consolidado con las métricas organizacionales.
Responde ÚNICAMENTE con el JSON consolidado — sin texto antes ni después.

EMPRESA: ${empresa}
FECHA: ${new Date().toISOString().slice(0,10)}
JSONS INDIVIDUALES:
${JSON.stringify(jsons, null, 2)}

CÁLCULOS REQUERIDOS:
- n_total, aiq_promedio, aiq_desviacion, aiq_max, aiq_min
- nivel_organizacional (L1<2.0 / L2=2.0-2.9 / L3=3.0-3.4 / L4T=3.5-4.4 / L4L>=4.5), nombre_nivel_organizacional
- seccion_a_promedio, seccion_b_promedio, seccion_c_promedio
- distribucion_niveles: n_l1/pct_l1 ... n_l4l/pct_l4l
- por_jerarquia (EJE/DIR/MGR/SPV/COL): n, aiq_promedio, seccion_a/b/c, nivel_predominante, regla1_activos
- arquetipo: "Organización Dormida" / "Organización Fragmentada" / "Organización en Transición" / "Organización Amplificada"
- patron_jerarquico: lideres_adelante, colaboradores_adelante, homogeneo_bajo
- brechas: gobernanza/comunicacion/habilitacion/liderazgo/adopcion con activa/severidad/n_afectados
- fortalezas: liderazgo_adelante/capacidad_avanzada_existe/n_perfiles_avanzados/motivacion_espontanea/max_laboratorio
- flags_criticos: riesgo_gobernanza_critico, n_perfiles_con_pausa

OUTPUT JSON EXACTO:
{
  "metadata": {"empresa": "${empresa}", "fecha_reporte": "${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}", "n_total": 0, "version_framework": "AIQ v2.0"},
  "metricas_globales": {"aiq_promedio": 0, "aiq_desviacion": 0, "aiq_max": 0, "aiq_min": 0, "nivel_organizacional": "", "nombre_nivel_organizacional": "", "seccion_a_promedio": 0, "seccion_b_promedio": 0, "seccion_c_promedio": 0},
  "distribucion_niveles": {"n_l1": 0, "pct_l1": 0, "n_l2": 0, "pct_l2": 0, "n_l3": 0, "pct_l3": 0, "n_l4t": 0, "pct_l4t": 0, "n_l4l": 0, "pct_l4l": 0},
  "por_jerarquia": {"EJE": {"n":0,"aiq_promedio":0,"seccion_a":0,"seccion_b":0,"seccion_c":0,"nivel_predominante":"","regla1_activos":0},"DIR":{"n":0,"aiq_promedio":0,"seccion_a":0,"seccion_b":0,"seccion_c":0,"nivel_predominante":"","regla1_activos":0},"MGR":{"n":0,"aiq_promedio":0,"seccion_a":0,"seccion_b":0,"seccion_c":0,"nivel_predominante":"","regla1_activos":0},"SPV":{"n":0,"aiq_promedio":0,"seccion_a":0,"seccion_b":0,"seccion_c":0,"nivel_predominante":"","regla1_activos":0},"COL":{"n":0,"aiq_promedio":0,"seccion_a":0,"seccion_b":0,"seccion_c":0,"nivel_predominante":"","regla1_activos":0}},
  "arquetipo": "",
  "patron_jerarquico": {"lideres_adelante": false, "colaboradores_adelante": false, "homogeneo_bajo": false},
  "brechas": {"gobernanza":{"activa":false,"severidad":"","n_afectados":0,"pct_afectados":0,"politicas_existen":false},"comunicacion":{"activa":false,"severidad":"","n_sin_espacios":0},"habilitacion":{"activa":false,"n_afectados":0},"liderazgo":{"activa":false},"adopcion":{"activa":false}},
  "fortalezas": {"liderazgo_adelante":false,"capacidad_avanzada_existe":false,"n_perfiles_avanzados":0,"motivacion_espontanea":false,"max_laboratorio":0},
  "flags_criticos": {"riesgo_gobernanza_critico":false,"n_perfiles_con_pausa":0}
}`;
}

function buildPrompt2(jsonEnterprise) {
  return `Eres el analista de AI Pulse. Recibes el JSON Enterprise consolidado y produces el análisis narrativo.
Directo, ejecutivo, basado en datos, sin mencionar personas. Máximo 3 oraciones por campo.

JSON ENTERPRISE:
${JSON.stringify(jsonEnterprise, null, 2)}

OUTPUT JSON EXACTO:
{
  "resumen_ejecutivo": "",
  "descripcion_arquetipo": "",
  "por_seccion": {"seccion_a": "", "seccion_b": "", "seccion_c": ""},
  "brechas_activas": [{"id":"","titulo_brecha":"","severidad_texto":"","descripcion":"","lo_que_no_existe":"","dato_clave":""}],
  "brechas_inactivas": [{"id":"","titulo_brecha":"","por_que_no_aplica":""}],
  "fortalezas": [{"id":"","titulo":"","descripcion":""}],
  "patron_jerarquico": {"descripcion": ""}
}`;
}

function buildPrompt3(jsonEnterprise, jsonAnalisis) {
  const aiqActual = jsonEnterprise.metricas_globales?.aiq_promedio || 0;
  let objetivo = aiqActual;
  if (aiqActual < 2.0) objetivo = aiqActual + 0.30;
  else if (aiqActual < 3.0) objetivo = aiqActual + 0.35;
  else if (aiqActual <= 3.5) objetivo = aiqActual + 0.25;
  else objetivo = aiqActual + 0.20;
  objetivo = Math.round(objetivo * 100) / 100;

  return `Eres el estratega de adopción de IA de AI Pulse. Genera un plan 30/60/90 días.
Máximo 3 acciones por horizonte. Concreto y ejecutable. aiq_actual=${aiqActual.toFixed(2)}, objetivo=${objetivo.toFixed(2)}.

JSON ENTERPRISE: ${JSON.stringify(jsonEnterprise, null, 2)}
ANÁLISIS: ${JSON.stringify(jsonAnalisis, null, 2)}

OUTPUT JSON EXACTO:
{
  "plan": [
    {"horizonte_dias": "30", "prioridad": 1, "titulo": "", "acciones": ["","",""], "kpi": ""},
    {"horizonte_dias": "60", "prioridad": 2, "titulo": "", "acciones": ["","",""], "kpi": ""},
    {"horizonte_dias": "90", "prioridad": 3, "titulo": "", "acciones": ["","",""], "kpi": ""}
  ],
  "aiq_actual": ${aiqActual.toFixed(2)},
  "aiq_objetivo_90_dias": ${objetivo.toFixed(2)},
  "delta_esperado_pct": "${Math.round(((objetivo - aiqActual) / aiqActual) * 100)}%"
}`;
}

async function callOpenAI(url, key, systemMsg, userMsg) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({
      messages: [{ role: 'system', content: systemMsg }, { role: 'user', content: userMsg }],
      max_completion_tokens: 20000
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  if (!raw) {
    const reason = data?.choices?.[0]?.finish_reason;
    throw new Error(`OpenAI respuesta vacía. finish_reason=${reason} reasoning_tokens=${data?.usage?.completion_tokens_details?.reasoning_tokens}`);
  }
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function generateHTML(empresa, enterprise, analisis, plan, participantes) {
  const m    = enterprise.metricas_globales || {};
  const dist = enterprise.distribucion_niveles || {};
  const jer  = enterprise.por_jerarquia || {};
  const fecha = enterprise.metadata?.fecha_reporte || new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  const distRows = [
    { label: 'Novato', codigo: 'L1', n: dist.n_l1||0, pct: dist.pct_l1||0 },
    { label: 'Experimentador', codigo: 'L2', n: dist.n_l2||0, pct: dist.pct_l2||0 },
    { label: 'Practicante', codigo: 'L3', n: dist.n_l3||0, pct: dist.pct_l3||0 },
    { label: 'Amplificador Técnico', codigo: 'L4T', n: dist.n_l4t||0, pct: dist.pct_l4t||0 },
    { label: 'Amplificador Estratégico', codigo: 'L4L', n: dist.n_l4l||0, pct: dist.pct_l4l||0 },
  ];
  const nivelOrg = m.nivel_organizacional || 'L2';
  const nivelCol = ['L4L','L4T'].includes(nivelOrg) ? '#00AA55' : nivelOrg === 'L3' ? '#CC8800' : '#E63946';

  const distHTML = distRows.map(r => {
    const isOrg = r.codigo === nivelOrg;
    return `<div class="dist-row${isOrg?' dist-row--active':''}">
      <div class="dist-meta"><span class="dist-label">${r.label}</span><span class="dist-code">${r.codigo}</span></div>
      <div class="dist-bar-wrap"><div class="dist-bar" style="width:${r.pct}%"></div></div>
      <div class="dist-nums"><span class="dist-n">${r.n}</span><span class="dist-pct">${r.pct}%</span></div>
    </div>`;
  }).join('');

  const jerarquias = ['EJE','DIR','MGR','SPV','COL'];
  const jerLabels = { EJE:'Ejecutivos', DIR:'Directores', MGR:'Managers', SPV:'Supervisores', COL:'Colaboradores' };
  const heatHTML = jerarquias.filter(j => jer[j]?.n > 0).map(j => {
    const d = jer[j];
    const pct = (safeNum(d.aiq_promedio)/5)*100;
    const col = safeNum(d.aiq_promedio) >= 3.5 ? '#00AA55' : safeNum(d.aiq_promedio) >= 2.5 ? '#CC8800' : '#E63946';
    return `<div class="heat-row">
      <span class="heat-label">${jerLabels[j]}</span>
      <div class="heat-bar-wrap"><div class="heat-bar" style="width:${pct}%;background:${col}"></div></div>
      <span class="heat-score" style="color:${col}">${safeNum(d.aiq_promedio).toFixed(2)}</span>
      <span class="heat-nivel">${d.nivel_predominante||''}</span>
      <span class="heat-n">${d.n} pers.</span>
    </div>`;
  }).join('');

  const brechasActivasHTML = (analisis.brechas_activas||[]).map(b => `
    <div class="brecha-card brecha-card--active">
      <div class="brecha-header">
        <span class="brecha-sev brecha-sev--${(b.severidad_texto||'').toLowerCase().replace('í','i')}">${b.severidad_texto}</span>
        <span class="brecha-titulo">${b.titulo_brecha}</span>
      </div>
      <p class="brecha-desc">${b.descripcion}</p>
      <div class="brecha-vacio">${b.lo_que_no_existe}</div>
      <div class="brecha-dato">Dato clave: <strong>${b.dato_clave}</strong></div>
    </div>`).join('');

  const brechasInactivasHTML = (analisis.brechas_inactivas||[]).map(b => `
    <div class="brecha-card brecha-card--inactive">
      <div class="brecha-header">
        <span class="brecha-sev brecha-sev--ok">No detectada</span>
        <span class="brecha-titulo">${b.titulo_brecha}</span>
      </div>
      <p class="brecha-desc">${b.por_que_no_aplica}</p>
    </div>`).join('');

  const fortalezasHTML = (analisis.fortalezas||[]).map(f => `
    <div class="fort-card">
      <div class="fort-titulo">${f.titulo}</div>
      <p class="fort-desc">${f.descripcion}</p>
    </div>`).join('');

  const planHTML = (plan.plan||[]).map(h => `
    <div class="plan-card">
      <div class="plan-header">
        <span class="plan-dias">${h.horizonte_dias} días</span>
        <span class="plan-titulo">${h.titulo}</span>
      </div>
      <ul class="plan-acciones">${(h.acciones||[]).filter(Boolean).map(a=>`<li>${a}</li>`).join('')}</ul>
      <div class="plan-kpi">KPI: ${h.kpi}</div>
    </div>`).join('');

  const tablaHTML = participantes.map(p => {
    const col = ['L4L','L4T'].includes(p.aiqLevel)?'#00AA55':p.aiqLevel==='L3'?'#CC8800':'#AAAAAA';
    return `<tr>
      <td class="td-n">${p.nombre}</td><td class="td-c">${p.posicion||'—'}</td>
      <td class="td-d">${p.departamento||'—'}</td>
      <td style="color:${col};font-weight:600">${safeNum(p.aiqScore).toFixed(2)}</td>
      <td style="color:${col}">${p.aiqLevel}</td>
      <td>${safeNum(p.sectionA).toFixed(1)}</td><td>${safeNum(p.sectionB).toFixed(1)}</td><td>${safeNum(p.sectionC).toFixed(1)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Informe Enterprise AIQ — ${empresa}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
:root{--p:#E63946;--g1:#111;--g3:#555;--g4:#AAA;--g5:#F7F7F7;--bd:#E0E0E0;--green:#00AA55;--amber:#CC8800;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;color:var(--g1);background:#fff;font-size:14px;line-height:1.6;}
.page{max-width:960px;margin:0 auto;padding:56px 48px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--g1);padding-bottom:28px;margin-bottom:56px;}
.hdr-left .logo{font-family:'DM Serif Display',serif;font-size:36px;color:var(--p);}
.hdr-left .tagline{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--g4);margin-top:4px;}
.hdr-right{text-align:right;}
.hdr-empresa{font-family:'DM Serif Display',serif;font-size:22px;}
.hdr-meta{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--g4);margin-top:4px;}
.hdr-conf{color:var(--p);}
.section{margin-bottom:64px;}
.sec-num{font-family:'DM Mono',monospace;font-size:9px;color:var(--p);letter-spacing:.3em;text-transform:uppercase;margin-bottom:6px;}
.sec-title{font-family:'DM Serif Display',serif;font-size:26px;margin-bottom:20px;}
.resumen{background:var(--g5);border-left:4px solid var(--p);padding:24px 28px;font-size:14px;line-height:1.8;}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px;}
.kpi{border:1px solid var(--bd);padding:20px 16px;text-align:center;}
.kpi-val{font-family:'DM Serif Display',serif;font-size:36px;line-height:1;}
.kpi-sub{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--g4);margin-top:6px;}
.arquetipo-card{background:var(--g1);color:#fff;padding:28px 32px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center;gap:24px;}
.arq-label{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.2em;color:var(--g4);margin-bottom:6px;}
.arq-nombre{font-family:'DM Serif Display',serif;font-size:24px;color:#fff;}
.arq-desc{font-size:13px;color:#CCC;line-height:1.6;max-width:480px;}
.dim-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;}
.dim{border:1px solid var(--bd);padding:20px;}
.dim-name{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--g4);margin-bottom:8px;}
.dim-score{font-family:'DM Serif Display',serif;font-size:32px;}
.dim-bar{height:3px;background:var(--bd);margin:10px 0;}
.dim-bar-fill{height:100%;background:var(--p);}
.dim-interp{font-size:12px;color:var(--g3);line-height:1.55;}
.dist-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:8px 0;}
.dist-row--active{border-left:3px solid var(--p);padding-left:12px;}
.dist-meta{display:flex;align-items:center;gap:8px;width:220px;flex-shrink:0;}
.dist-label{font-size:13px;}
.dist-code{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);}
.dist-row--active .dist-label{font-weight:600;color:var(--p);}
.dist-bar-wrap{flex:1;height:8px;background:var(--bd);border-radius:4px;overflow:hidden;}
.dist-bar{height:100%;background:var(--p);border-radius:4px;}
.dist-nums{display:flex;gap:8px;min-width:70px;justify-content:flex-end;}
.dist-n{font-family:'DM Mono',monospace;font-size:12px;font-weight:600;}
.dist-pct{font-family:'DM Mono',monospace;font-size:11px;color:var(--g4);}
.heat-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.heat-label{font-size:12px;width:130px;flex-shrink:0;}
.heat-bar-wrap{flex:1;height:10px;background:var(--bd);border-radius:5px;overflow:hidden;}
.heat-bar{height:100%;border-radius:5px;}
.heat-score{font-family:'DM Mono',monospace;font-size:13px;font-weight:600;min-width:36px;text-align:right;}
.heat-nivel{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);min-width:32px;}
.heat-n{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);min-width:50px;text-align:right;}
.brechas-grid{display:grid;gap:12px;}
.brecha-card{border:1px solid var(--bd);padding:20px;}
.brecha-card--active{border-left:3px solid var(--p);}
.brecha-card--inactive{opacity:.65;}
.brecha-header{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.brecha-sev{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;border-radius:2px;}
.brecha-sev--critica{background:var(--p);color:#fff;}
.brecha-sev--importante{background:#CC8800;color:#fff;}
.brecha-sev--total{background:var(--g1);color:#fff;}
.brecha-sev--detectada{background:var(--g5);color:var(--g3);border:1px solid var(--bd);}
.brecha-sev--ok{background:#E6F9EE;color:var(--green);border:1px solid #B3E6C9;}
.brecha-titulo{font-weight:600;font-size:13px;}
.brecha-desc{font-size:13px;color:var(--g3);margin-bottom:8px;}
.brecha-vacio{font-size:12px;color:var(--g3);border-left:2px solid var(--bd);padding-left:10px;margin-bottom:8px;line-height:1.6;}
.brecha-dato{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);}
.fort-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}
.fort-card{border:1px solid var(--green);padding:20px;}
.fort-titulo{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--green);margin-bottom:6px;}
.fort-desc{font-size:13px;color:var(--g3);line-height:1.6;}
.patron-strip{background:var(--g5);padding:20px 24px;border-left:3px solid var(--g1);margin-bottom:24px;font-size:13px;color:var(--g3);line-height:1.7;}
.plan-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;}
.plan-card{border:1px solid var(--bd);padding:20px;}
.plan-header{margin-bottom:12px;}
.plan-dias{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--p);display:block;margin-bottom:4px;}
.plan-titulo{font-weight:600;font-size:13px;}
.plan-acciones{list-style:none;padding:0;margin-bottom:12px;}
.plan-acciones li{font-size:12px;color:var(--g3);padding:4px 0;border-bottom:1px solid var(--bd);line-height:1.5;}
.plan-acciones li:last-child{border-bottom:none;}
.plan-kpi{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);border-top:1px solid var(--bd);padding-top:8px;}
.objetivo-card{display:flex;gap:24px;align-items:center;background:var(--g1);color:#fff;padding:24px 28px;}
.obj-bloque{text-align:center;}
.obj-val{font-family:'DM Serif Display',serif;font-size:40px;color:#fff;}
.obj-label{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--g4);margin-top:4px;}
.obj-arrow{font-size:28px;color:var(--green);}
.obj-delta{font-family:'DM Mono',monospace;font-size:12px;color:var(--green);margin-top:6px;}
.tabla-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--g4);padding:8px 10px;border-bottom:2px solid var(--g1);text-align:left;}
td{padding:10px;border-bottom:1px solid var(--bd);}
tr:hover td{background:var(--g5);}
.td-n{font-weight:500;}.td-c,.td-d{color:var(--g3);}
.footer{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid var(--bd);padding-top:24px;margin-top:56px;}
.footer-brand{font-family:'DM Serif Display',serif;font-size:20px;color:var(--p);}
.footer-meta{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);text-align:right;line-height:1.8;}
@media print{.page{padding:24px;}body{font-size:12px;}}
</style></head><body><div class="page">

<div class="hdr">
  <div class="hdr-left"><div class="logo">AIQ</div><div class="tagline">AI Pulse · Diagnóstico Enterprise v2.0</div></div>
  <div class="hdr-right">
    <div class="hdr-empresa">${empresa}</div>
    <div class="hdr-meta">${fecha}</div>
    <div class="hdr-meta hdr-conf">Confidencial · Solo para uso interno</div>
  </div>
</div>

<div class="section">
  <div class="sec-num">01</div><div class="sec-title">Resumen ejecutivo</div>
  <div class="resumen">${analisis.resumen_ejecutivo||''}</div>
</div>

<div class="section">
  <div class="sec-num">02</div><div class="sec-title">Resultado organizacional</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-val" style="color:${nivelCol}">${(m.aiq_promedio||0).toFixed(2)}</div><div class="kpi-sub">AIQ Promedio</div></div>
    <div class="kpi"><div class="kpi-val" style="color:${nivelCol}">${m.nivel_organizacional||'—'}</div><div class="kpi-sub">${m.nombre_nivel_organizacional||''}</div></div>
    <div class="kpi"><div class="kpi-val">${m.n_total||participantes.length}</div><div class="kpi-sub">Evaluados</div></div>
    <div class="kpi"><div class="kpi-val">${(dist.n_l4t||0)+(dist.n_l4l||0)}</div><div class="kpi-sub">Nivel L4 (amplificadores)</div></div>
  </div>
  <div class="arquetipo-card">
    <div><div class="arq-label">Arquetipo organizacional</div><div class="arq-nombre">${enterprise.arquetipo||''}</div></div>
    <div class="arq-desc">${analisis.descripcion_arquetipo||''}</div>
  </div>
</div>

<div class="section">
  <div class="sec-num">03</div><div class="sec-title">Desempeño por dimensión</div>
  <div class="dim-grid">
    <div class="dim"><div class="dim-name">Bloque A · Experiencia Real · 30%</div><div class="dim-score">${(m.seccion_a_promedio||0).toFixed(2)}</div><div class="dim-bar"><div class="dim-bar-fill" style="width:${((m.seccion_a_promedio||0)/5)*100}%"></div></div><div class="dim-interp">${analisis.por_seccion?.seccion_a||''}</div></div>
    <div class="dim"><div class="dim-name">Bloque B · Criterio Técnico · 30%</div><div class="dim-score">${(m.seccion_b_promedio||0).toFixed(2)}</div><div class="dim-bar"><div class="dim-bar-fill" style="width:${((m.seccion_b_promedio||0)/5)*100}%"></div></div><div class="dim-interp">${analisis.por_seccion?.seccion_b||''}</div></div>
    <div class="dim"><div class="dim-name">Bloque C · Laboratorio · 40%</div><div class="dim-score">${(m.seccion_c_promedio||0).toFixed(2)}</div><div class="dim-bar"><div class="dim-bar-fill" style="width:${((m.seccion_c_promedio||0)/5)*100}%"></div></div><div class="dim-interp">${analisis.por_seccion?.seccion_c||''}</div></div>
  </div>
</div>

<div class="section">
  <div class="sec-num">04</div><div class="sec-title">Distribución de niveles</div>
  ${distHTML}
</div>

${heatHTML ? `<div class="section"><div class="sec-num">05</div><div class="sec-title">Mapa de madurez por jerarquía</div><div class="patron-strip">${analisis.patron_jerarquico?.descripcion||''}</div>${heatHTML}</div>` : ''}

<div class="section">
  <div class="sec-num">06</div><div class="sec-title">Brechas organizacionales</div>
  <div class="brechas-grid">${brechasActivasHTML}${brechasInactivasHTML}</div>
</div>

${(analisis.fortalezas||[]).length>0?`<div class="section"><div class="sec-num">07</div><div class="sec-title">Fortalezas detectadas</div><div class="fort-grid">${fortalezasHTML}</div></div>`:''}

<div class="section">
  <div class="sec-num">08</div><div class="sec-title">Plan de acción recomendado</div>
  <div class="plan-grid">${planHTML}</div>
  <div class="objetivo-card">
    <div class="obj-bloque"><div class="obj-val">${(plan.aiq_actual||0).toFixed(2)}</div><div class="obj-label">AIQ actual</div></div>
    <div class="obj-arrow">→</div>
    <div class="obj-bloque"><div class="obj-val" style="color:var(--green)">${(plan.aiq_objetivo_90_dias||0).toFixed(2)}</div><div class="obj-label">Objetivo 90 días</div><div class="obj-delta">+${plan.delta_esperado_pct||''}</div></div>
    <div style="flex:1;padding-left:24px;"><div class="obj-label" style="margin-bottom:6px;">Re-evaluación sugerida</div><div style="font-size:13px;color:#CCC;line-height:1.6;">El objetivo de ${(plan.aiq_objetivo_90_dias||0).toFixed(2)} es alcanzable en 90 días ejecutando las acciones prioritarias del plan.</div></div>
  </div>
</div>

<div class="section">
  <div class="sec-num">09</div><div class="sec-title">Detalle individual</div>
  <div class="tabla-wrap"><table>
    <thead><tr><th>Nombre</th><th>Cargo</th><th>Dpto.</th><th>AIQ</th><th>Nivel</th><th>A</th><th>B</th><th>C</th></tr></thead>
    <tbody>${tablaHTML}</tbody>
  </table></div>
</div>

<div class="footer">
  <div class="footer-brand">AI Pulse</div>
  <div class="footer-meta">Preparado por Javier Cruz · javiercruz.ai<br>AIQ Framework v2.0 · ${empresa} · ${fecha}<br>Confidencial · Solo para uso interno</div>
</div>

</div></body></html>`;
}

// ── Handler principal ─────────────────────────────────────────────
module.exports = async function (context, queueMessage) {
  let msg;
  try {
    msg = typeof queueMessage === 'string' ? JSON.parse(queueMessage) : queueMessage;
  } catch {
    context.log.error('Mensaje inválido:', queueMessage);
    return;
  }

  const { empresa } = msg;
  if (!empresa) { context.log.error('Mensaje sin empresa — drop'); return; }

  context.log.info(`[company-report-processor] Iniciando para ${empresa}`);

  const conn       = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey     = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-04-01-preview";
  const openaiUrl  = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const systemMsg  = 'Eres el analizador Enterprise de AI Pulse. Respondes SOLO con JSON válido, sin markdown ni texto extra.';

  // 1. Cargar participantes
  const resultsClient = TableClient.fromConnectionString(conn, "assessmentResults");
  const participantes = [];
  for await (const entity of resultsClient.listEntities({
    queryOptions: { filter: `PartitionKey eq '${empresa}'` }
  })) {
    const answers = assembleAnswers(entity);
    const v2val  = answers?.V2?.value;
    const v2text = V2_OPT[v2val] || '';
    participantes.push({
      nombre: entity.nombre||'', posicion: entity.posicion||'',
      departamento: entity.departamento||'', aiqScore: safeNum(entity.aiqScore),
      aiqLevel: entity.aiqLevel||'L2', sectionA: safeNum(entity.sectionA),
      sectionB: safeNum(entity.sectionB), sectionC: safeNum(entity.sectionC),
      challengeProfile: entity.challengeProfile||'',
      alerts: JSON.parse(entity.alerts||'[]'),
      nivelCodigo: NIVEL_CODIGO[v2text]||NIVEL_CODIGO[entity.posicion]||'COL',
      b2_raw: answers?.B2||'', answers,
    });
  }

  if (participantes.length === 0) {
    context.log.error(`No hay resultados para ${empresa}`);
    return;
  }

  context.log.info(`[company-report-processor] ${participantes.length} participantes — ejecutando 3 prompts`);

  // 2. Prompt 1 — Consolidación
  const jsonEnterprise = await callOpenAI(openaiUrl, apiKey, systemMsg, buildPrompt1(empresa, participantes));
  context.log.info('[company-report-processor] Prompt 1 completado');

  // 3. Prompt 2 — Análisis narrativo
  const jsonAnalisis = await callOpenAI(openaiUrl, apiKey, systemMsg, buildPrompt2(jsonEnterprise));
  context.log.info('[company-report-processor] Prompt 2 completado');

  // 4. Prompt 3 — Plan
  const jsonPlan = await callOpenAI(openaiUrl, apiKey, systemMsg, buildPrompt3(jsonEnterprise, jsonAnalisis));
  context.log.info('[company-report-processor] Prompt 3 completado');

  // 5. Generar HTML
  const html = generateHTML(empresa, jsonEnterprise, jsonAnalisis, jsonPlan, participantes);

  // 6. Guardar en Blob Storage
  const blobName = blobNameForEmpresa(empresa);
  const containerClient = BlobServiceClient.fromConnectionString(conn).getContainerClient("aiq-reports");
  await containerClient.createIfNotExists();
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const buf = Buffer.from(html, "utf-8");
  await blobClient.upload(buf, buf.length, {
    blobHTTPHeaders: { blobContentType: "text/html; charset=utf-8" },
    overwrite: true
  });

  context.log.info(`[company-report-processor] Blob guardado: ${blobName}`);
};
