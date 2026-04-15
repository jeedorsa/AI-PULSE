import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';

type Status = 'idle' | 'loading' | 'not_found' | 'completed' | 'domain_mismatch' | 'cancelled' | 'error';

/**
 * AccessPage — soporta 3 modos de entrada:
 *
 * 1. Dominio abierto:  /acceso?empresa=inchskape&dominio=inchskape.com
 *    → La persona pone su email, verificamos dominio, creamos token si no existe
 *
 * 2. Whitelist:        /acceso
 *    → La persona pone su email, buscamos en la lista cargada por el admin
 *
 * 3. Link de correo:   /verify?token=xxx  (ruta separada, no entra aquí)
 */
export default function AccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setParticipant, restoreProgress } = useAssessmentStore();

  const empresa = searchParams.get('empresa') || '';
  const dominio = searchParams.get('dominio') || '';
  const isDomainMode = !!dominio;

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [nombre, setNombre] = useState('');

  const dominios = dominio ? dominio.split(',').map(d => d.trim()).filter(Boolean) : [];
  const emailHint = dominios.length > 0 ? `tu@${dominios[0]}` : 'tu@empresa.com';
  const dominiosLabel = dominios.map(d => `@${d}`).join(' o ');

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    setStatus('loading');

    try {
      let res, data;

      if (isDomainMode) {
        res = await fetch('/api/domain-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, empresa, dominio })
        });
        data = await res.json();

        if (res.status === 403 && data.error?.includes('exclusivo')) {
          setStatus('domain_mismatch');
          return;
        }
      } else {
        res = await fetch('/api/access-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed })
        });
        data = await res.json();

        if (res.status === 404 || data.code === 'not_found') {
          setStatus('not_found');
          return;
        }
      }

      if (res.status === 403) { setStatus('cancelled'); return; }
      if (!res.ok) { setStatus('error'); return; }

      if (data.completed) {
        setNombre(data.nombre || trimmed.split('@')[0]);
        setStatus('completed');
        return;
      }

      setParticipant({
        nombre:       data.nombre || trimmed.split('@')[0],
        email:        trimmed,
        empresa:      data.empresa || empresa,
        posicion:     data.posicion || '',
        departamento: data.departamento || '',
        token:        data.token
      });

      try {
        const progRes = await fetch(`/api/progress-get?token=${data.token}`);
        if (progRes.ok) {
          const prog = await progRes.json();
          if (prog.currentQuestion != null && prog.answers) {
            restoreProgress(prog.currentQuestion, prog.answers);
          }
        }
      } catch {}

      navigate('/assessment');

    } catch {
      setStatus('error');
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      <Navbar />

      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(254,60,28,0.06), transparent 55%)' }}
      />

      <div className="flex-1 flex items-center justify-center px-5 py-8 pt-[80px]">
        <div className="relative z-10 w-full max-w-[440px]">

          {/* ── idle / loading ── */}
          {(status === 'idle' || status === 'loading') && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col"
            >
              <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase mb-5 block">
                {empresa ? `${empresa.charAt(0).toUpperCase() + empresa.slice(1)} · Evaluación AIQ` : 'Evaluación AIQ'}
              </span>

              <h1 className="font-display text-[36px] md:text-[48px] leading-[0.95] text-[#111111] mb-4">
                Ingresa tu <span className="text-primary">correo</span>
              </h1>

              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] mb-8">
                {isDomainMode
                  ? `Usa tu correo corporativo ${dominiosLabel} para acceder al diagnóstico.`
                  : 'Usa el correo con el que fuiste registrado en esta evaluación.'}
              </p>

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                placeholder={emailHint}
                disabled={status === 'loading'}
                autoFocus
                className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-4 py-3 font-body text-[14px] text-[#111111] placeholder:text-[#AAAAAA] focus:outline-none focus:border-primary transition-colors disabled:bg-[#F7F7F7] disabled:text-[#AAAAAA] mb-4"
              />

              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={status === 'loading' || !email.trim()}
                className="w-full min-h-[48px]"
              >
                {status === 'loading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full"
                    />
                    Verificando...
                  </span>
                ) : 'Continuar →'}
              </Button>

              <p className="font-mono text-[9px] text-[#AAAAAA] text-center mt-4 uppercase tracking-wider">
                Sin registro · ~12 minutos · Confidencial
              </p>
            </motion.div>
          )}

          {/* ── completed ── */}
          {status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(0,170,85,0.1)] border border-[rgba(0,170,85,0.2)] flex items-center justify-center mb-5">
                <span className="text-[#00AA55] text-[20px] leading-none">✓</span>
              </div>
              <h2 className="font-display text-[28px] text-[#111111] mb-3">
                {nombre ? `Hola, ${nombre.split(' ')[0]}` : 'Ya completaste la evaluación'}
              </h2>
              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] mb-2">
                Tu evaluación AIQ ya fue registrada y está siendo procesada. No es posible realizarla nuevamente.
              </p>
              <p className="font-mono text-[10px] text-[#AAAAAA] uppercase tracking-wider mt-4">
                Si crees que esto es un error, contacta al administrador
              </p>
            </motion.div>
          )}

          {/* ── not_found ── */}
          {status === 'not_found' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(254,60,28,0.08)] border border-[rgba(254,60,28,0.2)] flex items-center justify-center mb-5">
                <span className="text-primary text-[20px] leading-none">!</span>
              </div>
              <h2 className="font-display text-[28px] text-[#111111] mb-3">Correo no registrado</h2>
              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] mb-6">
                No encontramos <strong className="text-[#111111] font-semibold">{email}</strong> en la lista de participantes. Verifica que sea el correo con el que te invitaron.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="font-mono text-[9px] uppercase tracking-wider px-5 py-2.5 border border-[#CCCCCC] rounded-[2px] text-[#555555] hover:border-primary hover:text-primary transition-colors"
              >
                ← Intentar con otro correo
              </button>
            </motion.div>
          )}

          {/* ── domain_mismatch ── */}
          {status === 'domain_mismatch' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(254,60,28,0.08)] border border-[rgba(254,60,28,0.2)] flex items-center justify-center mb-5">
                <span className="text-primary text-[20px] leading-none">!</span>
              </div>
              <h2 className="font-display text-[28px] text-[#111111] mb-3">Correo no válido</h2>
              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] mb-6">
                Este enlace es exclusivo para correos <strong className="text-[#111111] font-semibold">{dominiosLabel}</strong>. Usa tu correo corporativo para continuar.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="font-mono text-[9px] uppercase tracking-wider px-5 py-2.5 border border-[#CCCCCC] rounded-[2px] text-[#555555] hover:border-primary hover:text-primary transition-colors"
              >
                ← Usar otro correo
              </button>
            </motion.div>
          )}

          {/* ── cancelled ── */}
          {status === 'cancelled' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(254,60,28,0.08)] border border-[rgba(254,60,28,0.2)] flex items-center justify-center mb-5">
                <span className="text-primary text-[20px] leading-none">×</span>
              </div>
              <h2 className="font-display text-[28px] text-[#111111] mb-3">Acceso cancelado</h2>
              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6]">
                Tu acceso a esta evaluación fue cancelado. Contacta al administrador si crees que es un error.
              </p>
            </motion.div>
          )}

          {/* ── error ── */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(254,60,28,0.08)] border border-[rgba(254,60,28,0.2)] flex items-center justify-center mb-5">
                <span className="text-primary text-[20px] leading-none">!</span>
              </div>
              <h2 className="font-display text-[28px] text-[#111111] mb-3">Algo salió mal</h2>
              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] mb-6">
                Ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="font-mono text-[9px] uppercase tracking-wider px-5 py-2.5 border border-[#CCCCCC] rounded-[2px] text-[#555555] hover:border-primary hover:text-primary transition-colors"
              >
                ← Volver a intentar
              </button>
            </motion.div>
          )}

        </div>
      </div>

      <p className="text-center font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider pb-8">
        AI Pulse · Evaluación de madurez en IA
      </p>
    </div>
  );
}
