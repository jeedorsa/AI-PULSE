// Puerto literal (CommonJS) de las constantes de src/pages/CoachPage.tsx
// (líneas 5-19, 21-46, 62, 296-299) usadas para renderizar el "Perfil AIQ".
// Mantener en sync manualmente si CoachPage.tsx cambia el copy/escala.

const LEVEL_NAMES = {
  L1: "Novato",
  L2: "Experimentador",
  L3: "Practicante",
  L4: "Amplificador",
  L4T: "Amplificador Técnico",
  L4L: "Amplificador Estratégico",
};

const ESCALA_INFO = [
  { code: "L1", desc: "Explora la IA por primera vez" },
  { code: "L2", desc: "Usa la IA en tareas puntuales" },
  { code: "L3", desc: "Integra la IA con criterio y resultados concretos" },
  { code: "L4", desc: "Multiplica el impacto de la IA en su equipo" },
];

const DIM_PROFILE_LABELS = {
  A: "Uso real de IA en tu trabajo",
  B: "Criterio y seguridad",
  C: "Capacidad de prompting",
};

const DIM_LEVEL_DESC = {
  A: {
    L1: "Todavía no has incorporado la IA en tu día a día, o la has explorado muy brevemente. Ese es exactamente el punto de partida que este programa está diseñado para acompañar.",
    L2: "Ya usas la IA para tareas puntuales y genéricas, pero todavía no la conectas con problemas concretos de tu rol. El siguiente paso es identificar un caso de uso específico y repetible.",
    L3: "Tienes casos de uso concretos: identificas un problema o entregable real y sabes que particularidad de la herramienta te ayuda a resolverlo. Ahora el foco es sistematizar ese uso.",
    L4: "Integras la IA de forma sistémica en tu trabajo: coordinas múltiples usos o tienes un flujo ya establecido con un rol reproducible. Eres un referente para tu equipo en este eje.",
  },
  B: {
    L1: "Todavía no tienes un criterio claro sobre qué información compartir con una IA ni cómo verificar lo que te devuelve. Construir ese criterio es la base de un uso responsable.",
    L2: "Tienes conciencia básica de los límites: sabes que no todo se puede compartir y que hay que verificar. El siguiente paso es hacer eso más sistemático y menos intuitivo.",
    L3: "Manejas categorías concretas de información sensible y tienes al menos una razón clara para no compartirlas — regulación, contrato o política. Ese criterio ya es sólido.",
    L4: "Distingues con claridad qué herramienta usar según el tipo de dato (interna vs. pública) y conoces las políticas de tu empresa. Eres referente en criterio de seguridad para tu equipo.",
  },
  C: {
    L1: "Tus instrucciones a la IA son aún simples o generales, lo que limita la calidad de lo que obtienes. Aprender a escribir mejores prompts es la habilidad con mayor retorno inmediato.",
    L2: "Ya agregas algunos elementos de contexto a tus prompts, pero de forma genérica. El siguiente paso es ser más específico: rol, formato y restricciones concretas.",
    L3: "Tus prompts ya incluyen contexto, tono y restricciones claras — y en el caso de decisiones, pides razonamiento paso a paso. Eso te da resultados consistentemente mejores.",
    L4: "Escribes prompts con estructura avanzada: rol específico, narrativa completa y validación del razonamiento de la IA. Eres un usuario avanzado de esta habilidad.",
  },
};

const INT_TO_LEVEL_CODE = { 1: "L1", 2: "L2", 3: "L3", 4: "L4" };

const DIM_BAR_PCT = { L1: 25, L2: 50, L3: 75, L4: 100 };

const DIM_BAR_COLOR = { L1: "#FE3C1C", L2: "#FE3C1C", L3: "#FE3C1C", L4: "#FE3C1C" };

module.exports = {
  LEVEL_NAMES,
  ESCALA_INFO,
  DIM_PROFILE_LABELS,
  DIM_LEVEL_DESC,
  INT_TO_LEVEL_CODE,
  DIM_BAR_PCT,
  DIM_BAR_COLOR,
};
