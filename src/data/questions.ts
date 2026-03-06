
export const contextVariables = [
  {
    id: 'V1',
    type: 'open',
    text: 'Área o departamento',
    placeholder: 'Ej: Marketing, Tecnología, Operaciones...'
  },
  {
    id: 'V2',
    type: 'single_choice',
    text: 'Nivel en la organización',
    options: ['Colaborador individual', 'Manager o Líder de equipo', 'Director', 'VP o C-Suite']
  },
  {
    id: 'V3',
    type: 'single_choice',
    text: 'Años en la empresa',
    options: ['Menos de 1 año', '1 a 3 años', '3 a 5 años', 'Más de 5 años']
  },
  {
    id: 'V4',
    type: 'single_choice',
    text: '¿Con qué frecuencia usas IA en tu trabajo?',
    options: [
      'Nunca o casi nunca',
      'Una o dos veces por semana',
      'Todos los días',
      'Varias veces al día — es parte central de mi flujo de trabajo'
    ]
  }
];

export const questions = [
  // ─── SECCIÓN A — ESCENARIOS DE USO (weight: 0.40) ────────────────
  {
    id: 'E1', section: 'A', type: 'open',
    text: 'Imagina que tu jefe te pide resolver un problema que nunca has enfrentado antes y tienes 24 horas. Descríbeme paso a paso exactamente qué harías desde el momento en que recibes esa tarea. Sé lo más específico posible.',
    scoringSignals: {
      L1: 'No menciona IA en ningún momento',
      L2: 'Menciona IA pero como búsqueda de información, igual que Google',
      L3: 'Describe un prompt específico que usaría, menciona contexto o rol que le daría a la IA',
      L4T: 'Menciona iteración, refinamiento, combinación de herramientas o automatización',
      L4L: 'Menciona además cómo documentaría o compartiría el proceso con su equipo'
    }
  },
  {
    id: 'E2', section: 'A', type: 'mixed_scale',
    scaleText: 'Pensando en el último entregable importante que produjiste en tu trabajo, ¿qué papel jugó la IA en ese proceso?',
    scaleOptions: [
      { value: 1, label: 'No usé IA' },
      { value: 2, label: 'La usé puntualmente para una parte pequeña' },
      { value: 3, label: 'La usé en varias etapas del proceso' },
      { value: 5, label: 'Fue una parte central y estructural de cómo lo construí' }
    ],
    openText: 'Descríbeme exactamente cómo la usaste — o por qué no la usaste.'
  },
  {
    id: 'E3', section: 'A', type: 'open',
    text: 'Cuéntame de una situación en la que la IA te dio un resultado que no era lo que necesitabas. ¿Qué hiciste exactamente para resolver eso?',
    scoringSignals: {
      L1: 'No recuerda ningún caso o dice que la IA siempre le funciona',
      L2: 'Reformuló la pregunta de forma intuitiva sin método claro',
      L3: 'Describe cambios específicos al prompt: contexto, rol, formato, ejemplos',
      L4T: 'Describe proceso sistemático: identifica por qué falló, aplica técnica, evalúa resultado',
      L4L: 'Documentó lo que funcionó, creó plantilla o lo enseñó a alguien'
    }
  },
  {
    id: 'E4', section: 'A', type: 'open',
    text: 'Piensa en la última vez que tuviste que entender un tema que estaba fuera de tu área de conocimiento — algo técnico, legal, financiero, o simplemente desconocido para ti. ¿Cómo lo abordaste y qué papel jugó la IA en ese proceso?',
    scoringSignals: {
      L1L2: 'No usó IA o buscó una definición puntual',
      L3: 'Describe conversación con IA pidiendo explicaciones o analogías adaptadas a su contexto',
      L4T: 'Describe proceso estructurado: pidió evaluación de comprensión, generó casos prácticos, conectó con su trabajo',
      L4L: 'Compartió lo aprendido o creó un recurso a partir del proceso'
    }
  },
  {
    id: 'E5', section: 'A', type: 'open',
    text: '¿Has influido alguna vez en cómo alguien de tu entorno laboral usa la IA — un colega, tu equipo, o incluso tu jefe? Cuéntame qué pasó exactamente y qué resultado tuvo.',
    scoringSignals: {
      L2L3: 'Nunca ha influido o cada quien aprende solo',
      L3: 'Compartió un prompt o herramienta útil de forma espontánea y puntual',
      L4T: 'Enseñó una técnica, armó tutorial informal o resolvió dudas recurrentes',
      L4L: 'Lideró proceso de adopción, creó recursos reutilizables, propuso políticas o cambió la forma de trabajo del equipo'
    }
  },

  // ─── SECCIÓN B — CONOCIMIENTO TÉCNICO (weight: 0.25) ─────────────
  {
    id: 'B1', section: 'B', type: 'open', concept: 'ALUCINACIONES',
    text: '¿Has recibido alguna vez información de una IA que parecía correcta pero resultó ser falsa o inventada? Cuéntame qué pasó y cómo lo manejaste. Si nunca te ha pasado, ¿cómo verificas que lo que te da la IA es confiable?',
    scoringSignals: {
      L1: 'Nunca le ha pasado y no tiene proceso de verificación',
      L2: 'Reconoce que puede pasar pero confía mayormente sin verificar sistemáticamente',
      L3: 'Describe caso concreto y verifica en fuentes externas antes de usar la información',
      L4T: 'Tiene criterio claro sobre qué verifica siempre, cuáles no y por qué — gestiona el riesgo de forma consciente',
      L4L: 'Además ha comunicado o enseñado a otros en su equipo cómo gestionar este riesgo'
    }
  },
  {
    id: 'B2', section: 'B', type: 'open', concept: 'SEGURIDAD DE DATOS',
    text: 'Cuando usas IA en tu trabajo, ¿qué tipo de información evitas incluir en tus conversaciones y por qué? Dame ejemplos concretos de situaciones donde tuviste que pensar dos veces antes de compartir algo con la IA.',
    scoringSignals: {
      L1: 'Nunca ha pensado en eso o no ve ningún riesgo en lo que comparte',
      L2: 'Evita datos obvios como contraseñas pero sin criterio más amplio',
      L3: 'Describe categorías concretas que protege y adapta uso según contexto',
      L4T: 'Tiene criterio sistemático por herramienta, conoce políticas de privacidad de las herramientas que usa',
      L4L: 'Ha propuesto o implementado criterios de seguridad para su equipo'
    }
  },
  {
    id: 'B3', section: 'B', type: 'open', concept: 'VENTANA DE CONTEXTO',
    text: '¿Alguna vez has notado que la IA olvida lo que le dijiste al inicio de una conversación larga, o te da respuestas inconsistentes después de varios intercambios? ¿Qué haces cuando eso pasa?',
    scoringSignals: {
      L1L2: 'Nunca lo ha notado o lo atribuye a un error aleatorio sin explicación',
      L2: 'Lo ha notado pero repite la pregunta sin entender por qué pasa',
      L3: 'Entiende el límite y gestiona activamente: resume contexto, divide tareas, empieza conversaciones frescas',
      L4T: 'Diseña conversaciones anticipando la limitación desde el inicio con documentos de contexto o prompts de sistema',
      L4L: 'Ha incorporado esto en flujos compartidos o enseñado a su equipo'
    }
  },
  {
    id: 'B4', section: 'B', type: 'mixed_multi', concept: 'MULTIMODALIDAD',
    multiText: '¿Qué tipos de archivos o formatos has usado en tus conversaciones con IA? Selecciona todos los que apliquen.',
    multiOptions: ['Solo texto', 'Imágenes o fotos', 'Documentos PDF o Word', 'Hojas de cálculo', 'Audio o video', 'Ninguno de los anteriores'],
    openText: 'Cuéntame un ejemplo concreto de cómo usaste alguno de esos formatos y qué resultado obtuviste.',
    scoringSignals: {
      L1L2: 'Solo marca texto o ninguno en la selección múltiple',
      L2: 'Marca otros formatos pero no tiene ejemplo concreto de uso real',
      L3: 'Describe caso específico donde combinó formatos con resultado útil',
      L4T: 'Combina múltiples modalidades estratégicamente según el caso de uso',
      L4L: 'Ha identificado y compartido casos de uso multimodales con su equipo'
    }
  },
  {
    id: 'B5', section: 'B', type: 'open', concept: 'AUTOMATIZACIÓN',
    text: '¿Hay alguna tarea repetitiva en tu trabajo que hayas intentado delegar total o parcialmente a la IA? Descríbela y cuéntame qué tan lejos llegaste en ese intento — y si no lo has logrado, qué te ha frenado.',
    scoringSignals: {
      L1L2: 'No identifica tareas repetitivas o no ve conexión con IA',
      L2: 'Identifica tareas pero nunca ha intentado automatizar nada, las barreras son de conocimiento',
      L3: 'Ha intentado automatizar algo aunque sea parcialmente, puede nombrar herramientas específicas',
      L4T: 'Ha conectado herramientas y tiene flujos funcionando, describe el proceso con detalle técnico',
      L4L: 'Diseña estos flujos pensando en que otros los puedan usar o replicar'
    }
  },
  {
    id: 'B6', section: 'B', type: 'open', concept: 'RAG Y CONTEXTO EXTERNO',
    text: '¿Has logrado alguna vez que la IA trabaje con información específica de tu empresa — documentos internos, bases de datos, manuales, reportes — en lugar de depender solo de su conocimiento general? Cuéntame cómo lo hiciste.',
    scoringSignals: {
      L1L2: 'No entiende la diferencia entre conocimiento general y específico de la empresa',
      L2L3: 'Ha pegado texto o documentos manualmente sin sistema estructurado',
      L3: 'Usa documentos propios como contexto de forma sistemática',
      L4T: 'Ha construido o propuesto sistemas donde la IA consulta bases de conocimiento organizacional',
      L4L: 'Ha liderado la creación de repositorios de conocimiento conectados a IA para su equipo'
    }
  },

  // ─── SECCIÓN C — HABILIDADES DE PROMPTING (weight: 0.35) ─────────
  {
    id: 'C1', section: 'C', type: 'prompt_input',
    text: 'Escribe el prompt que usarías para pedirle a la IA que te ayude a redactar un email para comunicarle a un cliente importante que su proyecto se va a entregar con tres semanas de retraso.',
    scenarioText: 'Un cliente importante acaba de enterarse de que su proyecto se entregará con tres semanas de retraso. Necesitas comunicarlo de forma que preserve la relación comercial.',
    rubric: {
      L1L2: 'Prompt de una línea sin contexto. Ej: "ayúdame a escribir un email de malas noticias"',
      L2: 'Agrega contexto básico — cliente, retraso, motivo — sin estructura clara',
      L3: 'Define tono, audiencia, objetivo y formato esperado de forma estructurada',
      L4T: 'Asigna rol experto, define restricciones, especifica longitud y tono con criterio',
      L4L: 'Prompt parametrizable y reutilizable para cualquier situación similar'
    }
  },
  {
    id: 'C2', section: 'C', type: 'prompt_input',
    text: 'Escribe un prompt para pedirle a la IA que analice por qué las ventas de tu equipo bajaron un 20% el último trimestre y que te proponga tres acciones concretas para revertirlo. Intenta darle toda la información que creas que necesita.',
    scenarioText: 'Las ventas de tu equipo bajaron un 20% el último trimestre. Necesitas entender por qué y obtener acciones concretas para revertirlo.',
    rubric: {
      L1L2: 'Repite el enunciado sin agregar información. Ej: "analiza por qué bajaron mis ventas"',
      L2: 'Agrega algo de contexto pero de forma desordenada o incompleta',
      L3: 'Estructura el contexto con información relevante: sector, equipo, posibles causas, datos disponibles',
      L4T: 'Asigna rol, define formato de las recomendaciones, establece criterios de priorización',
      L4L: 'Prompt diseñado como framework reutilizable para cualquier ciclo de análisis de resultados'
    }
  },
  {
    id: 'C3', section: 'C', type: 'prompt_input',
    text: 'Este prompt que usó alguien de tu equipo no dio buenos resultados. Escribe una versión mejorada:\n\n"Necesito una presentación de resultados del trimestre para mi jefe, que no fueron buenos, quiero que sea convincente y profesional pero corta, con algo visual"',
    scenarioText: 'Un miembro de tu equipo usó este prompt y los resultados no fueron útiles. Tu tarea es reescribirlo para que funcione mejor.',
    originalPrompt: 'Necesito una presentación de resultados del trimestre para mi jefe, que no fueron buenos, quiero que sea convincente y profesional pero corta, con algo visual',
    rubric: {
      L1L2: 'Versión mejorada es marginalmente diferente al original',
      L2: 'Separa las ideas o agrega algo de contexto pero sin estructura clara',
      L3: 'Reestructura completamente: agrega contexto de negocio, audiencia, objetivo y formato',
      L4T: 'Además asigna rol, define restricciones y especifica el output con precisión',
      L4L: 'Prompt mejorado es parametrizable y demuestra sistema consciente de construcción'
    }
  },
  {
    id: 'C4', section: 'C', type: 'prompt_input',
    text: 'Escribe un prompt para pedirle a la IA que te ayude a decidir si tu empresa debería lanzar un producto nuevo al mercado este año o esperar. Ten en cuenta que necesitas entender el razonamiento, no solo la respuesta.',
    scenarioText: 'Necesitas tomar una decisión estratégica: lanzar un producto nuevo este año o esperar. Quieres que la IA te ayude a razonar, no solo a responder.',
    rubric: {
      L1L2: 'Pregunta directa sin pedir razonamiento. Ej: "¿debería lanzar mi producto este año?"',
      L2: 'Pide recomendación con algunos criterios pero sin estructura de razonamiento',
      L3: 'El prompt pide explícitamente que la IA analice factores específicos antes de concluir',
      L4T: 'Usa frases como "piensa paso a paso", "antes de responder considera", "analiza primero X luego Y"',
      L4L: 'Prompt diseñado como framework de decisión reutilizable para decisiones similares futuras'
    }
  },
  {
    id: 'C5', section: 'C', type: 'narrative',
    text: '¿Qué haces con un prompt que te funcionó muy bien? Cuéntame cómo lo guardas, lo organizas o lo compartes — o qué pasa con él después de usarlo.',
    scoringSignals: {
      L1L2: 'No hace nada, cada vez construye desde cero',
      L2: 'Lo recuerda mentalmente o lo deja en el historial del chat sin sistema claro',
      L3: 'Lo guarda en algún lugar personal: notas, documento, carpeta',
      L4T: 'Tiene un sistema organizado: biblioteca personal, plantillas categorizadas, variables reutilizables',
      L4L: 'Comparte sus mejores prompts con su equipo o contribuye a una biblioteca colectiva'
    }
  },

  // ─── SECCIÓN D — DIMENSIÓN ORGANIZACIONAL (weight: 0 — no clasifica) ─
  {
    id: 'D1', section: 'D', type: 'mixed_scale',
    scaleText: '¿En qué medida tu empresa o jefe directo te ha apoyado activamente en el uso de IA?',
    scaleOptions: [
      { value: 1, label: 'Nunca ha habido ningún incentivo o mención' },
      { value: 2, label: 'Ha habido menciones generales pero sin acciones concretas' },
      { value: 3, label: 'He recibido recursos, herramientas o tiempo específico para explorarla' },
      { value: 4, label: 'Existe una estrategia clara con liderazgo visible y seguimiento' }
    ],
    openText: 'Cuéntame un ejemplo concreto de cómo se ha manifestado ese apoyo — o por qué sientes que no ha pasado.'
  },
  {
    id: 'D2', section: 'D', type: 'open',
    text: '¿Has sentido alguna vez que usar IA en tu trabajo era mal visto, generaba desconfianza o te ponía en una posición incómoda con alguien de tu equipo o empresa? Cuéntame qué pasó.'
  },
  {
    id: 'D3', section: 'D', type: 'mixed_dynamic',
    multiText: '¿Cuáles de estas herramientas de IA usas actualmente en tu trabajo, dentro y fuera de las que te da la empresa? Selecciona todas las que apliquen.',
    multiOptions: ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Perplexity', 'Midjourney u otra IA de imágenes', 'IA integrada en herramientas que ya uso (Notion, Canva, Excel, etc.)', 'Otra — ¿cuál?'],
    dynamicTable: true,
    tableLabel: 'De las herramientas que seleccionaste, indica cuál es su origen.',
    tableOptions: ['Me la da la empresa', 'La uso por cuenta propia', 'Ambas']
  },
  {
    id: 'D4', section: 'D', type: 'open',
    text: '¿Hay alguna herramienta de IA que necesitas para tu trabajo y no tienes acceso? ¿Qué impacto tiene eso en tu día a día?'
  },
  {
    id: 'D5', section: 'D', type: 'mixed_conditional',
    closedText: '¿Existe en tu empresa algún espacio donde se compartan prompts, casos de uso o aprendizajes sobre IA?',
    closedOptions: [
      { value: 'yes_active', label: 'Sí, existe y lo uso activamente' },
      { value: 'yes_inactive', label: 'Sí, existe pero no lo uso o no está activo' },
      { value: 'no', label: 'No existe nada parecido' },
      { value: 'unknown', label: 'No sé si existe' }
    ],
    conditionalText: 'Descríbeme cómo es ese espacio y qué tipo de contenido encuentras ahí.',
    conditionalIf: ['yes_active', 'yes_inactive']
  },
  {
    id: 'D6', section: 'D', type: 'open',
    text: '¿Cómo aprendes cosas nuevas sobre IA para tu trabajo? ¿Ese aprendizaje lo haces solo o hay algo en tu empresa que te ayude a hacerlo?'
  },
  {
    id: 'D7', section: 'D', type: 'open',
    text: '¿Tu empresa tiene algún documento, guía o declaración de principios que defina cómo, cuándo y para qué usar la IA responsablemente? Si existe, ¿qué dice y cómo lo aplicas en tu trabajo?',
    note: 'Detecta existencia de AI Manifiesto. Si el empleado no conoce ningún documento de este tipo, es oportunidad directa de consultoría.'
  },
  {
    id: 'D8', section: 'D', type: 'open',
    text: 'Más allá de lo que tu empresa te pide, ¿hay alguna situación en la que tú mismo hayas decidido no usar IA por razones éticas o de principios? Cuéntame qué pasó.'
  },

  // ─── GAPS RESUELTOS — G1 y G2 ────────────────────────────────────
  {
    id: 'G1', section: 'GAPS', type: 'mixed_scale',
    scaleText: '¿En qué medida el uso de IA ha impactado tu productividad o la calidad de tu trabajo?',
    scaleOptions: [
      { value: 1, label: 'No ha cambiado nada' },
      { value: 2, label: 'Ha mejorado algo pero de forma marginal' },
      { value: 3, label: 'Ha mejorado de forma notable' },
      { value: 4, label: 'Ha transformado la manera en que trabajo' }
    ],
    openText: 'Dame un ejemplo concreto de ese impacto — qué cambió, cuánto tiempo ahorras, o qué resultado obtuviste que antes no podías.'
  },
  {
    id: 'G2', section: 'GAPS', type: 'mixed_scale',
    scaleText: '¿Cómo describes tu relación con la IA en el contexto de tu trabajo?',
    scaleOptions: [
      { value: 1, label: 'Me genera incertidumbre o preocupación' },
      { value: 2, label: 'La acepto pero no la veo como algo prioritario' },
      { value: 3, label: 'La veo como una herramienta útil que quiero dominar' },
      { value: 4, label: 'Es parte central de cómo me desarrollo profesionalmente' }
    ],
    openText: '¿Qué te frena o qué te impulsa a usar más IA en tu trabajo?'
  }
];
