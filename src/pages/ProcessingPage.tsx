import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';

const STEPS = [
  'Analizando respuestas...',
  'Calibrando niveles con IA...',
  'Calculando AIQ Score...',
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { gradeWithAI, calculateAIQ, aiqResult, gradingStatus } = useAssessmentStore();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (aiqResult) {
      navigate('/result', { replace: true });
      return;
    }

    const run = async () => {
      setStepIndex(0);
      await gradeWithAI();       // Gemini califica preguntas abiertas

      setStepIndex(1);
      await new Promise(r => setTimeout(r, 800));

      setStepIndex(2);
      calculateAIQ();            // Calcula el score final con los scores de Gemini
      await new Promise(r => setTimeout(r, 600));

      navigate('/result', { replace: true });
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-bk flex flex-col items-center justify-center p-8 relative overflow-hidden">
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

        <h2 className="font-display text-4xl mb-4 text-white tracking-wide">
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

        {gradingStatus === 'error' && (
          <p className="text-xs text-orange-400 mt-4 font-mono">
            Usando calificación local como respaldo
          </p>
        )}
      </div>
    </div>
  );
}
