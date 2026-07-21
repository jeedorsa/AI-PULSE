
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
      L1: 'No usó IA, o solo la menciona de forma tangencial / vacío / off-topic',
      L2: 'Menciona uso con tipo de output genérico (ej. "para presentaciones") sin problema o entregable concreto',
      L3: 'Describe caso sustantivo y concreto: problema o entregable identificable + al menos una particularidad',
      L4: 'Integración sistémica: múltiples usos coordinados en el mismo entregable o flujo establecido con rol reproducible'
    }
  },

  {
    id: 'E3',
    section: 'A',
    type: 'open',
    text: 'Cuando la IA te da un resultado incorrecto o que no era lo que esperabas, ¿qué haces exactamente?',
    scoringSignals: {
      L1: 'No sabe qué hacer / no aplica porque no usa IA / vacío / off-topic',
      L2: 'Reintenta de forma simple ("lo vuelvo a intentar", "reformulo") sin método específico',
      L3: 'Proceso de corrección con criterio: agrega contexto, divide la tarea, especifica formato, verifica en fuentes externas',
      L4: 'Diagnóstico sistemático: identifica causa (alucinación, contexto insuficiente, mal prompt) y tiene protocolo diferenciado'
    }
  },

  {
    id: 'E5',
    section: 'A',
    type: 'open',
    text: '¿Has compartido algo relacionado con IA con algún compañero o equipo? Puede ser cualquier cosa — un truco que descubriste, un resultado que te sorprendió, una herramienta que probaste, o simplemente mostrarle a alguien cómo usarla. Cuéntame el caso más reciente.\n\nSi aún no lo has hecho, puedes decirlo — también es información valiosa.',
    scoringSignals: {
      L1: 'No ha compartido nada, no lo ve como parte de su rol',
      L2: 'Compartió algo puntual de forma espontánea sin descripción específica ni impacto',
      L3: 'Compartió intencionalmente: describe qué, a quién, con qué propósito y/o reacción generada',
      L4: 'Lidera aprendizaje sistemático: sesiones formales, documentación, recomendaciones estructuradas'
    }
  },

  {
    id: 'E6',
    section: 'A',
    type: 'open',
    text: '¿En tus palabras, qué es un agente de IA?',
    scoringSignals: {
      L1: 'No sabe o da una definición incorrecta (confunde "agente" con cualquier IA o chatbot básico)',
      L2: 'Definición vaga — dice que "hace tareas" pero sin mencionar autonomía, uso de herramientas o un objetivo',
      L3: 'Definición correcta — menciona que actúa de forma autónoma y usa herramientas/pasos para lograr un objetivo, distinguiéndolo de un chatbot simple',
      L4: 'Definición completa y aplicada — además del L3, da un ejemplo concreto o cómo lo usaría/usó en su trabajo'
    }
  },

  // ── SECCIÓN B — CRITERIO Y CAPACIDADES TÉCNICAS (weight: 0.20) ───

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
      L1: 'Sin conciencia de riesgo: "no evito nada", "no sé qué evitar", o declara compartir todo sin restricciones',
      L2: 'Conciencia general: menciona "información confidencial" o "datos de clientes" sin especificar tipo ni razón',
      L3: 'Categorías concretas (datos personales, financieros, contratos, precios, clientes identificables) + al menos una razón concreta (regulación, contrato, política)',
      L4: 'Distingue herramientas aprobadas vs. IA pública, conoce políticas corporativas, explica el porqué del comportamiento diferenciado'
    }
  },

  {
    id: 'B4',
    section: 'B',
    type: 'open',
    concept: 'MULTIMODALIDAD',
    text: '¿Has usado alguna vez la IA con algo que no sea texto — una imagen, un audio, un documento, una foto? Cuéntame qué hiciste.',
    scoringSignals: {
      L1: 'Ninguno / vacío / solo texto plano',
      L2: 'Menciona al menos un tipo de archivo estructurado (Excel, CSV, PDF, código, imágenes) aunque sea general — datos/Excel/CSV ya cuentan como mínimo L2',
      L3: 'Describe con especificidad: qué archivo, para qué propósito, qué obtuvo del análisis',
      L4: 'Análisis avanzado: combina fuentes, procesamiento complejo, o flujo establecido para análisis recurrentes'
    }
  },

  // ── SECCIÓN C — LABORATORIO DE EJECUCIÓN (weight: 0.50) ──────────

  {
    id: 'C1',
    section: 'C',
    type: 'prompt_input',
    text: 'Escribe el prompt para pedirle a la IA que redacte un mensaje para un cliente importante informándole que su vehículo tendrá un retraso de 3 semanas.',
    scenarioText: 'Un cliente importante acaba de enterarse de que su vehículo se entregará con tres semanas de retraso. Necesitas comunicarlo de forma que preserve la relación comercial.',
    rubric: {
      L1: 'Vacío, off-topic, o de una línea sin contexto. Ej: "redacta un email sobre retraso". Output resultante sería inútil',
      L2: 'Contexto básico (retraso, VIP, 3 semanas) sin tono, propósito claro ni restricciones. Utilizable pero genérico',
      L3: 'Al menos 3 de: tono para VIP, propósito, tipo de relación, restricciones, longitud/formato',
      L4: 'Rol asignado (ej. "relationship manager"), personalización, estructura narrativa (empática → explicación → compensación → compromiso), restricciones avanzadas'
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
      L1: 'Repite el original o cambios triviales (ej. "...por favor")',
      L2: 'Agrega 1-2 elementos básicos (audiencia o tema). Mejora palpable pero sigue genérico',
      L3: 'Al menos 3 mejoras sustantivas: audiencia específica, contexto del negocio, formato/longitud, # slides, datos clave, tono',
      L4: 'Rol asignado ("Eres consultor de comunicación ejecutiva"), contexto de negocio, estructura narrativa (problema → análisis → conclusión → próximos pasos), marcadores explícitos de slide'
    }
  },

  {
    id: 'C3',
    section: 'C',
    type: 'prompt_input',
    text: 'Escribe un prompt para que la IA te ayude a decidir si es mejor ofrecer un descuento a un cliente que está dudando en comprar o mantener el precio — obligándola a mostrarte su razonamiento paso a paso antes de concluir.',
    scenarioText: 'Un cliente está dudando entre comprar ahora o esperar. Necesitas decidir si ofrecerle un descuento o mantener el precio. Quieres que la IA te ayude a razonar, no solo a darte una respuesta.',
    rubric: {
      L1: 'Sin CoT, prompt genérico (ej. "¿debería ofrecer descuento?")',
      L2: 'Alguna instrucción de análisis pero SIN CoT explícito. Puede listar factores — techo L2 sin CoT, no puede subir',
      L3: 'CoT explícito ("razona paso a paso", "analiza factor por factor", "piensa en voz alta", "primero X luego Y") + contextualiza el problema y criterios relevantes',
      L4: 'CoT + estructura estratégica: escenarios (optimista/conservador/pesimista), identificación de supuestos, solicitud de vulnerabilidades del razonamiento, árbol de decisión'
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
    scaleText: '¿En qué medida sientes que {empresa} como empresa apoya activamente el uso de IA?',
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
    closedText: 'Además de este programa, ¿existen espacios en {empresa} para compartir prompts, aprendizajes o casos de uso de IA entre compañeros?',
    closedOptions: [
      { value: 'yes_active', label: 'Sí, existe y lo uso activamente' },
      { value: 'yes_inactive', label: 'Sí, existe pero no está activo o no lo uso' },
      { value: 'no', label: 'No existe nada parecido' },
      { value: 'unknown', label: 'No sé si existe' }
    ]
  },

  {
    id: 'D6',
    section: 'D',
    type: 'mixed_scale',
    scaleText: '¿Sabes si {empresa} tiene una política oficial sobre el uso de IA?',
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
