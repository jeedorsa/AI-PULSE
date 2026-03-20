
// ─────────────────────────────────────────────────────────────────
//  AI PULSE · v2.0 · 25 preguntas · ~12 minutos
// ─────────────────────────────────────────────────────────────────

// ── BLOQUE 1 — SOBRE TI Y TU ROL integrado en questions array (sección V · No puntúa) ──
// contextVariables eliminado — las preguntas V1-V4 están al inicio de questions[]
export const contextVariables: any[] = []; // mantenido por compatibilidad

// ── PREGUNTAS SCORED ──────────────────────────────────────────────
export const questions = [

  // ── BLOQUE 1 — SOBRE TI Y TU ROL (section: V · weight: 0 · No puntúa) ─────

  {
    id: 'V1',
    section: 'V',
    type: 'open',
    text: '¿En qué área de la organización trabajas?',
    placeholder: 'Ej: Marketing, Tecnología, Operaciones, Finanzas...'
  },

  {
    id: 'V2',
    section: 'V',
    type: 'mixed_scale',
    scaleText: '¿Cuál es tu nivel jerárquico actual?',
    scaleOptions: [
      { value: 1, label: 'Colaborador individual' },
      { value: 2, label: 'Manager o Líder de equipo' },
      { value: 3, label: 'Director' },
      { value: 4, label: 'VP o C-Suite' }
    ]
  },

  {
    id: 'V3',
    section: 'V',
    type: 'mixed_scale',
    scaleText: '¿Cuántos años llevas desempeñando tu rol actual?',
    scaleOptions: [
      { value: 1, label: 'Menos de 1 año' },
      { value: 2, label: '1 a 3 años' },
      { value: 3, label: '3 a 5 años' },
      { value: 4, label: 'Más de 5 años' }
    ]
  },

  {
    id: 'V4',
    section: 'V',
    type: 'mixed_multi',
    multiText: '¿Qué herramientas de IA generativa has utilizado al menos una vez?',
    multiOptions: ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Midjourney', 'Llama / Meta AI', 'Otra']
  },

  // ── SECCIÓN A — TU EXPERIENCIA REAL CON IA (weight: 0.30) ────────

  {
    id: 'E2',
    section: 'A',
    type: 'open',
    text: 'Pensando en el último entregable importante que produjiste — reporte, código, plan, presentación — ¿qué papel jugó la IA? Descríbeme exactamente cómo la usaste o por qué decidiste no usarla.',
    scoringSignals: {
      L1: 'No usó IA o la menciona solo de forma tangencial',
      L2: 'La usó para una parte pequeña, sin describir cómo',
      L3: 'Describe con detalle qué herramienta usó, para qué parte y qué resultado obtuvo',
      L4T: 'Integró IA en múltiples etapas del proceso con criterio claro',
      L4L: 'Documenta o comparte el proceso con su equipo como práctica replicable'
    }
  },

  {
    id: 'E3',
    section: 'A',
    type: 'mixed_scale',
    scaleText: 'Cuando la IA te da un resultado incorrecto, ¿cuál es tu reacción más frecuente?',
    scaleOptions: [
      { value: 1, letter: 'A', label: 'No lo noto' },
      { value: 2, letter: 'B', label: 'Repito la pregunta igual' },
      { value: 3, letter: 'C', label: 'Ajusto el prompt manualmente' },
      { value: 4, letter: 'D', label: 'Aplico un proceso sistemático de corrección' },
      { value: 5, letter: 'E', label: 'Comparto la lección con mi equipo' }
    ]
  },

  {
    id: 'E4',
    section: 'A',
    type: 'mixed_scale',
    scaleText: '¿Cómo usas la IA ante un tema desconocido fuera de tu especialidad?',
    scaleOptions: [
      { value: 1, letter: 'A', label: 'No la uso' },
      { value: 2, letter: 'B', label: 'Busco definiciones rápidas' },
      { value: 3, letter: 'C', label: 'Pido analogías y explicaciones adaptadas a mi contexto' },
      { value: 4, letter: 'D', label: 'Diseño un plan de estudio y genero casos prácticos con la IA' }
    ]
  },

  {
    id: 'E5',
    section: 'A',
    type: 'open',
    text: '¿Qué has enseñado o compartido sobre IA dentro de tu empresa? Cuéntame el caso más reciente.\n\nSi aún no lo has hecho, puedes decirlo — también es información valiosa.',
    scoringSignals: {
      L1: 'No ha compartido nada, no lo ve como parte de su rol',
      L2: 'Compartió algo puntual de forma espontánea sin intención de enseñar',
      L3: 'Enseñó una técnica o resolvió dudas de forma recurrente',
      L4T: 'Creó recursos reutilizables o lideró un proceso de adopción formal',
      L4L: 'Propuso políticas, cambió dinámicas del equipo o escaló la práctica a nivel organizacional'
    }
  },

  // ── SECCIÓN B — CRITERIO Y CAPACIDADES TÉCNICAS (weight: 0.30) ───

  {
    id: 'B1',
    section: 'B',
    type: 'mixed_scale',
    concept: 'VERIFICACIÓN',
    scaleText: '¿Cómo verificas que un dato técnico que te dio la IA es correcto?',
    scaleOptions: [
      { value: 1, letter: 'A', label: 'Confío si suena bien' },
      { value: 2, letter: 'B', label: 'Hago una búsqueda rápida en Google' },
      { value: 3, letter: 'C', label: 'Tengo un método sistemático de verificación cruzada con fuentes primarias' }
    ]
  },

  {
    id: 'B2',
    section: 'B',
    type: 'open',
    concept: 'SEGURIDAD DE DATOS',
    text: '¿Qué tipo de información corporativa evitas compartir con la IA y por qué razones de seguridad lo haces? Dame ejemplos concretos.',
    scoringSignals: {
      L1: 'No ha pensado en eso o dice que no hay problema en compartir todo',
      L2: 'Evita datos obvios como contraseñas, sin criterio más amplio',
      L3: 'Describe categorías concretas que protege y adapta el uso según el contexto y la herramienta',
      L4T: 'Tiene criterio sistemático por herramienta, conoce políticas de privacidad de las plataformas que usa',
      L4L: 'Ha propuesto o implementado criterios de seguridad para su equipo u organización'
    }
  },

  {
    id: 'B3',
    section: 'B',
    type: 'mixed_multi',
    concept: 'CASOS DE USO',
    multiText: '¿Para qué has usado IA este mes? Selecciona todos los que apliquen.',
    multiOptions: [
      'Búsqueda de información',
      'Redacción de borradores',
      'Revisión y edición de textos',
      'Gestión de email',
      'Análisis de datos',
      'Pensamiento estratégico',
      'Resumen de documentos',
      'Notas y resúmenes de reuniones',
      'Aprendizaje de nuevos temas',
      'Automatización de tareas',
      'Programación / código',
      'Diseño o contenido visual',
      'Traducción',
      'Atención a clientes'
    ]
  },

  {
    id: 'B4',
    section: 'B',
    type: 'mixed_multi',
    concept: 'MULTIMODALIDAD',
    multiText: '¿Qué tipos de archivos has analizado con IA además de texto? Selecciona todos los que apliquen.',
    multiOptions: [
      'Solo texto / ninguno',
      'Imágenes o fotos',
      'Documentos PDF o Word',
      'Hojas de cálculo (Excel, CSV)',
      'Audio o transcripciones',
      'Video'
    ],
    openText: 'Cuéntame un ejemplo concreto: ¿qué analizaste y qué resultado obtuviste?',
    scoringSignals: {
      L1L2: 'Solo marca texto/ninguno o no tiene ejemplo concreto',
      L3: 'Describe caso específico donde combinó formatos con resultado útil',
      L4T: 'Combina múltiples modalidades estratégicamente según el caso de uso',
      L4L: 'Ha identificado y compartido casos de uso multimodales con su equipo'
    }
  },

  {
    id: 'B5',
    section: 'B',
    type: 'open',
    concept: 'AUTOMATIZACIÓN',
    text: '¿Qué tarea repetitiva has logrado delegar total o parcialmente a la IA? Descríbela y cuéntame qué tan lejos llegaste en ese intento — y si no lo has logrado, ¿qué te ha frenado?',
    scoringSignals: {
      L1L2: 'No identifica tareas repetitivas o no ve conexión con IA',
      L2: 'Identifica tareas pero nunca ha intentado automatizar nada',
      L3: 'Ha intentado automatizar algo, aunque sea parcialmente, y nombra herramientas específicas',
      L4T: 'Tiene flujos funcionando con conexión entre herramientas; describe el proceso con detalle técnico',
      L4L: 'Diseña flujos pensando en que otros los puedan replicar o usar'
    }
  },

  {
    id: 'B6',
    section: 'B',
    type: 'open',
    concept: 'RAG Y CONTEXTO',
    text: '¿Has logrado que la IA trabaje con información específica de tu empresa — documentos internos, bases de datos, manuales, reportes — en lugar de depender solo de su conocimiento general? Cuéntame cómo lo hiciste.',
    scoringSignals: {
      L1L2: 'No entiende la diferencia entre conocimiento general y específico de la empresa',
      L2L3: 'Ha pegado texto o documentos manualmente de forma puntual sin sistema',
      L3: 'Usa documentos propios como contexto de forma sistemática',
      L4T: 'Ha construido o propuesto sistemas donde la IA consulta bases de conocimiento organizacional',
      L4L: 'Ha liderado la creación de repositorios de conocimiento conectados a IA para su equipo'
    }
  },

  // ── SECCIÓN C — LABORATORIO DE EJECUCIÓN (weight: 0.40) ──────────

  {
    id: 'C1',
    section: 'C',
    type: 'prompt_input',
    text: 'Escribe el prompt para pedirle a la IA que redacte un email informando a un cliente VIP que su proyecto tendrá un retraso de 3 semanas.',
    scenarioText: 'Un cliente VIP acaba de enterarse de que su proyecto se entregará con tres semanas de retraso. Necesitas comunicarlo de forma que preserve la relación comercial.',
    rubric: {
      L1L2: 'Prompt de una línea sin contexto. Ej: "ayúdame a escribir un email de malas noticias"',
      L2: 'Agrega contexto básico — cliente, retraso, motivo — sin estructura clara',
      L3: 'Define tono, audiencia, objetivo y formato esperado de forma estructurada',
      L4T: 'Asigna rol experto, define restricciones, especifica longitud y tono con criterio',
      L4L: 'Prompt parametrizable y reutilizable para cualquier situación similar de comunicación de crisis'
    }
  },

  {
    id: 'C2',
    section: 'C',
    type: 'prompt_input',
    text: 'Mejora este prompt que usó alguien de tu equipo y no dio buenos resultados. Escribe una versión que sí funcione.',
    scenarioText: 'Un miembro de tu equipo usó este prompt y los resultados fueron inútiles. Tu tarea es reescribirlo para que produzca un output realmente aprovechable.',
    originalPrompt: 'Necesito una presentación de resultados para mi jefe, no fueron buenos, que sea profesional y corta',
    rubric: {
      L1L2: 'Versión mejorada es marginalmente diferente al original',
      L2: 'Separa las ideas o agrega algo de contexto pero sin estructura clara',
      L3: 'Reestructura completamente: agrega contexto de negocio, audiencia, objetivo y formato esperado',
      L4T: 'Además asigna rol, define restricciones y especifica el output con precisión',
      L4L: 'Prompt mejorado es parametrizable y demuestra un sistema consciente de construcción'
    }
  },

  {
    id: 'C3',
    section: 'C',
    type: 'prompt_input',
    text: 'Escribe un prompt para que la IA te ayude a decidir si lanzar un producto nuevo este año o esperar — obligándola a mostrarte su razonamiento paso a paso antes de concluir.',
    scenarioText: 'Necesitas tomar una decisión estratégica: lanzar un producto nuevo este año o esperar. Quieres que la IA te ayude a razonar, no solo a darte una respuesta.',
    rubric: {
      L1L2: 'Pregunta directa sin pedir razonamiento. Ej: "¿debería lanzar mi producto este año?"',
      L2: 'Pide recomendación con algunos criterios pero sin estructura de razonamiento explícita',
      L3: 'El prompt pide explícitamente analizar factores específicos antes de concluir',
      L4T: 'Usa framing como "piensa paso a paso", "antes de responder considera X luego Y", cadena de razonamiento',
      L4L: 'Prompt diseñado como framework de decisión reutilizable para cualquier decisión estratégica futura'
    }
  },

  // ── SECCIÓN D — CULTURA, IMPACTO Y FUTURO (weight: 0 · Reporte org.) ──

  {
    id: 'D1',
    section: 'D',
    type: 'mixed_scale',
    scaleText: '¿En qué medida tu jefe directo o tu empresa apoya activamente el uso de IA?',
    scaleOptions: [
      { value: 1, label: 'Nunca ha habido ningún incentivo o mención' },
      { value: 2, label: 'Ha habido menciones generales pero sin acciones concretas' },
      { value: 3, label: 'He recibido recursos, herramientas o tiempo específico para explorarla' },
      { value: 4, label: 'Existe una estrategia clara con liderazgo visible y seguimiento' }
    ],
    openText: 'Cuéntame un ejemplo concreto de cómo se ha manifestado ese apoyo — o por qué sientes que no ha pasado.'
  },

  {
    id: 'D2',
    section: 'D',
    type: 'open',
    text: '¿Has sentido alguna vez que usar IA en tu trabajo era mal visto, generaba desconfianza, o te ponía en una posición incómoda con alguien de tu equipo o empresa? Cuéntame qué pasó.'
  },

  {
    id: 'D3',
    section: 'D',
    type: 'mixed_dynamic',
    multiText: '¿Qué herramientas de IA usas actualmente en tu trabajo, dentro y fuera de las que te da la empresa? Selecciona todas las que apliquen.',
    multiOptions: [
      'ChatGPT',
      'Claude',
      'Gemini',
      'Copilot',
      'Perplexity',
      'Midjourney u otra IA de imágenes',
      'IA integrada en herramientas que ya uso (Notion, Canva, Excel, etc.)',
      'Otra — ¿cuál?'
    ],
    dynamicTable: true,
    tableLabel: 'De las herramientas que seleccionaste, indica su origen.',
    tableOptions: ['Me la da la empresa', 'La uso por cuenta propia', 'Ambas']
  },

  {
    id: 'D4',
    section: 'D',
    type: 'open',
    text: '¿Hay alguna herramienta de IA que necesitas para tu trabajo y no tienes acceso? ¿Qué impacto tiene eso en tu día a día?'
  },

  {
    id: 'D5',
    section: 'D',
    type: 'mixed_conditional',
    closedText: '¿Existen espacios oficiales en tu empresa para compartir prompts, aprendizajes o casos de uso de IA?',
    closedOptions: [
      { value: 'yes_active', label: 'Sí, existe y lo uso activamente' },
      { value: 'yes_inactive', label: 'Sí, existe pero no está activo o no lo uso' },
      { value: 'no', label: 'No existe nada parecido' },
      { value: 'unknown', label: 'No sé si existe' }
    ],
    conditionalText: 'Descríbeme cómo es ese espacio y qué tipo de contenido encuentras ahí.',
    conditionalIf: ['yes_active', 'yes_inactive']
  },

  {
    id: 'D6',
    section: 'D',
    type: 'open',
    text: '¿Conoces las políticas de uso responsable de IA de tu empresa? Si existen, ¿qué dicen y cómo las aplicas en tu trabajo?',
    note: 'Detecta existencia de AI Manifiesto / AI Policy. Oportunidad directa de consultoría si no existe.'
  },

  {
    id: 'D7',
    section: 'D',
    type: 'open',
    text: 'Más allá de lo que tu empresa te pide, ¿alguna vez decidiste NO usar IA por razones éticas o de principios propios? Cuéntame qué pasó.'
  },

  {
    id: 'D9',
    section: 'D',
    type: 'mixed_scale',
    scaleText: '¿Cómo ves el futuro de tu rol con la llegada de la IA?',
    scaleOptions: [
      { value: 1, letter: 'A', label: 'Me genera incertidumbre o preocupación' },
      { value: 2, letter: 'B', label: 'Tengo curiosidad pero no sé cómo afectará mi trabajo' },
      { value: 3, letter: 'C', label: 'Lo veo como una oportunidad clara de crecimiento' },
      { value: 4, letter: 'D', label: 'La IA ya es central en cómo me desarrollo profesionalmente' }
    ]
  }

];
