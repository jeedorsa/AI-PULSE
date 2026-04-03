const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../shared/adminAuth");

const NIVEL_NOMBRES = { L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4T: 'Amplificador Técnico', L4L: 'Amplificador Estratégico' };
const NIVELES = ['L1', 'L2', 'L3', 'L4T', 'L4L'];

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function buildCompanyPrompt(empresa, stats, participantes) {
  const muestra = participantes.slice(0, 12).map(p =>
    `- ${p.nombre} (${p.posicion || 'sin cargo'}): AIQ ${p.aiqScore.toFixed(2)} / Nivel ${p.aiqLevel} / A:${p.sectionA.toFixed(1)} B:${p.sectionB.toFixed(1)} C:${p.sectionC.toFixed(1)}`
  ).join('\n');

  return `Eres el analista principal de AI Pulse. Genera el análisis ejecutivo del diagnóstico AIQ de toda la empresa.

EMPRESA: ${empresa}
FECHA: ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}

ESTADÍSTICAS GENERALES:
- Total evaluados: ${stats.total}
- Score AIQ promedio: ${stats.avgAIQ.toFixed(2)} / 5.0
- Promedio Bloque A (Experiencia Real, 30%): ${stats.avgA.toFixed(2)}
- Promedio Bloque B (Criterio Técnico, 30%): ${stats.avgB.toFixed(2)}
- Promedio Bloque C (Laboratorio, 40%): ${stats.avgC.toFixed(2)}

DISTRIBUCIÓN POR NIVEL:
${NIVELES.map(n => `- ${NIVEL_NOMBRES[n]} (${n}): ${stats.dist[n]} personas (${stats.total > 0 ? Math.round((stats.dist[n]/stats.total)*100) : 0}%)`).join('\n')}

MUESTRA DE PARTICIPANTES (hasta 12):
${muestra}

Genera el análisis ejecutivo del estado de madurez IA de esta organización. Responde SOLO con un JSON válido, sin markdown:

{
  "resumen_ejecutivo": "3-4 oraciones describiendo el estado general de madurez IA de la empresa. Sé directo y específico con los números.",
  "nivel_predominante": "${stats.nivelPredominante}",
  "descripcion_nivel_empresa": "2 oraciones sobre qué significa que la mayoría esté en ese nivel para el negocio.",
  "fortaleza_colectiva": "1-2 oraciones sobre qué hace bien la organización como conjunto.",
  "brecha_critica": "1-2 oraciones sobre el gap más importante que limita el avance colectivo.",
  "dimension_mas_fuerte": "${stats.dimMasFuerte}",
  "dimension_mas_debil": "${stats.dimMasDebil}",
  "analisis_dimension_fuerte": "2 oraciones interpretando por qué esta dimensión es la más fuerte y qué lo explica.",
  "analisis_dimension_debil": "2 oraciones sobre por qué esta dimensión es la más débil y qué impacto tiene.",
  "patrones_detectados": [
    { "patron": "Título del patrón observado", "descripcion": "2 oraciones explicando el patrón y su implicancia para la empresa." }
  ],
  "recomendaciones": [
    { "prioridad": "Alta", "accion": "Acción concreta y específica para esta empresa", "impacto": "1 oración sobre el impacto esperado." }
  ],
  "proximos_pasos": "2-3 oraciones sobre qué debería hacer la organización en los próximos 30 días para acelerar la madurez colectiva.",
  "frase_cierre": "1 frase que capture el momento actual de la empresa con IA. Directa, honesta, inspiradora."
}

REGLAS:
- Exactamente 2-3 patrones detectados.
- Exactamente 3 recomendaciones, ordenadas por prioridad (Alta, Media, Media).
- Todo basado en los datos reales, no en generalidades.
- Tono: consultor senior hablando con el CEO, no coach motivacional.`;
}

