import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';

const STEPS = [
  'Analizando respuestas...',
  'Calculando AIQ Score...',
  'Preparando resultados...',
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { calculateAIQ, aiqResult, isAdmin, participant } = useAssessmentStore();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    // Regular participants (token-based) never see results
    if (participant && !isAdmin) {
      // Just calculate silently and redirect to thank-you
      try { calculateAIQ(); } catch (_) {}
      navigate('/thank-you', { replace: true });
      return;
    }

    if (aiqResult) {
      navigate('/result', { replace: true });
      return;
    }

    const run = async () => {
      try {
        setStepIndex(0);
        await new Promise(r => setTimeout(r, 1000));

        setStepIndex(1);
        calculateAIQ(); // scoring local — siempre funciona
        await new Promise(r => setTimeout(r, 1000));

        setStepIndex(2);
        await new Promise(r => setTimeout(r, 600));

        // Token-based participants go to thank-you, everyone else sees results
        if (participant && !isAdmin) {
          navigate('/thank-you', { replace: true });
        } else {
          navigate('/result', { replace: true });
        }
      } catch (err) {
        console.error('ProcessingPage error:', err);
        // Aun si algo falla, intentar calcular y navegar
        try { calculateAIQ(); } catch (_) {}
        if (participant && !isAdmin) {
          navigate('/thank-you', { replace: true });
        } else {
          navigate('/result', { replace: true });
        }
      }
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex flex-col items-center z-10">
        <div className="relative w-24 h-24 mb-8">
          <motion.div className="absolute inset-0 border-4 border-d3 rounded-full" />
          <motion.div
            className="absolute inset-0 border-t-4 border-primary rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        <h2 className="font-display text-4xl mb-4 text-[#111111] tracking-wide">
          ANALIZANDO RESPUESTAS
        </h2>

        <motion.p
          key={stepIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-g2 font-mono text-sm"
        >
          {STEPS[stepIndex]}
        </motion.p>
      </div>
    </div>
  );
}
