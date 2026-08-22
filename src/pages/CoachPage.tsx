import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const LEVEL_NAMES: Record<string, string> = {
  L1: 'Novato', L2: 'Experimentador', L3: 'Practicante', L4: 'Amplificador',
  L4T: 'Amplificador Técnico', L4L: 'Amplificador Estratégico'
};

// ── Perfil AIQ estilo "AI Pulse" ────────────────────────────────────────────
type LevelCode = 'L1' | 'L2' | 'L3' | 'L4';
type DimCode = 'A' | 'B' | 'C';

const ESCALA_INFO: { code: LevelCode; desc: string }[] = [
  { code: 'L1', desc: 'Explora la IA por primera vez' },
  { code: 'L2', desc: 'Usa la IA en tareas puntuales' },
  { code: 'L3', desc: 'Integra la IA con criterio y resultados concretos' },
  { code: 'L4', desc: 'Multiplica el impacto de la IA en su equipo' },
];

const DIM_PROFILE_LABELS: Record<DimCode, string> = {
  A: 'Uso real de IA en tu trabajo',
  B: 'Criterio y seguridad',
  C: 'Capacidad de prompting',
};

const DIM_LEVEL_DESC: Record<DimCode, Record<LevelCode, string>> = {
  A: {
    L1: 'Todavía no has incorporado la IA en tu día a día, o la has explorado muy brevemente. Ese es exactamente el punto de partida que este programa está diseñado para acompañar.',
    L2: 'Ya usas la IA para tareas puntuales y genéricas, pero todavía no la conectas con problemas concretos de tu rol. El siguiente paso es identificar un caso de uso específico y repetible.',
    L3: 'Tienes casos de uso concretos: identificas un problema o entregable real y sabes que particularidad de la herramienta te ayuda a resolverlo. Ahora el foco es sistematizar ese uso.',
    L4: 'Integras la IA de forma sistémica en tu trabajo: coordinas múltiples usos o tienes un flujo ya establecido con un rol reproducible. Eres un referente para tu equipo en este eje.',
  },
  B: {
    L1: 'Todavía no tienes un criterio claro sobre qué información compartir con una IA ni cómo verificar lo que te devuelve. Construir ese criterio es la base de un uso responsable.',
    L2: 'Tienes conciencia básica de los límites: sabes que no todo se puede compartir y que hay que verificar. El siguiente paso es hacer eso más sistemático y menos intuitivo.',
    L3: 'Manejas categorías concretas de información sensible y tienes al menos una razón clara para no compartirlas — regulación, contrato o política. Ese criterio ya es sólido.',
    L4: 'Distingues con claridad qué herramienta usar según el tipo de dato (interna vs. pública) y conoces las políticas de tu empresa. Eres referente en criterio de seguridad para tu equipo.',
  },
  C: {
    L1: 'Tus instrucciones a la IA son aún simples o generales, lo que limita la calidad de lo que obtienes. Aprender a escribir mejores prompts es la habilidad con mayor retorno inmediato.',
    L2: 'Ya agregas algunos elementos de contexto a tus prompts, pero de forma genérica. El siguiente paso es ser más específico: rol, formato y restricciones concretas.',
    L3: 'Tus prompts ya incluyen contexto, tono y restricciones claras — y en el caso de decisiones, pides razonamiento paso a paso. Eso te da resultados consistentemente mejores.',
    L4: 'Escribes prompts con estructura avanzada: rol específico, narrativa completa y validación del razonamiento de la IA. Eres un usuario avanzado de esta habilidad.',
  },
};

function normalizeLevel(level?: string): LevelCode {
  if (level === 'L4T' || level === 'L4L' || level === 'L4') return 'L4';
  if (level === 'L1' || level === 'L2' || level === 'L3') return level;
  return 'L1';
}

// sectionA/B/C en v5 ya son el nivel de sección como entero 1-4; en legacy
// eran un promedio ponderado sobre 5 — se aproxima a 1-4 para no romper la
// vista con datos históricos no migrados.
function dimLevelInt(value: number, rubricVersion?: string): number {
  const raw = rubricVersion === 'v5' ? value : (value / 5) * 4;
  return Math.max(1, Math.min(4, Math.round(raw || 1)));
}