function generateCompanyHTML(empresa, stats, participantes, analysis) {
  const fecha = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  const distHTML = NIVELES.map(n => {
    const count = stats.dist[n] || 0;
    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
    const isMax = n === stats.nivelPredominante;
    return `<div class="dist-row${isMax ? ' dist-row--active' : ''}">
      <span class="dist-label">${NIVEL_NOMBRES[n]}</span>
      <div class="dist-bar-wrap"><div class="dist-bar" style="width:${pct}%"></div></div>
      <span class="dist-count">${count} <span class="dist-pct">(${pct}%)</span></span>
    </div>`;
  }).join('');

  const patronesHTML = (analysis.patrones_detectados || []).map((p, i) => `
    <div class="patron-item">
      <div class="patron-num">0${i+1}</div>
      <div class="patron-body">
        <div class="patron-titulo">${p.patron}</div>
        <div class="patron-desc">${p.descripcion}</div>
      </div>
    </div>`).join('');

  const recsHTML = (analysis.recomendaciones || []).map(r => `
    <div class="rec-item">
      <div class="rec-prioridad rec-prioridad--${r.prioridad.toLowerCase()}">${r.prioridad}</div>
      <div class="rec-body">
        <div class="rec-accion">${r.accion}</div>
        <div class="rec-impacto">${r.impacto}</div>
      </div>
    </div>`).join('');

  const tablaHTML = participantes.map(p => {
    const levelColor = (p.aiqLevel === 'L4L' || p.aiqLevel === 'L4T') ? '#00AA55' : p.aiqLevel === 'L3' ? '#CC8800' : '#AAAAAA';
    return `<tr>
      <td class="td-nombre">${p.nombre}</td>
      <td class="td-cargo">${p.posicion || '—'}</td>
      <td class="td-dept">${p.departamento || '—'}</td>
      <td class="td-score" style="color:${levelColor};font-weight:600">${p.aiqScore.toFixed(2)}</td>
      <td class="td-level" style="color:${levelColor}">${p.aiqLevel}</td>
      <td class="td-a">${p.sectionA.toFixed(1)}</td>
      <td class="td-b">${p.sectionB.toFixed(1)}</td>
      <td class="td-c">${p.sectionC.toFixed(1)}</td>
    </tr>`;
  }).join('');

  const dimNombres = { A: 'Experiencia Real', B: 'Criterio Técnico', C: 'Laboratorio' };

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Informe Empresa AIQ — ${empresa}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
  :root{--p:#E63946;--g1:#111;--g3:#555;--g4:#AAA;--g5:#F7F7F7;--border:#E0E0E0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'DM Sans',sans-serif;color:var(--g1);background:#fff;font-size:14px;}
  .page{max-width:900px;margin:0 auto;padding:48px 40px;}
  /* Header */
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--g1);padding-bottom:24px;margin-bottom:40px;}
  .hdr-logo{font-family:'DM Serif Display',serif;font-size:28px;color:var(--p);letter-spacing:-.02em;}
  .hdr-right{text-align:right;}
  .hdr-empresa{font-family:'DM Serif Display',serif;font-size:18px;color:var(--g1);}
  .hdr-meta{font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);letter-spacing:.15em;text-transform:uppercase;margin-top:4px;}
  /* Sección */
  .section{margin-bottom:48px;}
  .section-num{font-family:'DM Mono',monospace;font-size:10px;color:var(--p);letter-spacing:.2em;text-transform:uppercase;margin-bottom:6px;}
  .section-title{font-family:'DM Serif Display',serif;font-size:22px;color:var(--g1);margin-bottom:16px;}
  /* Resumen ejecutivo */
  .resumen{background:var(--g5);border-left:3px solid var(--p);padding:20px 24px;font-size:14px;line-height:1.75;color:var(--g1);}
  /* KPIs */
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
  .kpi{background:var(--g5);border:1px solid var(--border);padding:16px;text-align:center;}
  .kpi-val{font-family:'DM Serif Display',serif;font-size:32px;color:var(--p);}
  .kpi-label{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--g4);margin-top:4px;}
  /* Dimensiones */
  .dim-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .dim{border:1px solid var(--border);padding:16px;}
  .dim-name{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--g4);margin-bottom:6px;}
  .dim-score{font-family:'DM Serif Display',serif;font-size:28px;color:var(--g1);}
  .dim-bar{height:3px;background:var(--border);margin-top:8px;}
  .dim-bar-fill{height:100%;background:var(--p);transition:width .5s;}
  .dim-interp{font-size:12px;color:var(--g3);margin-top:8px;line-height:1.5;}
  /* Distribución */
  .dist-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .dist-row--active .dist-label{color:var(--p);font-weight:600;}
  .dist-label{font-family:'DM Mono',monospace;font-size:11px;width:170px;flex-shrink:0;}
  .dist-bar-wrap{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;}
  .dist-bar{height:100%;background:var(--p);border-radius:3px;}
  .dist-row--active .dist-bar{background:var(--p);}
  .dist-count{font-family:'DM Mono',monospace;font-size:11px;color:var(--g1);min-width:60px;}
  .dist-pct{color:var(--g4);}
  /* Patrones */
  .patron-item{display:flex;gap:16px;padding:16px 0;border-bottom:1px solid var(--border);}
  .patron-item:last-child{border-bottom:none;}
  .patron-num{font-family:'DM Mono',monospace;font-size:18px;color:var(--p);flex-shrink:0;width:28px;}
  .patron-titulo{font-weight:600;font-size:13px;margin-bottom:4px;}
  .patron-desc{font-size:12px;color:var(--g3);line-height:1.6;}
  /* Recomendaciones */
  .rec-item{display:flex;gap:16px;padding:16px;border:1px solid var(--border);margin-bottom:10px;}
  .rec-prioridad{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;padding:4px 8px;border-radius:2px;height:fit-content;flex-shrink:0;}
  .rec-prioridad--alta{background:#E63946;color:#fff;}
  .rec-prioridad--media{background:var(--g5);color:var(--g3);border:1px solid var(--border);}
  .rec-accion{font-weight:500;font-size:13px;margin-bottom:4px;}
  .rec-impacto{font-size:12px;color:var(--g3);}
  /* Tabla */
  .tabla-wrap{overflow-x:auto;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{font-family:'DM Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--g4);padding:8px 10px;border-bottom:2px solid var(--g1);text-align:left;}
  td{padding:10px 10px;border-bottom:1px solid var(--border);}
  tr:hover td{background:var(--g5);}
  .td-nombre{font-weight:500;}
  .td-cargo,.td-dept{color:var(--g3);}
  /* Cierre */
  .cierre{background:var(--g1);color:#fff;padding:32px;text-align:center;margin-top:48px;}
  .cierre-frase{font-family:'DM Serif Display',serif;font-size:20px;line-height:1.4;margin-bottom:16px;}
  .cierre-meta{font-family:'DM Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--g4);}
  /* Footer */
  .footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:24px;margin-top:48px;}
  .footer-brand{font-family:'DM Serif Display',serif;font-size:16px;color:var(--p);}
  .footer-meta{font-family:'DM Mono',monospace;font-size:9px;color:var(--g4);text-align:right;}
  @media print{.page{padding:24px;}}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <div>
      <div class="hdr-logo">AIQ</div>
      <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--g4);letter-spacing:.15em;text-transform:uppercase;margin-top:4px;">AI Pulse · Informe Enterprise</div>
    </div>
    <div class="hdr-right">
      <div class="hdr-empresa">${empresa}</div>
      <div class="hdr-meta">${fecha} · Diagnóstico Enterprise v2.0</div>
      <div class="hdr-meta" style="color:var(--p);">Confidencial · Solo para uso interno</div>
    </div>
  </div>

  <!-- 01 Resumen ejecutivo -->
  <div class="section">
    <div class="section-num">01</div>
    <div class="section-title">Resumen ejecutivo</div>
    <div class="resumen">${analysis.resumen_ejecutivo || ''}</div>
  </div>

  <!-- 02 Métricas generales -->
  <div class="section">
    <div class="section-num">02</div>
    <div class="section-title">Métricas generales</div>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${stats.total}</div><div class="kpi-label">Evaluados</div></div>
      <div class="kpi"><div class="kpi-val">${stats.avgAIQ.toFixed(2)}</div><div class="kpi-label">AIQ promedio</div></div>
      <div class="kpi"><div class="kpi-val">${NIVEL_NOMBRES[stats.nivelPredominante] || stats.nivelPredominante}</div><div class="kpi-label">Nivel predominante</div></div>
      <div class="kpi"><div class="kpi-val">${stats.dist['L4T'] + stats.dist['L4L']}</div><div class="kpi-label">Nivel L4 (amplificadores)</div></div>
    </div>
    <p style="font-size:13px;color:var(--g3);line-height:1.7;">${analysis.descripcion_nivel_empresa || ''}</p>
  </div>

  <!-- 03 Dimensiones -->
  <div class="section">
    <div class="section-num">03</div>
    <div class="section-title">Desempeño por dimensión</div>
    <div class="dim-grid">
      ${['A','B','C'].map(d => {
        const score = d === 'A' ? stats.avgA : d === 'B' ? stats.avgB : stats.avgC;
        const interp = d === analysis.dimension_mas_fuerte.replace('Bloque ','')
          ? analysis.analisis_dimension_fuerte
          : d === analysis.dimension_mas_debil.replace('Bloque ','')
            ? analysis.analisis_dimension_debil
            : '';
        return `<div class="dim">
          <div class="dim-name">Bloque ${d} · ${dimNombres[d]}</div>
          <div class="dim-score">${score.toFixed(2)}</div>
          <div class="dim-bar"><div class="dim-bar-fill" style="width:${(score/5)*100}%"></div></div>
          ${interp ? `<div class="dim-interp">${interp}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- 04 Distribución de niveles -->
  <div class="section">
    <div class="section-num">04</div>
    <div class="section-title">Distribución de niveles</div>
    ${distHTML}
  </div>

  <!-- 05 Patrones detectados -->
  <div class="section">
    <div class="section-num">05</div>
    <div class="section-title">Patrones detectados en la organización</div>
    <p style="font-size:13px;color:var(--g3);margin-bottom:16px;line-height:1.7;">
      <strong>Fortaleza colectiva:</strong> ${analysis.fortaleza_colectiva || ''}<br>
      <strong>Brecha crítica:</strong> ${analysis.brecha_critica || ''}
    </p>
    ${patronesHTML}
  </div>

  <!-- 06 Recomendaciones -->
  <div class="section">
    <div class="section-num">06</div>
    <div class="section-title">Recomendaciones para la organización</div>
    ${recsHTML}
    <div style="margin-top:16px;padding:16px;background:var(--g5);font-size:13px;color:var(--g3);line-height:1.7;">
      <strong>Próximos 30 días:</strong> ${analysis.proximos_pasos || ''}
    </div>
  </div>

  <!-- 07 Detalle por participante -->
  <div class="section">
    <div class="section-num">07</div>
    <div class="section-title">Detalle por participante</div>
    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th><th>Cargo</th><th>Dpto.</th>
            <th>AIQ</th><th>Nivel</th><th>A</th><th>B</th><th>C</th>
          </tr>
        </thead>
        <tbody>${tablaHTML}</tbody>
      </table>
    </div>
  </div>

  <!-- Cierre -->
  <div class="cierre">
    <div class="cierre-frase">${analysis.frase_cierre || ''}</div>
    <div class="cierre-meta">AIQ Framework v2.0 · ${empresa} · ${fecha}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">AI Pulse</div>
    <div class="footer-meta">
      Preparado por Javier Cruz · javiercruz.ai<br>
      AIQ Framework v2.0 · Confidencial · Solo para uso interno
    </div>
  </div>

</div>
</body>
</html>`;
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
  const empresa = (body.empresa || "").trim();

  if (!empresa) {
    context.res = { status: 400, headers, body: JSON.stringify({ error: "Falta el nombre de empresa" }) };
    return;
  }

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const openaiKey = process.env.AZURE_OPENAI_API_KEY;
  const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const openaiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

  if (!connectionString || !openaiKey) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: "Configuración incompleta" }) };
    return;
  }

  try {
    const resultsClient = TableClient.fromConnectionString(connectionString, "assessmentResults");

    // Obtener todos los resultados de la empresa
    const participantes = [];
    for await (const entity of resultsClient.listEntities({
      queryOptions: { filter: `PartitionKey eq '${empresa}'` }
    })) {
      participantes.push({
        nombre:      entity.nombre || '',
        posicion:    entity.posicion || '',
        departamento: entity.departamento || '',
        aiqScore:    entity.aiqScore || 0,
        aiqLevel:    entity.aiqLevel || 'L2',
        sectionA:    entity.sectionA || 0,
        sectionB:    entity.sectionB || 0,
        sectionC:    entity.sectionC || 0,
      });
    }

    if (participantes.length === 0) {
      context.res = { status: 404, headers, body: JSON.stringify({ error: `No hay resultados completados para ${empresa}` }) };
      return;
    }

    // Calcular estadísticas
    const dist = { L1: 0, L2: 0, L3: 0, L4T: 0, L4L: 0 };
    participantes.forEach(p => { if (dist[p.aiqLevel] !== undefined) dist[p.aiqLevel]++; });

    const nivelPredominante = NIVELES.reduce((a, b) => (dist[a] >= dist[b] ? a : b));
    const avgAIQ = avg(participantes.map(p => p.aiqScore));
    const avgA   = avg(participantes.map(p => p.sectionA));
    const avgB   = avg(participantes.map(p => p.sectionB));
    const avgC   = avg(participantes.map(p => p.sectionC));

    const dimMap = { A: avgA, B: avgB, C: avgC };
    const dimMasFuerte = Object.entries(dimMap).sort((a,b) => b[1]-a[1])[0][0];
    const dimMasDebil  = Object.entries(dimMap).sort((a,b) => a[1]-b[1])[0][0];

    const stats = {
      total: participantes.length,
      dist,
      nivelPredominante,
      avgAIQ, avgA, avgB, avgC,
      dimMasFuerte: `Bloque ${dimMasFuerte}`,
      dimMasDebil:  `Bloque ${dimMasDebil}`,
    };

    // Llamar a Azure OpenAI
    const prompt = buildCompanyPrompt(empresa, stats, participantes);
    const url = `${openaiEndpoint.replace(/\/$/, '')}/openai/deployments/${openaiDeployment}/chat/completions?api-version=${openaiVersion}`;

    const aiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': openaiKey },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Eres el analista principal de AI Pulse. Respondes SOLO con JSON válido, sin markdown ni texto extra.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      context.log.error('Azure OpenAI error:', aiResponse.status, errBody);
      throw new Error(`Azure OpenAI respondió ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData?.choices?.[0]?.message?.content || '';
    if (!rawText) throw new Error('Azure OpenAI devolvió respuesta vacía');

    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    const html = generateCompanyHTML(empresa, stats, participantes, analysis);

    context.res = {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, html })
    };

  } catch (err) {
    context.log.error("report-generate-company error:", err.message);
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
