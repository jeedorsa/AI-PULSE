import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';

export default function ProcessingPage() {
  const navigate = useNavigate();
  const { calculateAIQ, aiqResult } = useAssessmentStore();

  useEffect(() => {
    // If result already exists (e.g. back button), redirect immediately
    if (aiqResult) {
      navigate('/result', { replace: true });
      return;
    }

    // Otherwise, calculate and wait
    calculateAIQ();
    
    const timer = setTimeout(() => {
      navigate('/result', { replace: true });
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [navigate, calculateAIQ, aiqResult]);

  return (
    <div className="min-h-screen bg-bk flex flex-col items-center justify-center p-8 relative overflow-hidden">
       {/* Background Effects */}
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="flex flex-col items-center z-10">
        <div className="relative w-24 h-24 mb-8">
          <motion.div 
            className="absolute inset-0 border-4 border-d3 rounded-full" 
          />
          <motion.div 
            className="absolute inset-0 border-t-4 border-primary rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
        
        <h2 className="font-display text-4xl mb-4 text-white tracking-wide">ANALIZANDO RESPUESTAS</h2>
        <motion.p 
          className="text-g2 font-mono text-sm"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Calculando AIQ Score...
        </motion.p>
      </div>
    </div>
  );
}
