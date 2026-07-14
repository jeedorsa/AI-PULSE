/**
 * aiqRubricV5.js — Configuración estática de la rúbrica AIQ v5 (AI Pulse).
 *
 * Centraliza pesos, rangos de nivel, mapeos de preguntas cerradas y el
 * catálogo de recomendaciones. No contiene lógica de orquestación ni
 * llamadas a servicios externos — ver aiqEvaluatorV5.js para eso.
 */

const LEVEL_TO_INT = { L1: 1, L2: 2, L3: 3, L4: 4 };
const INT_TO_LEVEL = { 1: "L1", 2: "L2", 3: "L3", 4: "L4" };

const SECTION_WEIGHTS = { A: 0.3, B: 0.2, C: 0.5 };

// Preguntas calificables (con nivel L1-L4) por sección, en el orden de
// desempate del catálogo de recomendaciones (P5<P6<P7, P9<P10, P11<P12<P13).
const SECTION_QUESTIONS = {
  A: ["E2", "E3", "E5", "E6"],
  B: ["B1", "B2", "B4"],
  C: ["C1", "C2", "C3"],
};

// ID de pregunta -> número de pregunta del assessment (para recomendaciones_ids).
const QUESTION_NUMBER = {
  E2: "P5",
  E3: "P6",
  E5: "P7",
  B1: "P8",
  B2: "P9",
  B4: "P10",
  C1: "P11",
  C2: "P12",
  C3: "P13",
  E6: "P14",
};

// Rangos de nivel general a partir del puntaje final (1.0 - 4.0).
const LEVEL_RANGES = [
  { level: "L1", min: 1.0, max: 1.5 },
  { level: "L2", min: 1.6, max: 2.5 },
  { level: "L3", min: 2.6, max: 3.5 },
  { level: "L4", min: 3.6, max: 4.0 },
];

function levelFromPuntaje(puntaje) {
  for (const range of LEVEL_RANGES) {
    if (puntaje >= range.min && puntaje <= range.max) return range.level;
  }
  return puntaje < LEVEL_RANGES[0].min ? "L1" : "L4";
}

// REGLA1_SEGURIDAD: tope de puntaje/nivel cuando se dispara en B2.
const REGLA1_CAP_PUNTAJE = 2.5;

// B1 (P8) — cerrada, mapeo directo opción -> nivel (sin LLM).
const B1_OPTION_TO_LEVEL = {
  1: "L2",
  2: "L3",
  3: "L3",
  4: "L4",
  5: "L1",
};

// CANDIDATO_A_CHAMPION — umbral de puntaje (interpretación estricta, ver plan).
const CHAMPION_PUNTAJE_THRESHOLD = 3.6;

// Preguntas abiertas que cuentan para el flag N3 (≥50% cortas/vacías).
const N3_QUESTIONS = ["E2", "E3", "E5", "E6", "B2", "B4"];

// Preguntas de Sección C con posible flag N4 por tiempo < 10s.
const N4_QUESTIONS = ["C1", "C2", "C3"];

/**
 * Catálogo de recomendaciones — mirror exacto de las tarjetas del HTML.
 * Indexado por questionId y transición (t-12: L1->L2, t-23: L2->L3, t-34: L3->L4).
 * B1 (P8) queda deliberadamente fuera: el catálogo no tiene tarjetas para esa pregunta.
 */
