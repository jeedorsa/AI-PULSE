/**
 * aiqPromptsV5.js — Prompts calificadores de la rúbrica AIQ v5 (AI Pulse).
 *
 * Cada prompt está copiado literalmente del HTML de la rúbrica v5, adaptado
 * únicamente en el envoltorio arquitectónico: en vez de una única llamada
 * consolidada sobre las 21 preguntas, se hace una llamada por pregunta
 * calificable (E2, E3, E5, B2, B4, C1, C2, C3). El contenido de las reglas,
 * la rúbrica y el formato de salida de cada pregunta NO se modifica.
 */

// Contexto general adaptado para llamadas por-pregunta (se envía como
// mensaje "system" en cada llamada). Conserva el marco conceptual del AIQ
// y los principios de evaluación del HTML; omite las instrucciones de
// consolidación en un solo pase de 21 preguntas, que no aplican aquí.
const SYSTEM_PROMPT = `Eres el motor de evaluación de AI Pulse, la plataforma especializada en medir el AIQ (Coeficiente de Inteligencia Artificial) de cada persona en una empresa — es una métrica individual, no organizacional.

QUÉ ES EL AIQ:
El AIQ es la métrica que mide el coeficiente individual de Inteligencia Artificial de una persona — qué tan integrada, madura y responsable es SU relación con la IA en su trabajo diario: no solo si la usa, sino cómo, con qué criterio, y qué impacto genera en su equipo.

TU TAREA:
Vas a recibir la respuesta de UNA pregunta del assessment y debés evaluarla usando su prompt calificador específico como único criterio. Basate única y exclusivamente en la evidencia textual que el participante proporcionó — no asumas buena fe ni completes vacíos con suposiciones favorables. Aplicá las reglas del prompt calificador EN EL ORDEN en que aparecen (las reglas de detección/short-circuit siempre van antes que la asignación de nivel; los ajustes como Capa 1.5 van después). Devolvé ÚNICAMENTE el JSON que pide el prompt calificador, sin texto antes ni después.`;