const INT_TO_LEVEL_CODE: Record<number, LevelCode> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4' };

interface RecomendacionCard { id: string; headline: string; body: string; }

const COACH_EMAIL_KEY = 'aipulse_coach_email';
const COACH_TOKEN_KEY = 'aipulse_coach_token';
const COACH_DEMO_KEY  = 'aipulse_coach_demo';

interface Profile {
  nombre: string; aiqScore: number; aiqLevel: string;
  sectionA: number; sectionB: number; sectionC: number;
  empresa: string; posicion: string;
  completedAt?: string;
  rubricVersion?: string;
  flags?: string[];
  recomendaciones?: RecomendacionCard[];
}

type Screen = 'login' | 'setup' | 'dashboard';

function coachHeaders(email: string, token: string) {
  return { 'Content-Type': 'application/json', 'X-Coach-Email': email, 'X-Coach-Token': token };
}

export default function CoachPage() {
  const [screen, setScreen]       = useState<Screen>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [isDemo, setIsDemo]       = useState(false);

  // Restaurar sesión — detecta modo demo primero
  useEffect(() => {
    const demoRaw = sessionStorage.getItem(COACH_DEMO_KEY);
    if (demoRaw) {
      try {
        const demo = JSON.parse(demoRaw);
        const savedEmail = sessionStorage.getItem(COACH_EMAIL_KEY) || 'demo@aipulse.ai';
        const savedToken = sessionStorage.getItem(COACH_TOKEN_KEY) || '';
        setIsDemo(true);
        setEmail(savedEmail);
        setSessionToken(savedToken);
        setProfile(demo.profile);
        setScreen('dashboard');
        return;
      } catch {}
    }

    // Sesión normal
    const savedEmail = sessionStorage.getItem(COACH_EMAIL_KEY);
    const savedToken = sessionStorage.getItem(COACH_TOKEN_KEY);
    if (savedEmail && savedToken) {
      fetch('/api/coach-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'validate', email: savedEmail, sessionToken: savedToken })
      }).then(r => r.json()).then(d => {
        if (d.valid) {
          setEmail(savedEmail);
          setSessionToken(savedToken);
          if (d.nombre !== undefined) {
            setProfile({
              nombre:   d.nombre,
              aiqScore: d.aiqScore || 0,
              aiqLevel: d.aiqLevel || '',
              sectionA: d.sectionA || 0,
              sectionB: d.sectionB || 0,
              sectionC: d.sectionC || 0,
              empresa:  d.empresa  || '',
              posicion: d.posicion || '',
              completedAt: d.completedAt,
              rubricVersion: d.rubricVersion,
              flags: d.flags || [],
              recomendaciones: d.recomendaciones || [],
            });
          }
          setScreen('dashboard');
        }
      }).catch(() => {});
    }
  }, []);

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/coach-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'check', email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); setLoading(false); return; }
      if (!data.coachEnabled) {
        setError('Tu coach aún no está disponible. El equipo de AI Pulse lo activará cuando tu informe esté listo.');
        setLoading(false); return;
      }
      setScreen(data.hasPassword ? 'login' : 'setup');
    } catch { setError('Error de conexión.'); }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true); setError('');
    const mode = screen === 'setup' ? 'setup' : 'login';
    try {
      const res = await fetch('/api/coach-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, email: email.trim().toLowerCase(), password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || 'Error'); setLoading(false); return; }
      sessionStorage.setItem(COACH_EMAIL_KEY, email.trim().toLowerCase());
      sessionStorage.setItem(COACH_TOKEN_KEY, data.sessionToken);
      setSessionToken(data.sessionToken);
      setProfile({
        nombre: data.nombre, aiqScore: data.aiqScore, aiqLevel: data.aiqLevel,
        sectionA: data.sectionA, sectionB: data.sectionB, sectionC: data.sectionC,
        empresa: data.empresa, posicion: data.posicion,
        completedAt: data.completedAt,
        rubricVersion: data.rubricVersion,
        flags: data.flags || [],
        recomendaciones: data.recomendaciones || [],
      });
      setScreen('dashboard');
    } catch { setError('Error de conexión.'); }
    setLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(COACH_EMAIL_KEY);
    sessionStorage.removeItem(COACH_TOKEN_KEY);
    setScreen('login'); setProfile(null);
    setEmail(''); setPassword(''); setSessionToken('');
  };

  const inputClass = "w-full bg-[#F7F7F7] border border-[#DADADA] rounded-[2px] px-4 py-3 font-body text-[14px] text-[#111111] placeholder-[#9a9a9a] focus:outline-none focus:border-primary/60 transition-colors";

  // ── PANTALLA LOGIN / SETUP ───────────────────────────────────────────────
  if (screen === 'login' || screen === 'setup') {
    const isSetup = screen === 'setup';
    const showEmailForm = !isSetup && !error?.includes('no está disponible') && screen === 'login' && !password;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="font-display text-[32px] text-primary leading-none mb-1">AIQ</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#9a9a9a]">Coach Personal</div>
          </div>

          {/* Paso 1: ingresar email */}
          {screen === 'login' && !isSetup && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <p className="font-body text-[13px] text-[#808080] text-center">
                Ingresa tu correo para acceder a tu coach
              </p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@empresa.com" autoFocus className={inputClass} />
              <button type="submit" disabled={loading || !email.trim()}
                className="w-full min-h-[48px] bg-primary text-white font-mono text-[11px] uppercase tracking-wider rounded-[2px] hover:bg-primary/90 transition-colors disabled:opacity-40">
                {loading ? 'Verificando...' : 'Continuar'}
              </button>
            </form>
          )}

          {/* Paso 2a: crear contraseña (primera vez) */}
          {isSetup && (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="bg-[#F0FFF4] border border-[#00AA55]/20 rounded-[2px] px-4 py-3">
                <p className="font-body text-[13px] text-[#00AA55]">Tu coach está listo. Crea una contraseña para acceder.</p>
              </div>
              <input type="email" value={email} disabled className={`${inputClass} opacity-50`} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Crea tu contraseña (mín. 6 caracteres)" autoFocus className={inputClass} />
              <button type="submit" disabled={loading || password.length < 6}
                className="w-full min-h-[48px] bg-primary text-white font-mono text-[11px] uppercase tracking-wider rounded-[2px] hover:bg-primary/90 transition-colors disabled:opacity-40">
                {loading ? 'Configurando...' : 'Activar mi coach'}
              </button>
            </form>
          )}

          {/* Paso 2b: ingresar contraseña (recurrente) — se activa después de check */}
          {screen === 'login' && !isSetup && error === '' && password === '' ? null : (
            screen === 'login' && !isSetup && !error.includes('no está disponible') && (
              <form onSubmit={handleAuth} className="space-y-4 mt-4">
                <input type="email" value={email} disabled className={`${inputClass} opacity-50`} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Tu contraseña" autoFocus className={inputClass} />
                <button type="submit" disabled={loading || !password.trim()}
                  className="w-full min-h-[48px] bg-primary text-white font-mono text-[11px] uppercase tracking-wider rounded-[2px] hover:bg-primary/90 transition-colors disabled:opacity-40">
                  {loading ? 'Ingresando...' : 'Entrar'}
                </button>
              </form>
            )
          )}

          {error && (
            <div className="mt-4 p-3 rounded-[8px] bg-[rgba(254,60,28,0.06)] border border-[rgba(254,60,28,0.2)]">
              <p className="font-body text-[12px] text-primary text-center">{error}</p>
            </div>
          )}

          {(isSetup || (!isSetup && error === '' && email)) && (
            <button onClick={() => { setScreen('login'); setPassword(''); setError(''); }}
              className="mt-4 w-full font-mono text-[9px] uppercase tracking-wider text-[#9a9a9a] hover:text-primary transition-colors">
              ← Volver
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  // Derivados para la tarjeta de perfil estilo "AI Pulse"
  const nivelActual = normalizeLevel(profile?.aiqLevel);
  const dimLevels: Record<DimCode, number> = {
    A: dimLevelInt(profile?.sectionA || 0, profile?.rubricVersion),
    B: dimLevelInt(profile?.sectionB || 0, profile?.rubricVersion),
    C: dimLevelInt(profile?.sectionC || 0, profile?.rubricVersion),
  };
  const dimLevelCodes: Record<DimCode, LevelCode> = {
    A: INT_TO_LEVEL_CODE[dimLevels.A],
    B: INT_TO_LEVEL_CODE[dimLevels.B],
    C: INT_TO_LEVEL_CODE[dimLevels.C],
  };
  const DIM_BAR_PCT: Record<LevelCode, number> = { L1: 25, L2: 50, L3: 75, L4: 100 };
  const DIM_BAR_COLOR: Record<LevelCode, string> = {
    L1: '#FE3C1C', L2: '#FE3C1C', L3: '#FE3C1C', L4: '#FE3C1C',
  };
  const fechaPerfil = (() => {
    const fecha = profile?.completedAt ? new Date(profile.completedAt) : new Date();
    const s = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Navbar */}
      <div className="bg-white border-b border-[#DADADA] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-[20px] text-primary">AIQ</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#9a9a9a]">AI PULSE - DIAGNÓSTICO DE MADUREZ DE USO DE IA PERSONAL</span>
        </div>
        <button onClick={handleLogout} className="font-mono text-[9px] uppercase tracking-wider text-[#9a9a9a] hover:text-primary transition-colors">
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-[1120px] mx-auto px-4 py-8 flex items-start gap-6">

        {/* Sidebar izquierdo — acceso al banco de prompts */}
        <aside className="hidden lg:flex flex-col shrink-0 w-[320px] sticky top-8 gap-4 bg-white rounded-[10px] border-l-4 border-primary shadow-sm px-7 py-6">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-[18px]">💡</div>
          <div>
            <div className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#808080] mb-2">Recurso</div>
            <p className="font-body text-[13px] text-[#808080] leading-[1.6]">
              Explora prompts listos para usar, organizados según tu nivel AIQ y tu rol, para aplicar la IA en tu trabajo diario.
            </p>
          </div>
          <Link
            to="/banco-prompts"
            className="min-h-[44px] px-3 flex items-center justify-center text-center bg-primary text-white font-mono text-[10px] uppercase tracking-wider rounded-[2px] hover:bg-primary/90 transition-colors"
          >
            Ir a mi banco de prompts
          </Link>
        </aside>

        <div className="flex-1 min-w-0 max-w-[720px] mx-auto">

        <div className="space-y-4">

          {/* Perfil AIQ — estilo AI Pulse */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Header */}
            <div className="relative overflow-hidden rounded-[10px] bg-[#111111] pt-9 px-10 pb-8 shadow-lg">
              <div
                className="absolute inset-0"
                style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1.6px)', backgroundSize: '15px 15px' }}
              />
              <div className="relative flex items-center justify-between mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3.5 py-[5px] font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Diagnóstico AIQ · AI Pulse
                </span>
                <span className="font-body text-[11px] font-light text-[#B3B3B3] whitespace-nowrap">{fechaPerfil}</span>
              </div>
              <div className="relative flex items-end justify-between gap-4 mb-6">
                <div className="min-w-0">
                  <p className="font-display text-[34px] font-black text-white leading-tight mb-1.5">{profile?.nombre}</p>
                  <p className="font-body text-[12px] font-light text-[#B3B3B3] tracking-[0.04em] truncate">{profile?.empresa}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="inline-block bg-primary text-white font-display text-[52px] font-black leading-none tracking-[-0.03em] rounded-[4px] px-1 mb-1">{nivelActual}</div>
                  <div className="font-display text-[18px] font-bold text-white">{LEVEL_NAMES[nivelActual]}</div>
                </div>
              </div>
              {/* Escala */}
              <div className="relative grid grid-cols-4 gap-2 pt-5 border-t border-white/[0.08]">
                {ESCALA_INFO.map(item => {
                  const active = item.code === nivelActual;
                  return (
                    <div key={item.code} className={`rounded-[6px] px-3 py-2.5 ${active ? 'bg-[#2A1712] border border-primary' : 'bg-[#1A1A1A] border border-[#2A2A2A]'}`}>
                      <div className={`font-display text-[16px] font-black mb-0.5 ${active ? 'text-primary' : 'text-white/25'}`}>{item.code}</div>
                      <div className={`font-mono text-[9px] font-semibold uppercase tracking-[0.06em] ${active ? 'text-primary/70' : 'text-white/20'}`}>
                        {LEVEL_NAMES[item.code]}
                      </div>
                      <div className={`text-[9px] leading-[1.4] mt-1 ${active ? 'text-white/60' : 'text-white/15'}`}>{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Encuadre */}
            <div className="bg-white rounded-[10px] py-6 px-7 border-l-4 border-primary shadow-sm">
              <p className="font-body text-[13.5px] text-[#808080] leading-[1.75] italic">
                Este diagnóstico es el punto de partida en AI Pulse. No mide tu desempeño ni tu potencial como profesional: mide dónde estás hoy con la IA para diseñar el camino que tiene más sentido para ti. No hay respuestas correctas ni incorrectas: hay puntos de partida distintos, y todos son válidos.
              </p>
              <div className="mt-3.5 flex items-center gap-2.5">
                <div className="w-6 h-0.5 bg-primary flex-shrink-0" />
                <div className="font-display text-[11px] font-bold text-[#111111] tracking-[0.03em]">Equipo VINKA</div>
              </div>
            </div>

            {/* Dimensiones */}
            <div className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-[#808080] px-1">Tu perfil por dimensión</div>
            <div className="space-y-2.5">
              {(['A', 'B', 'C'] as DimCode[]).map(dim => {
                const lvl = dimLevelCodes[dim];
                return (
                  <div key={dim} className="grid grid-cols-[160px_1fr] rounded-[10px] overflow-hidden shadow-sm">
                    <div className="bg-[#111111] px-[18px] py-[22px] flex flex-col justify-between">
                      <div className="font-display text-[12px] font-bold text-white leading-[1.4]">{DIM_PROFILE_LABELS[dim]}</div>
                      <div className="mt-4 flex flex-col gap-[5px]">
                        <div className="h-[3px] rounded-[2px] bg-white/[0.08] relative overflow-hidden">
                          <div className="absolute top-0 left-0 bottom-0 rounded-[2px]" style={{ width: `${DIM_BAR_PCT[lvl]}%`, background: DIM_BAR_COLOR[lvl] }} />
                        </div>
                        <div className="font-display text-[10px] font-extrabold tracking-[0.06em]" style={{ color: DIM_BAR_COLOR[lvl] }}>{lvl} · {LEVEL_NAMES[lvl]}</div>
                      </div>
                    </div>
                    <div className="bg-white px-6 py-[22px] flex items-center">
                      <div className="font-body text-[12.5px] text-[#808080] leading-[1.7]">{DIM_LEVEL_DESC[dim][lvl]}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Qué sigue */}
            <div className="rounded-[10px] py-6 px-7 shadow-lg flex items-center gap-5" style={{ background: 'linear-gradient(135deg, #111111 0%, #000000 100%)' }}>
              <div className="flex-shrink-0 w-11 h-11 rounded-full border-2 border-primary/30 flex items-center justify-center text-[20px]">🚀</div>
              <div>
                <div className="font-mono text-[9px] font-extrabold uppercase tracking-[0.18em] text-primary mb-[5px]">Lo que viene</div>
                <div className="font-body text-[13px] text-white/85 leading-[1.6] font-light">
                  Basado en este diagnóstico, el programa <strong className="font-bold text-primary">AI Pulse</strong> te acompaña con sesiones diseñadas para tu perfil y el de tu equipo. Más información pronto.
                </div>
              </div>
            </div>

          </motion.div>
        </div>

        </div>

      </div>

      {/* Footer Vinka */}
      <footer className="w-full bg-white border-t border-black/[0.08]">
        <div className="max-w-[1120px] mx-auto px-6 py-7 flex flex-col md:grid md:grid-cols-3 items-center gap-4">
          <div
            className="md:justify-self-start"
            style={{
              fontFamily: '"Big Shoulders Display", sans-serif',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'rgb(0, 0, 0)',
              fontSize: '28px',
            }}
          >
            VINKA
          </div>
          <span className="font-body text-[#808080] text-[13.5px] text-center md:justify-self-center">© 2026 Vinka SAS · vinka.one</span>
          <a
            href="https://www.linkedin.com/company/vinkalab/"
            target="_blank"
            rel="noopener"
            className="font-body font-medium text-black text-[13.5px] no-underline border-b border-primary pb-0.5 md:justify-self-end"
          >
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
}
