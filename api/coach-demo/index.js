const crypto = require("crypto");
const { requireAdmin } = require("../shared/adminAuth");

/**
 * POST /api/coach-demo
 *
 * Genera una sesión demo del coach con un perfil ficticio realista.
 * Solo accesible por admins. No toca la BD.
 * El token expira en 2 horas.
 */

const DEMO_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
const DEMO_EMAIL  = "demo@aipulse.ai";

function createDemoToken() {
  const payload = `${DEMO_EMAIL}:${Date.now()}:demo`;
  const sig = crypto.createHmac("sha256", process.env.ADMIN_PASSWORD).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

// Perfil demo — L3 con brecha clara en Bloque B, realista para ventas
const DEMO_PROFILE = {
  nombre:    "María Fernanda López",
  posicion:  "Gerente de Marketing",
  empresa:   "Demo Corp",
  aiqScore:  3.17,
  aiqLevel:  "L3",
  sectionA:  3.50,
  sectionB:  2.40,
  sectionC:  3.30,
  isNew:     false
};

const DEMO_TASKS = [
  {
    id: "t1",
    titulo: "Verifica antes de publicar",
    descripcion: "Esta semana, antes de usar cualquier respuesta de IA en un entregable de marketing, valida al menos un dato clave con una fuente externa. Documenta qué verificaste y qué encontraste.",
    dimension: "B",
    completada: false
  },
  {
    id: "t2",
    titulo: "Prompt estructurado para brief",
    descripcion: "Escribe un prompt usando el framework RCTFR para generar el próximo brief de campaña. Incluye rol, contexto del cliente, tarea específica y formato de salida esperado.",
    dimension: "C",
    completada: false
  },
  {
    id: "t3",
    titulo: "Documenta un caso de uso real",
    descripcion: "Elige un entregable reciente donde usaste IA y escribe 3 oraciones sobre cómo la integraste, qué ajustaste y qué resultado obtuviste. Compártelo en el próximo team meeting.",
    dimension: "A",
    completada: true
  }
];

const DEMO_CHAT_HISTORY = [
  {
    role: "assistant",
    content: "Hola María Fernanda, bienvenida a tu espacio de desarrollo AIQ. Tu diagnóstico muestra un perfil sólido en Experiencia Real (A: 3.5) y Laboratorio (C: 3.3), con una brecha clara en Criterio Técnico (B: 2.4) — específicamente en verificación de datos y criterio sobre información corporativa. Por ahí empieza tu próximo salto. ¿Quieres que te explique qué significa en el contexto de tu rol en Marketing?"
  }
];

const DEMO_ANALYSIS = {
  fortalezas: [
    { titulo: "Uso estructurado de IA en entregables", descripcion: "Integra IA de forma habitual en reportes y presentaciones con un proceso claro de iteración." }
  ],
  oportunidades: [
    { titulo: "Criterio de verificación", descripcion: "Tiende a confiar en respuestas de IA sin validación cruzada, lo que es riesgo en contextos de datos de mercado." }
  ],
  gaps: [
    { titulo: "Verificación sistemática", accion: "Implementar un checklist de 3 puntos antes de usar datos de IA en reportes externos." }
  ],
  brecha_critica: "Bloque B por debajo del promedio — criterio técnico y gobernanza de datos.",
  dim_b_interpretacion: "Score 2.4 en Criterio Técnico indica uso frecuente pero sin protocolos de verificación.",
  dim_b_gap: "Falta un proceso sistemático para validar outputs de IA antes de usarlos en entregables."
};

module.exports = async function (context, req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") { context.res = { status: 200, headers, body: "" }; return; }
  if (!requireAdmin(context, req)) return;

  const sessionToken = createDemoToken();

  context.res = {
    status: 200,
    headers,
    body: JSON.stringify({
      success:      true,
      sessionToken,
      email:        DEMO_EMAIL,
      isDemo:       true,
      expiresIn:    "2h",
      profile:      DEMO_PROFILE,
      tasks:        DEMO_TASKS,
      chatHistory:  DEMO_CHAT_HISTORY,
      analysis:     DEMO_ANALYSIS
    })
  };
};
