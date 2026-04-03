import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';

const STEPS = [
  { label: 'Procesando respuestas...', duration: 500 },
  { label: 'Evaluando con framework AIQ...', duration: null }, // espera al API
  { label: 'Aplicando reglas de calibración...', duration: 800 },
  { label: 'Generando perfil de madurez...', duration: 600 },
];

export default function ProcessingPage() {
  const navigate  = useNavigate();
  const { gradeWithAI, calculateAIQ, aiqResult, isAdmin, participant, gradingStatus } = useAssessmentStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Si ya tenemos resultado (recarga), ir directo
    if (aiqResult) {
      navigate(participant && !isAdmin ? '/thank-you' : '/result', { replace: true });
      return;
    }

    const run = async () => {
      try {
        // Paso 0 — breve pausa visual
        setStepIndex(0);
        await sleep(STEPS[0].duration!);

        // Paso 1 — Grading real con el framework AIQ (llama al API para TODAS las preguntas)
        setStepIndex(1);
        await gradeWithAI();
        // Si el grading falló, gradeWithAI pone gradingStatus='error' pero no lanza,
        // así que calculateAIQ usará los scores locales de fallback — aceptable.

        // Paso 2 — Aplicar fórmula + reglas 1-4
        setStepIndex(2);
        await sleep(STEPS[2].duration!);
        calculateAIQ();

        // Paso 3 — Breve pausa final
        setStepIndex(3);
        await sleep(STEPS[3].duration!);

        // Participantes enterprise → thank-you (no ven su resultado)
        // Modo demo / admin → result
        navigate(
          participant && !isAdmin ? '/thank-you' : '/result',
          { replace: true }
        );

      } catch (err) {
        console.error('ProcessingPage error:', err);
        setErrorMsg('Ocurrió un error al procesar. Intentando calcular de todas formas...');
        // Fallback: calcular con lo que hay
        try { calculateAIQ(); } catch (_) {}
        await sleep(1500);
        navigate(
          participant && !isAdmin ? '/thank-you' : '/result',
          { replace: true }
        );
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Glow de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex flex-col items-center z-10 max-w-sm text-center">
        {/* Spinner */}
        <div className="relative w-24 h-24 mb-8">
          <motion.div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
          <motion.div
            className="absolute inset-0 border-t-4 border-[#E63946] rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          {/* Icono central que cambia por paso */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              key={stepIndex}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl"
            >
              {['📊', '🔍', '⚖️', '✨'][stepIndex] || '📊'}
            </motion.span>
          </div>
        </div>

        <h2 className="font-bold text-2xl mb-3 text-gray-900 tracking-tight">
          ANALIZANDO RESPUESTAS
        </h2>

        {/* Paso actual */}
        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-gray-500 text-sm font-mono mb-6"
        >
          {STEPS[stepIndex]?.label}
        </motion.p>

        {/* Barra de progreso */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
          <motion.div
            className="bg-[#E63946] h-1.5 rounded-full"
            initial={{ width: '5%' }}
            animate={{ width: `${Math.round(((stepIndex + 1) / STEPS.length) * 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Pasos como bullets */}
        <div className="w-full space-y-2">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                i < stepIndex  ? 'bg-green-500' :
                i === stepIndex ? 'bg-[#E63946]' :
                'bg-gray-200'
              }`}>
                {i < stepIndex && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className={`text-xs transition-colors duration-300 ${
                i < stepIndex  ? 'text-green-600' :
                i === stepIndex ? 'text-gray-900 font-medium' :
                'text-gray-400'
              }`}>
                {step.label}
              </p>
            </div>
          ))}
        </div>

        {/* Error no bloqueante */}
        {errorMsg && (
          <p className="mt-4 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        {/* Nota de grading status si hay error de API */}
        {gradingStatus === 'error' && !errorMsg && (
          <p className="mt-4 text-xs text-gray-400">
            Usando evaluación local como respaldo
          </p>
        )}
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