const RECOMMENDATION_CATALOG = {
  E6: {
    "t-12": {
      headline: "Antes de seguir usando IA a diario, aclara qué es realmente un 'agente' de IA — no es lo mismo que un chatbot.",
      body: "Busca una explicación corta (5 minutos) sobre agentes de IA: la idea clave es que un agente puede actuar por su cuenta — tomar decisiones y usar herramientas para cumplir un objetivo — en vez de solo responder una pregunta a la vez como un chat normal. Entender esta diferencia te va a ayudar a reconocer cuándo una herramienta nueva es realmente un agente y qué puede hacer por vos.",
    },
    "t-23": {
      headline: "Ya distinguís un agente de un chatbot — ahora identifica un caso donde uno podría ayudarte en tu rol.",
      body: "Pensá en una tarea repetitiva de varios pasos (armar un reporte, cruzar información de varias fuentes, hacer seguimiento a pendientes) y pregúntate si un agente podría encargarse de esos pasos sin que tengas que ir guiándolo uno por uno. No hace falta implementarlo todavía — con identificar el caso ya estás un paso más cerca de usarlo con criterio.",
    },
    "t-34": {
      headline: "Prueba un agente de IA real en una tarea de tu trabajo y compará el resultado con hacerlo vos mismo paso a paso.",
      body: "Elegí una tarea concreta (por ejemplo, investigar un tema y armar un resumen, o automatizar una serie de pasos repetitivos) y probala con un agente disponible en las herramientas que ya usás. La diferencia entre entender el concepto y dominarlo es haber visto de primera mano qué tan autónomo puede ser, y dónde todavía necesita supervisión tuya.",
    },
  },
  E2: {
    "t-12": {
      headline: "Esta semana, identifica UNA tarea de tu rol donde la IA podría ahorrarte tiempo y pruébala.",
      body: "No tiene que ser algo grande. Puede ser resumir un documento, redactar un email rutinario, o buscar información. Abre Copilot, describe la tarea en una o dos frases, y observa qué devuelve. El objetivo no es el resultado perfecto: es estrenar el hábito.",
    },
    "t-23": {
      headline: "La próxima vez que uses IA para un entregable, documenta el caso en una línea: qué problema tenías, cómo lo usaste, qué obtuviste.",
      body: 'Ejemplo: "Tenía que preparar el reporte mensual de ventas. Le di el Excel a Copilot y le pedí un resumen con los 3 insights más relevantes. Me ahorró 40 minutos." Ese registro tiene dos beneficios: te obliga a usar la IA con intención, y en 2 semanas tienes evidencia concreta de su valor en tu rol.',
    },
    "t-34": {
      headline: "Empieza a usar IA en flujos de trabajo, no solo en tareas puntuales.",
      body: "Identifica un proceso recurrente (reporte semanal, preparación de reunión, análisis de resultados) y diseña cómo la IA puede participar en cada etapa. La diferencia entre L3 y L4 no es la frecuencia de uso, sino la sistematización: la IA no es una herramienta que sacas cuando la necesitas, es parte del proceso.",
    },
  },
  E3: {
    "t-12": {
      headline: "La próxima vez que la IA no te dé lo que esperabas, no la abandones: reformula el pedido una vez más.",
      body: "Escribe en una línea qué estuvo mal en la respuesta y luego cambia algo de tu prompt. Eso solo — una iteración deliberada — ya te coloca en un nivel de uso diferente al de la mayoría.",
    },
    "t-23": {
      headline: "Cuando reformules un prompt fallido, añade siempre UN elemento nuevo de contexto específico.",
      body: "No solo \"inténtalo de nuevo\". Identifica qué faltó: ¿no tenía el tono correcto? (añade restricción de tono) ¿el resultado era muy genérico? (añade el contexto específico de tu caso) ¿no entendió el propósito? (explica para qué es). Cada reformulación con diagnóstico te entrena como usuario avanzado.",
    },
    "t-34": {
      headline: "Desarrolla un diagnóstico de errores por tipo: alucinación, contexto insuficiente, pregunta ambigua.",
      body: "Cuando la IA falla, clasifica el error antes de reformular. Cada tipo tiene su solución distinta: la alucinación se corrige con verificación externa; el contexto insuficiente se resuelve añadiendo datos concretos; la pregunta ambigua necesita ser reformulada con criterios de éxito explícitos. Tener ese protocolo te convierte en un evaluador crítico, no solo en un usuario.",
    },
  },
  E5: {
    "t-12": {
      headline: "Esta semana, comparte con UN compañero una herramienta de IA o un caso de uso concreto que hayas descubierto.",
      body: 'No tiene que ser una capacitación. Puede ser un mensaje de WhatsApp o 5 minutos en una reunión: "Oye, descubrí que Copilot puede hacer X — ¿lo has probado?" El acto de compartir consolida tu propio aprendizaje y activa el del otro.',
    },
    "t-23": {
      headline: "Cuando uses IA en un entregable importante, guarda el prompt que usaste y compártelo con tu equipo.",
      body: 'No compartas solo el resultado — comparte el proceso. Ejemplo: "Para el reporte del mes usé este prompt en Copilot: [...] Me dio el análisis listo en 10 minutos." Eso tiene más valor para tus compañeros que el resultado en sí: les da la receta, no solo el plato.',
    },
    "t-34": {
      headline: "Conviértete en el referente de IA de tu equipo: sistematiza lo que sabes.",
      body: "Organiza una sesión breve (30 minutos) para mostrar los 2 o 3 usos de Copilot más valiosos en el contexto de tu área. No hace falta que sepas todo — con mostrar casos reales que ya usaste, generas más impacto que cualquier capacitación teórica.",
    },
  },
  B2: {
    "t-12": {
      headline: "Antes de pegar cualquier texto en Copilot o en otra IA, hazte esta pregunta: ¿hay aquí datos de clientes, empleados o información financiera de {{empresa}}?",
      body: 'Si la respuesta es sí, primero anonimiza: reemplaza nombres propios por "Cliente A", montos específicos por "el monto acordado", y números de identificación por variables genéricas. Ese hábito simple te protege a ti y a la empresa.',
    },
    "t-23": {
      headline: "Aprende la diferencia entre Copilot (seguro para datos internos) y ChatGPT o Claude público (sale de los servidores de {{empresa}}).",
      body: "Copilot M365 de {{empresa}} tiene DLP (Data Loss Prevention): los datos que ingresas no salen del entorno corporativo. ChatGPT, Claude u otras IA públicas no tienen esa garantía. Regla práctica: información de clientes, contratos o estrategia — solo en Copilot. Tareas genéricas sin datos sensibles — cualquier herramienta.",
    },
    "t-34": {
      headline: "Conoce las políticas específicas de uso de IA de {{empresa}} y conviértete en el referente de tu equipo sobre qué se puede y qué no.",
      body: "Pregunta a IT o a tu manager cuál es la política oficial de uso de IA generativa en {{empresa}}. Cuando un compañero tenga dudas sobre si puede usar IA para algo, tú deberías poder orientarlo. Ese conocimiento es una ventaja competitiva además de una responsabilidad.",
    },
  },
  B4: {
    "t-12": {
      headline: "Esta semana, sube un Excel o PDF de trabajo a Copilot y pídele que lo analice.",
      body: 'No hace falta que sea el documento más complejo. Puede ser el reporte del mes, un listado de clientes, o cualquier tabla que uses regularmente. Abre Copilot, adjunta el archivo y escribe: "Resume los puntos más importantes de este documento." Ese primer paso rompe la barrera de creer que la IA solo sirve para texto.',
    },
    "t-23": {
      headline: "Para reportes recurrentes, experimenta con darle el archivo a Copilot y pedirle los 3 insights clave.",
      body: 'La próxima vez que tengas que preparar un análisis de datos o reporte periódico, sube el archivo a Copilot antes de revisarlo manualmente y pide: "Analiza este archivo e identifica los 3 hallazgos más importantes para alguien que toma decisiones." Compara su lectura con la tuya. En 4 semanas sabrás exactamente para qué tipos de análisis Copilot te ahorra tiempo y para cuáles no.',
    },
    "t-34": {
      headline: "Combina múltiples fuentes en Copilot para análisis más ricos: datos + contexto textual.",
      body: 'Cuando tengas un análisis importante, no le pases solo el Excel — añade contexto: "Este es el reporte de ventas de Q1. El objetivo del trimestre era X. Analiza qué áreas lograron el objetivo, cuáles no, y qué patrones explican la diferencia." Esa combinación de datos estructurados + contexto estratégico es donde Copilot genera valor diferencial.',
    },
  },
  C1: {
    "t-12": {
      headline: "Empieza a darle contexto a Copilot antes de pedir el correo.",
      body: 'La próxima vez que le pidas a Copilot un email, añade una línea de contexto antes del pedido: quién eres, a quién va dirigido y cuál es el objetivo. Ejemplo: "Soy coordinador de posventa. Redacta un email para un cliente que lleva 2 semanas esperando su vehículo. El objetivo es disculparse y mantener su confianza." Ese nivel de contexto básico cambia completamente la calidad del resultado.',
    },
    "t-23": {
      headline: "Antes de pedir cualquier comunicación importante, define el tono y el objetivo de la relación.",
      body: 'Añade siempre dos elementos a tus prompts de comunicación: (1) el tono que quieres proyectar ("empático y profesional", "directo pero amable") y (2) qué debe sentir o hacer el lector al terminar de leer. Ejemplo: "Tono: empático y tranquilizador. Al terminar de leer, el cliente debe sentir que está en buenas manos a pesar del retraso." Con eso, Copilot produce comunicación estratégica, no solo funcional.',
    },
    "t-34": {
      headline: "Construye plantillas de prompt reusables para los tipos de comunicación más frecuentes de tu rol.",
      body: "Identifica los 3 tipos de email que escribes más seguido (disculpa a cliente, actualización de estado, solicitud interna). Para cada uno, crea un prompt base con rol, contexto, estructura y tono ya definidos. Cuando llegue la situación real, solo cambia los datos variables. En 2 semanas tendrás un kit de comunicación que te ahorra 30 minutos al día.",
    },
  },
  C2: {
    "t-12": {
      headline: "Esta semana, toma UN prompt que hayas usado y hazle estas dos preguntas: ¿a quién le estoy pidiendo esto? y ¿para quién es el resultado?",
      body: 'Añade esas respuestas al comienzo del prompt. Ejemplo: si escribías "Resume este documento", cámbialo a "Eres un analista de negocios. Resume este documento para presentárselo a un director que no tiene contexto técnico." Esos dos cambios duplican la relevancia del resultado.',
    },
    "t-23": {
      headline: "Cuando un prompt no te dé lo que esperabas, no lo repitas: agrégale UNA capa de especificidad.",
      body: '¿contexto? ¿formato? ¿restricción? Identifica qué faltó y agrégalo. Ejemplo: si la IA te dio una presentación genérica, añade "La presentación es para el comité de dirección. Máximo 5 slides. El primer slide debe resumir el resultado en una sola frase." Cada iteración deliberada te entrena como prompt engineer.',
    },
    "t-34": {
      headline: "Empieza a documentar tus prompts más efectivos como plantillas reusables para el equipo.",
      body: 'Cuando un prompt produzca un resultado que te impresione, guárdalo. Añade una nota de "variables a cambiar" (como fecha, nombre del cliente, tipo de producto). En 30 días tendrás una biblioteca de prompts de alto rendimiento que también puedes compartir con tu equipo.',
    },
  },
  C3: {
    "t-12": {
      headline: 'La próxima vez que uses Copilot para analizar una situación, añade al final: "Analiza los pros y contras antes de responder."',
      body: "Esa instrucción simple transforma una respuesta de opinión en un análisis estructurado. No requiere aprender ninguna técnica nueva: solo agregar una frase.",
    },
    "t-23": {
      headline: "Cuando uses IA para apoyar una decisión, siempre pídele que razone antes de concluir.",
      body: 'Añade frases como "Piensa paso a paso", "Analiza factor por factor" o "Razona en voz alta antes de darme tu recomendación" al final de tus prompts de decisión. La diferencia: una IA sin este pedido te da una conclusión. Con este pedido, te muestra el razonamiento para que puedas cuestionarlo y mejorarlo.',
    },
    "t-34": {
      headline: "Pídele a la IA que identifique los supuestos detrás de su propio análisis.",
      body: '"¿Cuáles son los 2 o 3 supuestos más críticos de este análisis? ¿Qué pasaría si alguno fuera incorrecto?" Después de que la IA te dé una recomendación, añade esa pregunta. Esto convierte a la IA en un verdadero socio de razonamiento estratégico, no solo en un generador de respuestas.',
    },
  },
};

