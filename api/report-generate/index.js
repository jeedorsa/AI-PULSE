const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../shared/adminAuth");

// ── Mapas de opciones cerradas ────────────────────────────────────
const V2_OPT = { 1: 'Colaborador individual', 2: 'Manager o Líder de equipo', 3: 'Director', 4: 'VP o C-Suite' };
const V3_OPT = { 1: 'Menos de 1 año', 2: '1 a 3 años', 3: '3 a 5 años', 4: 'Más de 5 años' };
const E3_OPT = { 1: 'No lo noto', 2: 'Repito la pregunta igual', 3: 'Ajusto el prompt manualmente', 4: 'Aplico un proceso sistemático de corrección', 5: 'Comparto la lección con mi equipo' };
const E4_OPT = { 1: 'No la uso', 2: 'Busco definiciones rápidas', 3: 'Pido analogías y explicaciones adaptadas a mi contexto', 4: 'Diseño un plan de estudio y genero casos prácticos con la IA' };
const B1_OPT = { 1: 'Confío si suena bien', 2: 'Búsqueda rápida en Google', 3: 'Método sistemático de verificación cruzada' };
const D1_OPT = { 1: 'Nunca ha habido incentivo', 2: 'Menciones generales sin acciones', 3: 'He recibido recursos o tiempo específico', 4: 'Existe una estrategia clara con liderazgo' };
const D9_OPT = { 1: 'Me genera incertidumbre', 2: 'Tengo curiosidad pero no sé cómo afectará', 3: 'Lo veo como oportunidad de crecimiento', 4: 'La IA ya es central en mi desarrollo profesional' };
const E5_OPT = { 1: 'No', 2: 'Comparto prompts puntuales', 3: 'Enseño técnicas y resuelvo dudas', 4: 'Lidero la adopción y creo recursos compartidos' };

const NIVEL_NOMBRES = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4T: 'Amplificador Técnico', L4L: 'Amplificador Estratégico' };
const NIVEL_SIGUIENTE = { L1: 'L2', L2: 'L3', L3: 'L4T', L4T: 'L4L', L4L: 'L4L' };

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
  const nivelSiguienteKey = NIVEL_SIGUIENTE[nivel] || 'L4L';
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
  "dim_a_interpretacion": "2-3 oraciones analizando la Dimensión A basadas EN LAS RESPUESTAS REALES. Menciona detalles específicos de lo que dijo. Tono: observacional, directo, sin elogios vacíos.",
  "dim_a_gap": "1 oración concreta sobre qué falta en esta dimensión para subir de nivel.",
  "dim_b_interpretacion": "2-3 oraciones analizando la Dimensión B. Si B1 indica que confía sin verificar, señálalo. Si B2 es vago, señálalo. Sé directo.",
  "dim_b_gap": "1 oración concreta sobre qué falta en esta dimensión.",
  "dim_c_interpretacion": "2-3 oraciones analizando los prompts C1, C2, C3. Menciona elementos específicos de sus prompts — qué incluyó y qué no.",
  "dim_c_gap": "1 oración concreta sobre qué falta en los prompts para el siguiente nivel.",
  "brecha_detectada": true o false (true si alguna dimensión está más de 0.8 puntos por debajo del promedio de las otras dos),
  "brecha_texto": "Si brecha_detectada es true: 1-2 oraciones explicando cuál es la brecha y por qué importa. Si es false: string vacío.",
  "fortalezas": [
    {
      "titulo": "Título concreto de la fortaleza (no genérico)",
      "descripcion": "2-3 oraciones basadas en respuestas ESPECÍFICAS del participante. Cita lo que dijo, no lo que debería haber dicho."
    }
  ],
  "oportunidades": [
    {
      "titulo": "Título concreto de la oportunidad de desarrollo",
      "descripcion": "2-3 oraciones. Explica QUÉ falta y POR QUÉ importa en su contexto específico (${participant.posicion} en ${participant.empresa})."
    }
  ],
  "proximo_nivel_descripcion": "2 oraciones sobre qué significa ser ${nivelSiguienteNombre} en el contexto real de su trabajo. Qué cambia, qué hace diferente.",
  "gaps": [
    {
      "titulo": "Nombre concreto del gap",
      "accion": "Instrucción accionable específica. No genérica — tiene que poder hacer esto mañana. Menciona su posición o industria si aplica."
    }
  ],
  "frase_cierre": "1 frase final motivacional pero honesta. Que hable de SU situación específica, no de algo genérico."
}

