import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAssessmentStore } from '../store/useAssessmentStore';

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

  // Si viene con dominio en la URL, lo mostramos como hint
  const emailHint = dominio ? `tu@${dominio}` : 'tu@empresa.com';

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    setStatus('loading');

    try {
      let res, data;

      if (isDomainMode) {
        // Modo dominio abierto — usa domain-register
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
        // Modo whitelist — usa access-request
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

      if (res.status === 403) {
        setStatus('cancelled');
        return;
      }

      if (!res.ok) {
        setStatus('error');
        return;
      }

      // Ya completó — bloquear
      if (data.completed) {
        setNombre(data.nombre || trimmed.split('@')[0]);
        setStatus('completed');
        return;
      }

      // Éxito — configurar store y navegar
      setParticipant({
        nombre:       data.nombre || trimmed.split('@')[0],
        email:        trimmed,
        empresa:      data.empresa || empresa,
        posicion:     data.posicion || '',
        departamento: data.departamento || '',
        token:        data.token
      });

      // Intentar restaurar progreso si existe
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">

      {/* Logo / marca */}
      <div className="mb-10 text-center">
        <p className="text-xs tracking-[0.2em] uppercase text-gray-400 mb-1">AI Pulse</p>
        <h1 className="text-2xl font-black text-gray-900">Evaluación AIQ</h1>
        {empresa && (
          <p className="mt-1 text-sm text-gray-500">Acceso exclusivo · {empresa.charAt(0).toUpperCase() + empresa.slice(1)}</p>
        )}
      </div>

      {/* Card */}
      <div className="w-full max-w-md">

        {/* ── Estado: idle / loading ── */}
        {(status === 'idle' || status === 'loading') && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Ingresa tu correo</h2>
            <p className="text-sm text-gray-500 mb-6">
              {isDomainMode
                ? `Usa tu correo corporativo @${dominio} para acceder.`
                : 'Usa el correo con el que fuiste registrado en esta evaluación.'}
            </p>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              placeholder={emailHint}
              disabled={status === 'loading'}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4 disabled:bg-gray-50 disabled:text-gray-400"
              autoFocus
            />

            <button
              onClick={handleSubmit}
              disabled={status === 'loading' || !email.trim()}
              className="w-full bg-[#E63946] text-white font-semibold rounded-xl py-3 text-sm hover:bg-[#c42d39] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Verificando...
                </span>
              ) : 'Continuar →'}
            </button>
          </div>
        )}

        {/* ── Estado: completed (ya hizo la prueba) ── */}
        {status === 'completed' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {nombre ? `¡Hola, ${nombre.split(' ')[0]}!` : '¡Ya completaste la evaluación!'}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tu evaluación AIQ ya fue registrada y está siendo procesada. No es posible realizarla nuevamente.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Si crees que esto es un error, contacta al administrador de la evaluación.
            </p>
          </div>
        )}

        {/* ── Estado: not_found ── */}
        {status === 'not_found' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">Correo no registrado</h2>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              No encontramos <strong className="text-gray-700">{email}</strong> en la lista de participantes. Verifica que sea el correo con el que te invitaron.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="w-full border border-gray-300 text-gray-700 font-medium rounded-xl py-3 text-sm hover:bg-gray-50 transition-colors"
            >
              ← Intentar con otro correo
            </button>
          </div>
        )}

        {/* ── Estado: domain_mismatch ── */}
        {status === 'domain_mismatch' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2 text-center">Correo no válido</h2>
            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              Este enlace es exclusivo para personas con correo <strong className="text-gray-700">@{dominio}</strong>. Usa tu correo corporativo para continuar.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="w-full border border-gray-300 text-gray-700 font-medium rounded-xl py-3 text-sm hover:bg-gray-50 transition-colors"
            >
              ← Usar otro correo
            </button>
          </div>
        )}

        {/* ── Estado: cancelled ── */}
        {status === 'cancelled' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
            <p className="text-sm text-gray-500 leading-relaxed">
              Tu acceso a esta evaluación fue cancelado. Contacta al administrador si crees que es un error.
            </p>
          </div>
        )}

        {/* ── Estado: error ── */}
        {status === 'error' && (
          <div className="bg-white border border-red-200 rounded-2xl p-8 shadow-sm">
            <p className="text-sm text-red-600 text-center mb-4">
              Ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="w-full border border-gray-300 text-gray-700 font-medium rounded-xl py-3 text-sm hover:bg-gray-50 transition-colors"
            >
              ← Volver a intentar
            </button>
          </div>
        )}

      </div>

      {/* Footer */}
      <p className="mt-10 text-xs text-gray-400">
        AI Pulse · Evaluación de madurez en IA
      </p>
    </div>
  );
}
