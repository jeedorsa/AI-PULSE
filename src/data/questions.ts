
// ─────────────────────────────────────────────────────────────────
//  AI PULSE · Inchcape v1.0 · Assessment
// ─────────────────────────────────────────────────────────────────

export const contextVariables: any[] = []; // mantenido por compatibilidad

export const questions = [

  // ── BLOQUE 0 — TU PUNTO DE PARTIDA (section: V · weight: 0 · No puntúa) ──
  // "Esto nos ayuda a personalizar tu experiencia — no hay respuestas correctas ni incorrectas"

  {
    id: 'V1',
    section: 'V',
    type: 'mixed_scale',
    scaleText: '¿Cómo describirías tu relación con la IA hoy?',
    scaleOptions: [
      { value: 1, label: 'Aún no la he usado ni explorado' },
      { value: 2, label: 'La he probado pero no le he encontrado utilidad real en mi trabajo' },
      { value: 3, label: 'La uso de vez en cuando para tareas puntuales' },
      { value: 4, label: 'La uso regularmente y forma parte de cómo trabajo' }
    ]
  },

  {
    id: 'V2',
    section: 'V',
    type: 'mixed_multi',
    multiText: '¿Qué herramientas de IA has explorado, aunque sea por curiosidad personal? (marca todas las que apliquen)',
    multiOptions: [
      'ChatGPT (OpenAI)',
      'Microsoft Copilot',
      'Gemini (Google)',
      'Claude (Anthropic)',
      'Herramientas de imagen con IA (Midjourney, DALL-E, Canva IA)',
      'Herramientas de voz o video con IA (ElevenLabs, Runway, HeyGen)',
      'Herramientas de automatización con IA (Make, Zapier)',
      'Ninguna todavía',
      'Otra'
    ]
  },

  {
    id: 'V3',
    section: 'V',
    type: 'mixed_multi',
    multiText: '¿Qué te ha frenado para usar más la IA en tu trabajo? (puedes marcar varias)',
    multiOptions: [
      'No sé por dónde empezar ni qué herramientas usar',
      'La he probado pero no le veo una aplicación clara en lo que hago día a día',
      'Me preocupa compartir información de la empresa o de clientes',
      'Tengo miedo de cometer errores o de usarla mal',
      'No he tenido el espacio ni el permiso para explorarla en el trabajo',
      'En mi rol no creo que sea relevante todavía',
      'Nada me ha frenado — ya la uso con regularidad'
    ]
  },

  {
    id: 'V4',
    section: 'V',
    type: 'mixed_multi',
    max: 2,
    multiText: 'La IA tiene 5 superpoderes. ¿En cuáles te gustaría enfocarte más en tu trabajo? (elige hasta 2)',
    multiOptions: [
      'CREATE — generar contenido, textos e imágenes',
      'ANALYZE — interpretar datos y entender tendencias',
      'STRATEGIZE — tomar mejores decisiones y planificar',
      'RESEARCH — buscar y sintetizar información rápidamente',
      'AUTOMATE — eliminar tareas repetitivas y optimizar procesos'
    ]
  },

  // ── SECCIÓN A — TU EXPERIENCIA REAL CON IA (weight: 0.30) ────────

  {
    id: 'E2',
    section: 'A',
    type: 'open',
    text: 'Pensando en el último entregable importante que produjiste — reporte, diagnóstico, cotización, plan, presentación — ¿qué papel jugó la IA? Descríbeme exactamente cómo la usaste o por qué decidiste no usarla.',
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
    type: 'open',
    text: 'Cuando la IA te da un resultado incorrecto o que no era lo que esperabas, ¿qué haces exactamente?',
    scoringSignals: {
      L1: 'No lo nota o no sabe qué hacer',
      L2: 'Repite la pregunta igual o abandona',
      L3: 'Ajusta el prompt de forma intuitiva',
      L4T: 'Aplica un proceso sistemático de corrección',
      L4L: 'Comparte la lección con su equipo'
    }
  },

  {
    id: 'E5',
    section: 'A',
    type: 'open',
    text: '¿Has compartido algo relacionado con IA con algún compañero o equipo? Puede ser cualquier cosa — un truco que descubriste, un resultado que te sorprendió, una herramienta que probaste, o simplemente mostrarle a alguien cómo usarla. Cuéntame el caso más reciente.\n\nSi aún no lo has hecho, puedes decirlo — también es información valiosa.',
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
    scaleText: 'Cuando la IA te da un dato, cifra o información importante, ¿cómo decides si puedes confiar en ella?',
    scaleOptions: [
      { value: 1, label: 'La acepto si suena lógica o coherente con lo que sé' },
      { value: 2, label: 'La busco en Google u otra fuente que tengo a mano' },
      { value: 3, label: 'Verifico cuando voy a usarlo para tomar una decisión o compartirlo' },
      { value: 4, label: 'La contrasto siempre con una fuente confiable antes de usarla' },
      { value: 5, label: 'Generalmente la uso sin verificar, no siempre sé cómo hacerlo' }
    ]
  },

  {
    id: 'B2',
    section: 'B',
    type: 'open',
    concept: 'SEGURIDAD DE DATOS',
    text: '¿Qué tipo de información de tu trabajo NO le compartirías a una herramienta de IA, y por qué?',
    scoringSignals: {
      L1: 'No ha pensado en eso o dice que no hay problema en compartir todo',
      L2: 'Evita datos obvios como contraseñas, sin criterio más amplio',
      L3: 'Describe categorías concretas que protege y adapta el uso según el contexto y la herramienta',
      L4T: 'Tiene criterio sistemático por herramienta, conoce políticas de privacidad de las plataformas que usa',
      L4L: 'Ha propuesto o implementado criterios de seguridad para su equipo u organización'
    }
  },

  {
    id: 'B4',
    section: 'B',
    type: 'open',
    concept: 'MULTIMODALIDAD',
    text: '¿Has usado alguna vez la IA con algo que no sea texto — una imagen, un audio, un documento, una foto? Cuéntame qué hiciste.',
    scoringSignals: {
      L1L2: 'No ha usado más allá del texto o no tiene ejemplo concreto',
      L3: 'Describe caso específico donde combinó formatos con resultado útil',
      L4T: 'Combina múltiples modalidades estratégicamente según el caso de uso',
      L4L: 'Ha identificado y compartido casos de uso multimodales con su equipo'
    }
  },

  // ── SECCIÓN C — LABORATORIO DE EJECUCIÓN (weight: 0.40) ──────────

  {
    id: 'C1',
    section: 'C',
    type: 'prompt_input',
    text: 'Escribe el prompt para pedirle a la IA que redacte un mensaje para un cliente importante informándole que su vehículo tendrá un retraso de 3 semanas.',
    scenarioText: 'Un cliente importante acaba de enterarse de que su vehículo se entregará con tres semanas de retraso. Necesitas comunicarlo de forma que preserve la relación comercial.',
    rubric: {
      L1L2: 'Prompt de una línea sin contexto. Ej: "ayúdame a escribir un mensaje de malas noticias"',
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
    text: 'Escribe un prompt para que la IA te ayude a decidir si es mejor ofrecer un descuento a un cliente que está dudando en comprar o mantener el precio — obligándola a mostrarte su razonamiento paso a paso antes de concluir.',
    scenarioText: 'Un cliente está dudando entre comprar ahora o esperar. Necesitas decidir si ofrecerle un descuento o mantener el precio. Quieres que la IA te ayude a razonar, no solo a darte una respuesta.',
    rubric: {
      L1L2: 'Pregunta directa sin pedir razonamiento. Ej: "¿debería ofrecer un descuento?"',
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
    scaleText: '¿En qué medida tu jefe directo apoya activamente el uso de IA en tu trabajo?',
    scaleOptions: [
      { value: 1, label: 'Nunca lo ha mencionado ni promovido' },
      { value: 2, label: 'Lo menciona ocasionalmente pero sin acciones concretas' },
      { value: 3, label: 'Me ha dado espacio o recursos para explorarlo' },
      { value: 4, label: 'Lo promueve activamente y da el ejemplo' }
    ]
  },

  {
    id: 'D1b',
    section: 'D',
    type: 'mixed_scale',
    scaleText: '¿En qué medida sientes que Inchcape como empresa apoya activamente el uso de IA?',
    scaleOptions: [
      { value: 1, label: 'No he visto ninguna iniciativa o comunicación al respecto' },
      { value: 2, label: 'He escuchado menciones generales pero sin acciones concretas' },
      { value: 3, label: 'Hay herramientas disponibles pero no hay formación ni seguimiento' },
      { value: 4, label: 'Existe una estrategia clara con formación, seguimiento y liderazgo visible' }
    ]
  },

  {
    id: 'D2',
    section: 'D',
    type: 'open',
    text: '¿Has sentido alguna vez que usar IA en tu trabajo generaba desconfianza o incomodidad en tu entorno? Si es así, descríbelo brevemente — si no, también puedes decirlo.'
  },

  {
    id: 'D4',
    section: 'D',
    type: 'open',
    text: '¿Hay alguna herramienta de IA que necesitarías para trabajar mejor y no tienes acceso hoy? Si es así, ¿cómo te está afectando no tenerla?'
  },

  {
    id: 'D5',
    section: 'D',
    type: 'mixed_conditional',
    closedText: 'Además de este programa, ¿existen espacios en Inchcape para compartir prompts, aprendizajes o casos de uso de IA entre compañeros?',
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
    type: 'mixed_scale',
    scaleText: '¿Sabes si Inchcape tiene una política oficial sobre el uso de IA?',
    scaleOptions: [
      { value: 1, label: 'Sí, la conozco y sé lo que dice' },
      { value: 2, label: 'Sí, sé que existe pero no la he leído' },
      { value: 3, label: 'No sé si existe alguna política al respecto' },
      { value: 4, label: 'No sé qué es una política de uso de IA' }
    ]
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
      { value: 1, letter: 'A', label: 'Me genera dudas — no sé bien qué significa para mi trabajo' },
      { value: 2, letter: 'B', label: 'Tengo curiosidad pero todavía no sé cómo me va a afectar' },
      { value: 3, letter: 'C', label: 'Lo veo como una oportunidad clara para crecer en mi rol' },
      { value: 4, letter: 'D', label: 'Ya la incorporé como parte natural de cómo trabajo' }
    ]
  }

];