REGLAS CRÍTICAS:
- Mínimo 2 fortalezas, máximo 3. Mínimo 2 oportunidades, máximo 3.
- Exactamente 3 gaps accionables en la sección "próximo nivel".
- NUNCA uses frases como "¡Excelente trabajo!" o elogios vacíos.
- Cada observación debe poder rastrearse directamente a una respuesta específica del participante.
- Si una respuesta es vaga o corta, señálalo — eso también es información.
- El tono es el de un consultor senior que habla claro, no el de un coach motivacional.
- Adapta el lenguaje al nivel jerárquico: habla diferente a un C-Suite que a un colaborador.`;
}

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }
  if (!requireAdmin(context, req)) return;

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const { email } = body;
  if (!email) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta el email" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const openaiKey = process.env.AZURE_OPENAI_API_KEY;
  const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const openaiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  try {
    // 1. Obtener resultado del participante — filtrar por email directamente
    const resultsClient = TableClient.fromConnectionString(connectionString, "assessmentResults");
    let result = null;

    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `email eq '${email}'` }
    })) { result = entity; break; }

    if (!result) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: `No se encontró resultado para ${email}` }) };
      return;
    }

    context.log.info(`Resultado encontrado: ${result.nombre} / ${result.partitionKey} / ${result.aiqLevel}`);

    // Rearmar answers desde bloques o formato legado
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

    // 2. Calcular distribución por empresa para contexto
    const companyDist = { L1: 0, L2: 0, L3: 0, L4T: 0, L4L: 0, total: 0 };
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${participant.empresa}'` }
    })) {
      const lvl = entity.aiqLevel;
      if (companyDist[lvl] !== undefined) companyDist[lvl]++;
      companyDist.total++;
    }

    // 3. Llamar a Azure OpenAI
    context.log.info(`Llamando OpenAI: endpoint=${openaiEndpoint} deployment=${openaiDeployment} version=${openaiVersion}`);
    context.log.info(`Config keys presentes: key=${!!openaiKey} conn=${!!connectionString}`);
    const prompt = buildPrompt(participant, answers, scores, companyDist);
    const url = `${openaiEndpoint.replace(/\/$/, '')}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiVersion}`;

    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': openaiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Eres el analista principal de AI Pulse. Generas análisis precisos, concretos y personalizados. Respondes SOLO con JSON válido, sin markdown.' },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 2000
      })
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      context.log.error('Azure OpenAI error:', aiResponse.status, errBody);
      throw new Error(`Azure OpenAI respondió ${aiResponse.status}: ${errBody.slice(0, 200)}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData?.choices?.[0]?.message?.content || '';
    context.log.info('AI raw response length:', rawText.length);

    if (!rawText) throw new Error('Azure OpenAI devolvió una respuesta vacía');

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    // 4. Generar HTML del informe
    const html = generateHTML(participant, scores, answers, analysis, companyDist);

    // 5. Persistir coachEnabled + reportAnalysis para habilitar el coach
    try {
      await resultsClient.updateEntity({
        partitionKey: result.partitionKey,
        rowKey:       result.rowKey,
        coachEnabled:    true,
        reportAnalysis:  JSON.stringify(analysis),
        reportGeneratedAt: new Date().toISOString(),
      }, "Merge");
    } catch (persistErr) {
      context.log.error("Error persistiendo coachEnabled:", persistErr.message);
      // No bloqueamos — el informe igual se devuelve
    }

    context.res = {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, html, analysis })
    };

  } catch (err) {
    context.log.error("report-generate error:", err);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function generateHTML(participant, scores, answers, analysis, companyDist) {
  const nivel = scores.aiqLevel;
  const nivelNombre = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4T: 'Amplificador Técnico', L4L: 'Amplificador Estratégico' }[nivel] || nivel;
  const nivelSigKey = { L1: 'L2', L2: 'L3', L3: 'L4T', L4T: 'L4L', L4L: 'L4L' }[nivel];
  const nivelSigNombre = { L1: 'Experimentador', L2: 'Practicante', L3: 'Amplificador Técnico', L4T: 'Amplificador Estratégico', L4L: 'Amplificador Estratégico' }[nivel];
  const iniciales = participant.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const herramientas = (answers.V4?.selected || []).join(', ') || '—';

  const niveles = ['L1', 'L2', 'L3', 'L4T', 'L4L'];
  const nivelesNombres = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4T: 'Amp. Técnico', L4L: 'Amp. Estratégico' };
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
@media print{.sec,.dim,.insight,.gap-item,.intro-grid,.intro-card,.result-main,.level-bar,.dims,.brecha-alert,.next-from-to,.context-grid,.ctx-card,.ctx-next-item,.close-quote,.ftr,.sec-label{page-break-inside:avoid}.sec-label{page-break-after:avoid}}
.doc{max-width:860px;margin:0 auto;padding:0 0 80px;}
.hdr{padding:48px 60px 40px;border-bottom:1px solid var(--border);position:relative;overflow:hidden;}
.hdr-bg{position:absolute;top:-120px;right:-100px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(254,60,28,0.04) 0%,transparent 65%);pointer-events:none;}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;}
.brand-mark{display:flex;align-items:center;gap:12px;}
.brand-icon{width:36px;height:36px;border:1px solid var(--p40);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--p10);}
.brand-icon span{font-family:'Big Shoulders Display',sans-serif;font-size:13px;font-weight:700;color:var(--p);letter-spacing:.05em;}
.brand-name{font-family:'Big Shoulders Display',sans-serif;font-size:18px;font-weight:700;color:var(--wh);letter-spacing:.08em;text-transform:uppercase;}
.brand-sub{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.25em;text-transform:uppercase;margin-top:2px;}
.hdr-meta{text-align:right;}
.meta-date{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);letter-spacing:.2em;text-transform:uppercase;}
.meta-conf{font-family:'DM Mono',monospace;font-size:10px;color:var(--p);letter-spacing:.15em;text-transform:uppercase;margin-top:4px;display:flex;align-items:center;gap:6px;justify-content:flex-end;}
.meta-conf::before{content:'';width:16px;height:1px;background:var(--p);}
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
.lbar-item{flex:1;padding:12px 10px 10px;background:var(--d1);position:relative;}
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
.next-desc strong{color:var(--wh);font-weight:600;}
.gaps{display:flex;flex-direction:column;gap:3px;}
.gap-item{display:grid;grid-template-columns:36px 1fr;gap:16px;padding:20px;background:var(--d1);align-items:start;}
.gap-n{font-family:'Big Shoulders Display',sans-serif;font-size:28px;font-weight:900;color:var(--p);line-height:1;}
.gap-title{font-size:13.5px;font-weight:600;color:var(--wh);margin-bottom:8px;}
.gap-action{font-size:13px;color:var(--g2);line-height:1.65;font-weight:300;}
.gap-action strong{color:var(--wh);font-weight:600;}
.context-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:32px;}
.ctx-card{padding:24px;background:var(--d1);}
.ctx-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);margin-bottom:16px;}
.dist-row{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.dist-lbl{font-size:11px;color:var(--g3);width:130px;flex-shrink:0;}
.dist-track{flex:1;height:3px;background:var(--d3);border-radius:2px;overflow:hidden;}
.dist-fill{height:100%;border-radius:2px;transition:width .4s;}
.dist-fill-neutral{background:var(--g4);}
.dist-fill-you{background:var(--p);}
.you-row .dist-lbl{color:var(--wh);font-weight:600;}
.dist-pct{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);width:30px;text-align:right;}
.dist-footnote{font-family:'DM Mono',monospace;font-size:9px;color:var(--p);letter-spacing:.1em;margin-top:12px;}
.ctx-next-card{display:flex;flex-direction:column;gap:14px;}
.ctx-next-item{display:flex;gap:12px;align-items:flex-start;}
.ctx-next-ico{font-size:16px;flex-shrink:0;margin-top:2px;}
.ctx-next-text{font-size:12.5px;color:var(--g2);line-height:1.6;}
.ctx-next-text strong{display:block;color:var(--wh);font-weight:600;margin-bottom:2px;}
.close-quote{padding:28px 36px;background:var(--d1);border-left:3px solid var(--p);margin-top:0;}
.close-quote-text{font-size:15px;color:var(--g2);line-height:1.75;font-weight:300;font-style:italic;}
.close-quote-text strong{color:var(--wh);font-weight:600;font-style:normal;}
.ftr{padding:32px 60px;border-top:1px solid var(--border);}
.ftr-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;}
.ftr-aipulse{display:flex;align-items:center;gap:12px;}
.ftr-aipulse-icon{width:32px;height:32px;border:1px solid var(--p40);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--p10);}
.ftr-aipulse-icon span{font-family:'Big Shoulders Display',sans-serif;font-size:12px;font-weight:700;color:var(--p);}
.ftr-aipulse-name{font-family:'Big Shoulders Display',sans-serif;font-size:16px;font-weight:700;color:var(--wh);letter-spacing:.06em;text-transform:uppercase;}
.ftr-aipulse-name em{color:var(--p);font-style:normal;}
.ftr-aipulse-sub{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.15em;text-transform:uppercase;margin-top:2px;}
.ftr-meta{text-align:right;}
.ftr-stat{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.1em;margin-bottom:3px;}
.ftr-jc{display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid var(--border);}
.jc-mark{display:flex;align-items:center;gap:12px;}
.jc-monogram{width:36px;height:36px;border:1px solid var(--p40);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--p10);}
.jc-monogram span{font-family:'Big Shoulders Display',sans-serif;font-size:18px;font-weight:900;color:var(--p);letter-spacing:-1px;line-height:1;}
.jc-name{font-family:'Big Shoulders Display',sans-serif;font-size:18px;font-weight:700;color:var(--wh);letter-spacing:.04em;text-transform:uppercase;}
.jc-slogan{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:300;color:var(--g3);margin-top:2px;font-style:italic;}
.jc-slogan em{color:var(--p);font-style:normal;font-weight:500;}
.jc-web{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);letter-spacing:.15em;text-transform:uppercase;}
</style>
</head>
<body>
<div class="doc">

<header class="hdr">
  <div class="hdr-bg"></div>
  <div class="hdr-top">
    <div class="brand-mark">
      <div class="brand-icon"><span>AIQ</span></div>
      <div>
        <div class="brand-name">AI Pulse</div>
        <div class="brand-sub">Diagnóstico de Madurez en IA</div>
        <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--g4);margin-top:4px;">Preparado por <span style="color:var(--wh);font-weight:500;">Javier Cruz</span> · javiercruz.ai</div>
      </div>
    </div>
    <div class="hdr-meta">
      <div class="meta-date">${fecha} · Diagnóstico Enterprise v2.0</div>
      <div class="meta-conf">Confidencial · Solo para el evaluado</div>
    </div>
  </div>
  <div style="display:flex;align-items:baseline;gap:20px;flex-wrap:wrap;">
    <div class="recipient-name">${participant.nombre}</div>
    <div style="display:flex;align-items:baseline;gap:8px;padding-bottom:4px;">
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:42px;font-weight:900;line-height:1;color:var(--p);letter-spacing:-1px;">${nivel}</div>
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:24px;font-weight:700;color:var(--g3);text-transform:uppercase;letter-spacing:.02em;">${nivelNombre}</div>
    </div>
  </div>
  <div class="recipient-role">
    <span>${participant.empresa}</span>
    <div class="role-sep"></div>
    <span>${participant.departamento}</span>
    <div class="role-sep"></div>
    <span>${participant.posicion}</span>
    <div class="role-sep"></div>
    Diagnóstico completado: ${fecha}
  </div>
</header>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">01</div>
    <div class="sec-title">Qué medimos y cómo</div>
    <div class="sec-line"></div>
  </div>
  <p style="font-size:14px;color:var(--g2);line-height:1.7;font-weight:300;margin-bottom:20px;max-width:640px;">
    Este diagnóstico no mide cuánto <em>sabes</em> sobre inteligencia artificial. Mide algo más valioso y más difícil de falsificar: <strong style="color:var(--wh);font-weight:600;">cómo la usas hoy en tu trabajo real</strong>. Tus respuestas, los ejemplos que diste, los prompts que escribiste en vivo — todo eso revela tu nivel de madurez AIQ con mucha más precisión que cualquier cuestionario de opción múltiple.
  </p>
  <div class="intro-grid">
    <div class="intro-card">
      <div class="intro-card-lbl">Bloque A · 30%</div>
      <div class="intro-card-name">Tu Experiencia Real con IA</div>
      <div class="intro-card-desc">Comportamiento real ante situaciones concretas. Lo más difícil de falsificar porque exige ejemplos verificables de tu trabajo.</div>
    </div>
    <div class="intro-card">
      <div class="intro-card-lbl">Bloque B · 30%</div>
      <div class="intro-card-name">Criterio y Capacidades Técnicas</div>
      <div class="intro-card-desc">Comprensión aplicada de los conceptos más relevantes para usar la IA con criterio en el día a día.</div>
    </div>
    <div class="intro-card">
      <div class="intro-card-lbl">Bloque C · 40%</div>
      <div class="intro-card-name">Laboratorio de Ejecución</div>
      <div class="intro-card-desc">Escribiste prompts reales en vivo. Imposible inflar este resultado — no se puede fingir ejecución.</div>
    </div>
  </div>
  <div class="intro-note">
    El diagnóstico también incluyó preguntas sobre <strong>cultura y contexto organizacional</strong> — qué tan apoyado te sientes, qué herramientas tienes acceso, qué políticas conoces. Esa información alimenta el reporte de tu empresa, pero no afecta tu nivel AIQ individual.
  </div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">02</div>
    <div class="sec-title">Tu resultado</div>
    <div class="sec-line"></div>
  </div>
  <div class="result-main">
    <div style="flex-shrink:0;">
      <div style="font-family:'Big Shoulders Display',sans-serif;font-size:72px;font-weight:900;line-height:1;color:var(--p);letter-spacing:-2px;">${nivel}</div>
      <div style="font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);letter-spacing:.2em;margin-top:4px;">${scores.aiqScore?.toFixed(2)} / 5.0</div>
    </div>
    <div>
      <div class="result-tag">Tu nivel AIQ</div>
      <div class="result-name-big">${nivelNombre.replace(/(\w+)$/, '<em>$1</em>')}</div>
    </div>
  </div>
  <div class="level-bar">${barraHTML}</div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">03</div>
    <div class="sec-title">Tu perfil por dimensión</div>
    <div class="sec-line"></div>
  </div>
  <div class="dims">
    <div class="dim">
      <div class="dim-left">
        <div class="dim-code">Bloque A · ${scores.sectionA?.toFixed(1)}</div>
        <div class="dim-name">Experiencia<br>Real</div>
      </div>
      <div class="dim-right">
        <div class="dim-interpretation">${analysis.dim_a_interpretacion || ''}</div>
        <div class="dim-signal">${analysis.dim_a_gap || ''}</div>
      </div>
    </div>
    <div class="dim">
      <div class="dim-left">
        <div class="dim-code">Bloque B · ${scores.sectionB?.toFixed(1)}</div>
        <div class="dim-name">Criterio<br>Técnico</div>
      </div>
      <div class="dim-right">
        <div class="dim-interpretation">${analysis.dim_b_interpretacion || ''}</div>
        <div class="dim-signal">${analysis.dim_b_gap || ''}</div>
      </div>
    </div>
    <div class="dim">
      <div class="dim-left">
        <div class="dim-code">Bloque C · ${scores.sectionC?.toFixed(1)}</div>
        <div class="dim-name">Laboratorio<br>de Ejecución</div>
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
    <div class="sec-title">Lo que tus respuestas revelan</div>
    <div class="sec-line"></div>
  </div>
  <p style="font-size:13px;color:var(--g3);line-height:1.6;margin-bottom:24px;font-weight:300;max-width:560px;">
    Estas observaciones vienen directamente de lo que respondiste, no de un perfil genérico. Son patrones detectados en tus ejemplos, tus prompts y tus decisiones durante el diagnóstico.
  </p>
  <div class="insights">
    ${fortalezasHTML}
    ${oportunidadesHTML}
  </div>
</section>

<section class="sec">
  <div class="sec-label">
    <div class="sec-num">05</div>
    <div class="sec-title">Tu próximo nivel y cómo llegar</div>
    <div class="sec-line"></div>
  </div>
  <div class="next-from-to">
    <div class="next-lvl current">
      <span class="next-lvl-label">Hoy estás en</span>
      <span class="next-lvl-name">${nivelNombre}</span>
    </div>
    <div class="next-arrow">→</div>
    <div class="next-lvl target">
      <span class="next-lvl-label">Tu próximo paso</span>
      <span class="next-lvl-name">${nivelSigNombre}</span>
    </div>
  </div>
  <div class="next-desc">${analysis.proximo_nivel_descripcion || ''}</div>
  <div class="gaps">${gapsHTML}</div>
</section>

<section class="sec" style="border-bottom:none;">
  <div class="sec-label">
    <div class="sec-num">06</div>
    <div class="sec-title">Tu resultado en contexto</div>
    <div class="sec-line"></div>
  </div>
  <div class="context-grid">
    <div class="ctx-card">
      <div class="ctx-label">Distribución de niveles en ${participant.empresa}</div>
      ${distHTML}
      ${topPctText ? `<div class="dist-footnote">${topPctText}</div>` : ''}
    </div>
    <div class="ctx-card">
      <div class="ctx-label">Qué sigue a partir de aquí</div>
      <div class="ctx-next-card">
        <div class="ctx-next-item">
          <div class="ctx-next-ico">📄</div>
          <div class="ctx-next-text"><strong>Este informe es tuyo</strong>Úsalo como punto de referencia personal. Tu nivel actual es una fotografía — no una sentencia.</div>
        </div>
        <div class="ctx-next-item">
          <div class="ctx-next-ico">🎯</div>
          <div class="ctx-next-text"><strong>Tres cosas concretas</strong>Las recomendaciones de la sección anterior no son opcionales — son los tres movimientos específicos que separan tu nivel actual del siguiente.</div>
        </div>
        <div class="ctx-next-item">
          <div class="ctx-next-ico">💬</div>
          <div class="ctx-next-text"><strong>¿Tienes preguntas?</strong>Escribe a tu coordinador del programa o al equipo de AI Pulse para una sesión de revisión.</div>
        </div>
      </div>
    </div>
  </div>
  <div class="close-quote">
    <div class="close-quote-text">${analysis.frase_cierre || 'La diferencia entre quien está en este nivel y quien llega al siguiente no es talento ni experiencia — es <strong>intención deliberada</strong>.'}</div>
  </div>
</section>

<footer class="ftr">
  <div class="ftr-top">
    <div class="ftr-aipulse">
      <div class="ftr-aipulse-icon"><span>AIQ</span></div>
      <div>
        <div class="ftr-aipulse-name">AI <em>Pulse</em></div>
        <div class="ftr-aipulse-sub">AIQ Framework v2.0 · Confidencial · Solo para el evaluado</div>
      </div>
    </div>
    <div class="ftr-meta">
      <div class="ftr-stat">${participant.nombre} · ${participant.empresa}</div>
      <div class="ftr-stat">${participant.departamento} · ${participant.posicion}</div>
      <div class="ftr-stat">Diagnóstico Enterprise v2.0 · ${fecha}</div>
    </div>
  </div>
  <div class="ftr-jc">
    <div class="jc-mark">
      <div class="jc-monogram"><span>JC</span></div>
      <div>
        <div class="jc-name">Javier Cruz</div>
        <div class="jc-slogan">Designing <em>Human-AI Advantage</em></div>
      </div>
    </div>
    <div class="jc-web">javiercruz.ai</div>
  </div>
</footer>

</div>
</body>
</html>`;
}