/**
 * Reemplaza {{nombre}} y {{empresa}} en el texto de una tarjeta de recomendación.
 */
function renderRecommendationText(text, { nombre, empresa }) {
  return text
    .replace(/\{\{nombre\}\}/g, nombre || "")
    .replace(/\{\{empresa\}\}/g, empresa || "tu empresa");
}

// Descompone un ID de recomendación (formato `<Sección>-P<##>-L#->L#`, ver
// selectRecommendations en aiqEvaluatorV5.js) para poder buscar la tarjeta
// correspondiente en RECOMMENDATION_CATALOG. Función de solo lectura: no
// participa en el cálculo de qué recomendación se elige, solo en cómo se
// traduce un ID ya elegido a texto legible.
function parseRecommendationId(id) {
  const match = /^([ABC])-P(\d+)-L(\d)->L(\d)$/.exec(id || "");
  if (!match) return null;
  const [, section, pNum, curLevel] = match;
  const questionId = Object.keys(QUESTION_NUMBER).find((q) => QUESTION_NUMBER[q] === `P${pNum}`);
  if (!questionId) return null;
  const cur = Number(curLevel);
  const transition = cur === 1 ? "t-12" : cur === 2 ? "t-23" : "t-34";
  return { section, questionId, transition };
}

/**
 * Convierte un array de recomendaciones_ids (ya calculado por
 * selectRecommendations) en las tarjetas de texto del catálogo, personalizadas
 * con {{nombre}}/{{empresa}}. IDs que no matchean ninguna tarjeta se omiten
 * en silencio (nunca lanza, nunca fabrica contenido).
 */
function recommendationCardsFromIds(ids, { nombre, empresa } = {}) {
  return (ids || [])
    .map((id) => {
      const parsed = parseRecommendationId(id);
      const card = parsed && RECOMMENDATION_CATALOG[parsed.questionId]?.[parsed.transition];
      if (!card) return null;
      return {
        id,
        headline: renderRecommendationText(card.headline, { nombre, empresa }),
        body: renderRecommendationText(card.body, { nombre, empresa }),
      };
    })
    .filter(Boolean);
}

module.exports = {
  LEVEL_TO_INT,
  INT_TO_LEVEL,
  SECTION_WEIGHTS,
  SECTION_QUESTIONS,
  QUESTION_NUMBER,
  LEVEL_RANGES,
  levelFromPuntaje,
  REGLA1_CAP_PUNTAJE,
  B1_OPTION_TO_LEVEL,
  CHAMPION_PUNTAJE_THRESHOLD,
  N3_QUESTIONS,
  N4_QUESTIONS,
  RECOMMENDATION_CATALOG,
  renderRecommendationText,
  parseRecommendationId,
  recommendationCardsFromIds,
};