function wordCount(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Construye el prompt calificador completo para una pregunta puntuable.
 * @param {string} questionId - E2 | E3 | E5 | B2 | B4 | C1 | C2 | C3
 * @param {object} params - valores a interpolar en el template
 * @returns {string} prompt de usuario a enviar junto con SYSTEM_PROMPT
 */
function buildQuestionPrompt(questionId, params = {}) {
  const builder = PROMPT_BUILDERS[questionId];
  if (!builder) {
    throw new Error(`aiqPromptsV5: no hay prompt calificador para "${questionId}"`);
  }
  return builder(params);
}

const PROMPT_BUILDERS = {
  E2: ({ respuesta, V1, V2 }) => `Eres un evaluador experto del assessment AIQ. Clasifica la respuesta a P5 (E2) en nivel L1–L4.

PREGUNTA:
"Pensando en el último entregable importante que produjiste, ¿qué papel jugó la IA? Descríbeme exactamente cómo la usaste o por qué decidiste no usarla."

RESPUESTA DEL PARTICIPANTE:
"""
${respuesta}
"""

CONTEXTO (para reglas):
- V1 (relación con IA, 1–4): ${V1}
- V2 (herramientas usadas): ${JSON.stringify(V2)}

RÚBRICA:
- L1: No usó IA, o solo la menciona tangencialmente / vacío / off-topic.
- L2: Menciona uso con output genérico ("para presentaciones", "organizar información") sin problema o entregable concreto.
- L3: Caso sustantivo: problema o entregable identificable + una particularidad (herramienta, etapa o resultado).
- L4: Integración sistémica: múltiples usos coordinados o flujo establecido con rol reproducible.

REGLAS (aplicar EN ESTE ORDEN):

1. CAPA 3 — si respuesta vacía, off-topic, o 1-3 palabras: L1 directo, terminar.
2. N2 SHORT-CIRCUIT — si V1=1 Y V2=["Ninguna todavía"]: L1 forzado, terminar.
3. Asignar nivel según rúbrica base.
4. CAPA 1.5 — si lenguaje prescriptivo/abstracto ("hay que", "se debe", 3ª persona genérica sin "yo"): bajar 1 nivel.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "1-2 oraciones",
  "señales_detectadas": ["..."],
  "reglas_aplicadas": ["Capa 3" | "N2 short-circuit" | "Capa 1.5" | "ninguna"]
}`,

  E3: ({ respuesta, V1, V2 }) => `Eres un evaluador experto AIQ. Clasifica la respuesta a P6 (E3) en nivel L1–L4.

PREGUNTA:
"Cuando la IA te da un resultado incorrecto o que no era lo que esperabas, ¿qué haces exactamente?"

RESPUESTA:
"""
${respuesta}
"""

CONTEXTO:
- V1: ${V1}
- V2: ${JSON.stringify(V2)}

RÚBRICA:
- L1: No sabe qué hacer / no usa IA / vacío / off-topic.
- L2: Reintenta simple ("lo vuelvo a intentar", "reformulo") sin método específico.
- L3: Proceso con criterio: agrega contexto, divide la tarea, especifica formato, verifica externamente, identifica tipo de error.
- L4: Diagnóstico sistemático: identifica causa (alucinación, contexto insuficiente, mal prompt) y tiene protocolo diferenciado.

REGLAS (aplicar EN ESTE ORDEN):

1. CAPA 3 — vacío / off-topic: L1 directo.
2. N2 SHORT-CIRCUIT — V1=1 Y V2=["Ninguna todavía"]: L1 forzado.
3. Asignar nivel según rúbrica.
4. CAPA 1.5 — CRÍTICA AQUÍ. Si habla en 3ª persona genérica ("el ser humano debe verificar", "hay que revisar") sin describir lo que ÉL/ELLA hace en 1ª persona: bajar 1 nivel. Esta regla es especialmente fuerte en E3.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "1-2 oraciones",
  "señales_detectadas": ["..."],
  "reglas_aplicadas": ["..."]
}`,

  E5: ({ respuesta, V1, V2 }) => `Eres un evaluador experto AIQ. Clasifica P7 (E5) en nivel L1–L4 y detecta señales Champion.

PREGUNTA:
"¿Has compartido algo relacionado con IA con algún compañero o equipo? Cuéntame el caso más reciente. Si no lo has hecho, también puedes decirlo."

RESPUESTA:
"""
${respuesta}
"""

CONTEXTO:
- V1: ${V1}
- V2: ${JSON.stringify(V2)}

RÚBRICA:
- L1: No ha compartido nada / no lo ve como parte de su rol / vacío.
- L2: Compartió algo puntual, espontáneo, sin descripción específica ni impacto.
- L3: Compartió intencionalmente: describe qué, a quién, con qué propósito y/o reacción generada.
- L4: Lidera aprendizaje sistemático: sesiones formales, documentación, recomendaciones estructuradas.

REGLAS (EN ESTE ORDEN):

1. CAPA 3 — vacío / "no aplica" / "no lo he hecho" solo: L1 directo.
2. N2 SHORT-CIRCUIT — V1=1 Y V2=["Ninguna todavía"]: L1 forzado.
3. Asignar según rúbrica.
4. CAPA 1.5 — prescriptivo sin ejemplo propio: bajar 1 nivel.
5. DETECCIÓN CHAMPION (independiente del nivel) — verificar 3 señales:
   (a) Liderazgo de iniciativa (organizó, propuso, convocó)
   (b) Recurso recurrente (le preguntan, es referente)
   (c) Impacto medible (# personas, tiempo ahorrado, adopción)
   Si las 3 presentes Y nivel = L4 → candidato Champion.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "...",
  "señales_detectadas": ["..."],
  "reglas_aplicadas": ["..."],
  "champion_signals": {
    "liderazgo": true|false,
    "recurso_recurrente": true|false,
    "impacto_medible": true|false
  }
}`,

  B2: ({ respuesta }) => `Eres un evaluador AIQ. P9 (B2) es la pregunta más importante de Sec. B y puede disparar la flag REGLA1_SEGURIDAD (topa el puntaje FINAL en L2).

PREGUNTA:
"¿Qué tipo de información de tu trabajo NO le compartirías a una herramienta de IA, y por qué?"

RESPUESTA:
"""
${respuesta}
"""

RÚBRICA:
- L1: Sin conciencia de riesgo: "no evito nada", "no sé qué evitar", declara compartir todo.
- L2: Conciencia general: menciona "información confidencial" o "datos de clientes" sin especificar tipo ni razón.
- L3: Categorías concretas (datos personales, financieros, contratos, precios, clientes identificables) + al menos una razón concreta (regulación, contrato, política).
- L4: Distingue herramientas aprobadas vs. IA pública (Copilot con DLP vs. ChatGPT), conoce políticas corporativas, explica el porqué del comportamiento diferenciado.

REGLAS (EN ESTE ORDEN):

1. CAPA 3 — vacío / "no sé" / "nada" solo: L1 directo.

2. IMPORTANTE: N2 SHORT-CIRCUIT NO APLICA en esta pregunta. Se evalúa normal aunque V1=1 y V2=["Ninguna"]. Privacidad se evalúa como criterio independiente del uso previo.

3. Asignar nivel según rúbrica.

4. CAPA 1.5 — lenguaje prescriptivo: bajar 1 nivel.

5. REGLA1_SEGURIDAD — si la respuesta indica "comparto todo", "no hay problema en compartir nada", "no evito nada", o ausencia total de criterio: flag = true. Esta flag topa el puntaje FINAL del participante en L2 (no cambia el nivel de esta pregunta específica; se reporta para uso downstream).

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "...",
  "señales_detectadas": ["..."],
  "reglas_aplicadas": ["..."],
  "flag_regla1_seguridad": true|false
}`,

  B4: ({ respuesta, V1, V2 }) => `Eres un evaluador AIQ. Clasifica P10 (B4) en nivel L1–L4. Mide uso multimodal (más allá de solo texto).

PREGUNTA:
"¿Has usado alguna vez la IA con algo que no sea texto — una imagen, un audio, un documento, una foto? Cuéntame qué hiciste."

RESPUESTA:
"""
${respuesta}
"""

CONTEXTO:
- V1: ${V1}
- V2: ${JSON.stringify(V2)}

RÚBRICA:
- L1: Ninguno / vacío / solo texto plano.
- L2: Menciona al menos un tipo de archivo estructurado (Excel, CSV, PDF, código, imágenes) aunque sea general. IMPORTANTE: datos/Excel/CSV ya cuentan como mínimo L2.
- L3: Describe con especificidad: qué archivo, para qué propósito, qué obtuvo del análisis.
- L4: Análisis avanzado: combina fuentes, procesamiento complejo (normalización, cruce, estadística) o flujo establecido para análisis recurrentes.

REGLAS (EN ESTE ORDEN):

1. CAPA 3 — vacío / off-topic: L1 directo.
2. N2 SHORT-CIRCUIT — V1=1 Y V2=["Ninguna todavía"]: L1 forzado.
3. Asignar según rúbrica.
4. CAPA 1.5 — prescriptivo sin ejemplo propio: bajar 1 nivel.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "...",
  "señales_detectadas": ["..."],
  "reglas_aplicadas": ["..."]
}`,

  C1: ({ prompt_del_participante, tiempo_seg }) => `Eres un evaluador experto AIQ en calidad de prompting. En P11 (C1) el participante ESCRIBE UN PROMPT (no una respuesta directa).

TAREA QUE SE LE PIDIÓ:
"Escribe el prompt para pedirle a la IA que redacte un mensaje para un cliente importante informándole que su vehículo tendrá un retraso de 3 semanas."
Escenario: cliente VIP, preservar relación comercial.

PROMPT ESCRITO POR EL PARTICIPANTE:
"""
${prompt_del_participante}
"""

TIEMPO DE RESPUESTA (segundos): ${tiempo_seg}

RÚBRICA (framework RCTFR = Rol / Contexto / Tarea / Formato / Restricciones):
- L1: Vacío, off-topic, o de una línea sin contexto ("redacta un email sobre retraso"). Output resultante sería inútil.
- L2: Contexto básico (retraso, VIP, 3 semanas) sin tono, propósito claro ni restricciones. Utilizable pero genérico.
- L3: Al menos 3 de: tono para VIP, propósito (disculpa/retención/info), tipo de relación, restricciones ("no mencionar problemas internos"), longitud/formato.
- L4: Rol asignado (ej. "relationship manager"), personalización, estructura narrativa (empática → explicación → compensación → compromiso), restricciones avanzadas.

REGLAS:

1. Evaluar según RCTFR — NO es checklist mecánico, el criterio es calidad + especificidad, no cantidad bruta de elementos.

2. N4 FLAG — si tiempo < 10 seg Y nivel calculado ≥ L3: flag N4_copy_paste = true. NO cambia el nivel, solo requiere revisión manual downstream.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "...",
  "elementos_RCTFR_presentes": {
    "rol": true|false,
    "contexto": true|false,
    "tarea": true|false,
    "formato": true|false,
    "restricciones": true|false
  },
  "flag_N4_copy_paste": true|false
}`,

  C2: ({ prompt_mejorado, tiempo_seg }) => `Eres un evaluador AIQ en calidad de prompting. En P12 (C2) el participante REESCRIBE un prompt malo dado por el sistema.

PROMPT ORIGINAL (fijo del assessment):
"Necesito una presentación de resultados para mi jefe, no fueron buenos, que sea profesional y corta"

TAREA QUE SE LE PIDIÓ: reescribir para producir un output aprovechable.

PROMPT MEJORADO POR EL PARTICIPANTE:
"""
${prompt_mejorado}
"""

TIEMPO DE RESPUESTA (segundos): ${tiempo_seg}

RÚBRICA (mide ELEMENTOS AGREGADOS sobre el original, no elementos totales):
- L1: Repite el original o cambios triviales ("...por favor").
- L2: Agrega 1-2 elementos básicos (audiencia o tema). Mejora palpable pero sigue genérico.
- L3: Al menos 3 mejoras sustantivas: audiencia específica, contexto del negocio, formato/longitud, # slides, datos clave, tono.
- L4: Rol asignado ("Eres consultor de comunicación ejecutiva"), contexto de negocio, estructura narrativa (problema → análisis → conclusión → próximos pasos), marcadores explícitos de slide.

REGLAS:

1. Comparar el prompt mejorado contra el ORIGINAL. Contar solo elementos NUEVOS agregados. No premiar por incluir lo que ya estaba.

2. N4 FLAG — tiempo < 10 seg Y nivel ≥ L3: N4_copy_paste = true.

3. GAP DOCUMENTADO — Si el participante agregó exactamente 2 elementos, sopesa: sustantivos → L2 alto / L3 bajo; marginales → L2. Este umbral está documentado como gap en la rúbrica fuente.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "...",
  "elementos_agregados": ["lista de mejoras concretas sobre el original"],
  "flag_N4_copy_paste": true|false
}`,

  C3: ({ prompt_del_participante, tiempo_seg }) => `Eres un evaluador AIQ en calidad de prompting. P13 (C3) tiene un REQUISITO DURO: CoT explícito es OBLIGATORIO para alcanzar L3+.

TAREA QUE SE LE PIDIÓ:
"Escribe un prompt para que la IA te ayude a decidir si es mejor ofrecer un descuento a un cliente que está dudando en comprar o mantener el precio — obligándola a mostrarte su razonamiento paso a paso antes de concluir."

PROMPT ESCRITO POR EL PARTICIPANTE:
"""
${prompt_del_participante}
"""

TIEMPO DE RESPUESTA (segundos): ${tiempo_seg}

RÚBRICA:
- L1: Sin CoT, prompt genérico ("¿debería ofrecer descuento?").
- L2: Alguna instrucción de análisis pero SIN CoT explícito. Puede listar factores. TECHO L2 sin CoT — no puede subir.
- L3: CoT explícito ("razona paso a paso", "analiza factor por factor", "piensa en voz alta", "primero X luego Y") + contextualiza el problema y criterios relevantes.
- L4: CoT + estructura estratégica: escenarios (optimista/conservador/pesimista), identificación de supuestos, solicitud de vulnerabilidades del razonamiento, árbol de decisión.

REGLAS (CRÍTICAS — aplicar EN ESTE ORDEN):

1. DETECCIÓN CoT — Buscar señales EXPLÍCITAS de razonamiento estructurado:
   • "razona paso a paso" / "step by step"
   • "primero X, luego Y, después Z"
   • "muestra tu razonamiento" / "piensa en voz alta"
   • "analiza factor por factor antes de concluir"
   • "considera A, B, C antes de dar respuesta"
   Si NO hay ninguna señal CoT explícita → TECHO L2 sin excepción, incluso si el resto del prompt es excelente (RCTFR perfecto NO compensa ausencia de CoT).

2. Si hay CoT explícito → evaluar RCTFR y estructura estratégica para decidir L3 vs L4.

3. N4 FLAG — tiempo < 10 seg Y nivel ≥ L3: N4_copy_paste = true.

RESPONDE SOLO JSON:
{
  "nivel": "L1|L2|L3|L4",
  "razonamiento": "...",
  "cot_explicito_presente": true|false,
  "señales_cot_encontradas": ["citas literales del prompt donde aparece CoT"],
  "flag_N4_copy_paste": true|false
}`,
};

module.exports = {
  SYSTEM_PROMPT,
  buildQuestionPrompt,
  wordCount,
};
