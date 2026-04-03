import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const LEVEL_NAMES: Record<string, string> = {
  L1: 'Novato', L2: 'Experimentador', L3: 'Practicante',
  L4T: 'Amplificador Técnico', L4L: 'Amplificador Estratégico'
};
const DIM_NAMES: Record<string, string> = { A: 'Experiencia Real', B: 'Criterio Técnico', C: 'Laboratorio' };

const COACH_EMAIL_KEY = 'aipulse_coach_email';
const COACH_TOKEN_KEY = 'aipulse_coach_token';

interface Task { id: string; titulo: string; descripcion: string; dimension: string; completada: boolean; }
interface Message { role: 'user' | 'assistant'; content: string; ts?: number; }
interface Profile { nombre: string; aiqScore: number; aiqLevel: string; sectionA: number; sectionB: number; sectionC: number; empresa: string; posicion: string; }

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
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [inputMsg, setInputMsg]   = useState('');
  const [sending, setSending]     = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Restaurar sesión guardada
  useEffect(() => {
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
          setScreen('dashboard');
        }
      }).catch(() => {});
    }
  }, []);

  // Scroll al fondo del chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Cargar tareas al entrar al dashboard
  useEffect(() => {
    if (screen !== 'dashboard' || !sessionToken || !email) return;
    loadTasks();
  }, [screen, sessionToken]);

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/coach-init', {
        method: 'POST',
        headers: coachHeaders(email, sessionToken),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch {}
    setLoadingTasks(false);
  };

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
        empresa: data.empresa, posicion: data.posicion
      });
      if (data.isNew) {
        setMessages([{ role: 'assistant', content: `Hola ${data.nombre}, bienvenido a tu espacio de desarrollo AIQ. Aquí puedes consultarme dudas sobre cómo mejorar tu uso de IA en el trabajo, revisar tus tareas y hacer seguimiento a tu progreso. ¿Por dónde quieres empezar?` }]);
      }
      setScreen('dashboard');
    } catch { setError('Error de conexión.'); }
    setLoading(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending) return;
    const msg = inputMsg.trim();
    setInputMsg('');
    setMessages(prev => [...prev, { role: 'user', content: msg, ts: Date.now() }]);
    setSending(true);
    try {
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: coachHeaders(email, sessionToken),
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      if (data.reply) setMessages(prev => [...prev, { role: 'assistant', content: data.reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hubo un error. Intenta de nuevo.', ts: Date.now() }]);
    }
    setSending(false);
  };

  const handleToggleTask = async (taskId: string, current: boolean) => {
    const optimistic = tasks.map(t => t.id === taskId ? { ...t, completada: !current } : t);
    setTasks(optimistic);
    try {
      const res = await fetch('/api/tasks-update', {
        method: 'POST',
        headers: coachHeaders(email, sessionToken),
        body: JSON.stringify({ taskId, completada: !current })
      });
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch { setTasks(tasks); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(COACH_EMAIL_KEY);
    sessionStorage.removeItem(COACH_TOKEN_KEY);
    setScreen('login'); setProfile(null); setTasks([]); setMessages([]);
    setEmail(''); setPassword(''); setSessionToken('');
  };

  const inputClass = "w-full bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-4 py-3 font-body text-[14px] text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:border-primary/60 transition-colors";

  // ── PANTALLA LOGIN / SETUP ───────────────────────────────────────────────
  if (screen === 'login' || screen === 'setup') {
    const isSetup = screen === 'setup';
    const showEmailForm = !isSetup && !error?.includes('no está disponible') && screen === 'login' && !password;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="font-display text-[32px] text-primary leading-none mb-1">AIQ</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#AAAAAA]">Coach Personal</div>
          </div>

          {/* Paso 1: ingresar email */}
          {screen === 'login' && !isSetup && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <p className="font-body text-[13px] text-[#666666] text-center">
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
            <div className="mt-4 p-3 rounded-[2px] border bg-[rgba(255,60,60,0.05)] border-[rgba(255,60,60,0.2)]">
              <p className="font-body text-[12px] text-[#FF3C3C] text-center">{error}</p>
            </div>
          )}

          {(isSetup || (!isSetup && error === '' && email)) && (
            <button onClick={() => { setScreen('login'); setPassword(''); setError(''); }}
              className="mt-4 w-full font-mono text-[9px] uppercase tracking-wider text-[#AAAAAA] hover:text-primary transition-colors">
              ← Volver
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  const levelColor = profile?.aiqLevel && ['L4L','L4T'].includes(profile.aiqLevel) ? '#00AA55'
    : profile?.aiqLevel === 'L3' ? '#CC8800' : '#AAAAAA';
  const completadas = tasks.filter(t => t.completada).length;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Navbar */}
      <div className="bg-white border-b border-[#E0E0E0] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-[20px] text-primary">AIQ</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#AAAAAA]">Coach Personal</span>
        </div>
        <button onClick={handleLogout} className="font-mono text-[9px] uppercase tracking-wider text-[#AAAAAA] hover:text-primary transition-colors">
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* ── Columna izquierda ── */}
        <div className="space-y-4">

          {/* Perfil AIQ */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#E0E0E0] rounded-[2px] p-5">
            <div className="mb-4">
              <p className="font-body text-[15px] font-semibold text-[#111111]">{profile?.nombre}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-[#AAAAAA] mt-0.5">
                {profile?.posicion}{profile?.empresa ? ` · ${profile.empresa}` : ''}
              </p>
            </div>
            <div className="flex items-end gap-3 mb-4">
              <div>
                <span className="font-display text-[40px] leading-none" style={{ color: levelColor }}>
                  {profile?.aiqScore.toFixed(2)}
                </span>
                <span className="font-mono text-[10px] text-[#AAAAAA] ml-1">/ 5.0</span>
              </div>
              <div className="pb-1">
                <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: levelColor }}>
                  {profile?.aiqLevel}
                </div>
                <div className="font-body text-[12px] text-[#555555]">
                  {LEVEL_NAMES[profile?.aiqLevel || ''] || ''}
                </div>
              </div>
            </div>
            {/* Barras por dimensión */}
            <div className="space-y-2">
              {(['A','B','C'] as const).map(dim => {
                const score = dim === 'A' ? profile?.sectionA : dim === 'B' ? profile?.sectionB : profile?.sectionC;
                return (
                  <div key={dim}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA]">
                        {dim} · {DIM_NAMES[dim]}
                      </span>
                      <span className="font-mono text-[10px] text-[#555555]">{(score || 0).toFixed(1)}</span>
                    </div>
                    <div className="h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${((score || 0) / 5) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Tareas */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white border border-[#E0E0E0] rounded-[2px] p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#111111]">Tus tareas</span>
              {tasks.length > 0 && (
                <span className="font-mono text-[9px] text-[#AAAAAA]">{completadas}/{tasks.length}</span>
              )}
            </div>

            {loadingTasks ? (
              <p className="font-body text-[12px] text-[#AAAAAA] text-center py-4">Generando tu plan...</p>
            ) : tasks.length === 0 ? (
              <p className="font-body text-[12px] text-[#AAAAAA] text-center py-4">Cargando tareas...</p>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id}
                    className={`border rounded-[2px] p-3 transition-colors ${task.completada ? 'border-[#00AA55]/30 bg-[#F0FFF4]' : 'border-[#E0E0E0]'}`}>
                    <div className="flex gap-3">
                      <button onClick={() => handleToggleTask(task.id, task.completada)}
                        className={`mt-0.5 w-4 h-4 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          task.completada ? 'bg-[#00AA55] border-[#00AA55]' : 'border-[#CCCCCC] hover:border-primary'}`}>
                        {task.completada && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-body text-[12px] font-medium leading-tight ${task.completada ? 'line-through text-[#AAAAAA]' : 'text-[#111111]'}`}>
                          {task.titulo}
                        </p>
                        <p className="font-body text-[11px] text-[#777777] mt-1 leading-[1.5]">{task.descripcion}</p>
                        <span className="inline-block mt-1.5 font-mono text-[8px] uppercase tracking-wider text-primary bg-primary/5 px-1.5 py-0.5 rounded-sm">
                          {DIM_NAMES[task.dimension] || task.dimension}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {completadas === tasks.length && tasks.length > 0 && (
                  <div className="text-center py-2">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-[#00AA55]">
                      ✓ Todas las tareas completadas
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Chat ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white border border-[#E0E0E0] rounded-[2px] flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>

          <div className="px-5 py-4 border-b border-[#E0E0E0]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#111111]">Chat con tu coach</span>
            <p className="font-body text-[11px] text-[#AAAAAA] mt-0.5">Pregunta sobre tus tareas, tu nivel AIQ o cómo mejorar en IA</p>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && !sending && (
              <div className="text-center py-8">
                <p className="font-body text-[13px] text-[#AAAAAA]">
                  Hola {profile?.nombre?.split(' ')[0]} — ¿en qué te puedo ayudar hoy?
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[
                    '¿Cómo puedo mejorar mi Bloque B?',
                    'Explícame mis tareas',
                    '¿Qué significa mi nivel AIQ?'
                  ].map(suggestion => (
                    <button key={suggestion}
                      onClick={() => { setInputMsg(suggestion); }}
                      className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:border-primary hover:text-primary transition-colors">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-[2px] px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-[#F7F7F7] border border-[#E0E0E0] text-[#111111]'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] mb-1">Coach AIQ</div>
                    )}
                    <p className="font-body text-[13px] leading-[1.65] whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] px-4 py-3">
                  <div className="flex gap-1 items-center">
                    {[0,1,2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 bg-[#AAAAAA] rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-[#E0E0E0]">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                placeholder="Escribe tu pregunta..."
                disabled={sending}
                className="flex-1 bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-4 py-2.5 font-body text-[13px] text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
              />
              <button type="submit" disabled={sending || !inputMsg.trim()}
                className="px-4 py-2.5 bg-primary text-white font-mono text-[10px] uppercase tracking-wider rounded-[2px] hover:bg-primary/90 transition-colors disabled:opacity-40">
                Enviar
              </button>
            </form>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
