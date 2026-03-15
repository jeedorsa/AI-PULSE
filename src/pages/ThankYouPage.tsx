import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';
import { Navbar } from '../components/ui/Navbar';
import { AIQRing } from '../components/ui/AIQRing';

export default function ThankYouPage() {
  const navigate = useNavigate();
  const { participant, userRole } = useAssessmentStore();

  useEffect(() => {
    if (!userRole && !participant) {
      navigate('/', { replace: true });
    }
  }, [userRole, participant, navigate]);

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col relative overflow-hidden">
      <Navbar />

      {/* Glow Background */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(254,60,28,0.07), transparent 55%)'
        }}
      />

      <div className="flex-1 flex items-center justify-center px-5 py-8 pt-[80px]">
        <div className="relative z-10 w-full max-w-[540px] flex flex-col items-center text-center">

          {/* Animated Check */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mb-8"
          >
            <AIQRing size={120} label="OK" sublabel="Completado" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="font-display text-[36px] md:text-[48px] leading-[0.95] text-white mb-4"
          >
            {participant ? (
              <>Gracias, <span className="text-primary">{participant.nombre.split(' ')[0]}</span></>
            ) : (
              <>Gracias por <span className="text-primary">participar</span></>
            )}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="font-body text-[16px] font-light text-[#B3B3B3] leading-[1.6] mb-8 max-w-[420px]"
          >
            Tus respuestas han sido registradas exitosamente. Los resultados seran procesados y compartidos por el equipo a cargo del diagnostico.
          </motion.p>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="w-full bg-[#0f0f0f] border border-[#1f1f1f] rounded-[2px] p-6 mb-6"
          >
            <div className="flex items-start gap-3">
              <span className="text-primary text-[18px] mt-0.5">i</span>
              <div className="text-left">
                <p className="font-body text-[13px] font-semibold text-white mb-1">
                  Que sigue?
                </p>
                <p className="font-body text-[12px] font-light text-[#808080] leading-[1.6]">
                  El equipo de AI Pulse analizara todas las respuestas del diagnostico y te compartira los resultados una vez que el proceso haya concluido. Ya puedes cerrar esta ventana.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="flex items-center gap-2"
          >
            <div className="w-[6px] h-[6px] rounded-full bg-[#00CC66]" />
            <span className="font-mono text-[9px] text-[#4D4D4D] uppercase tracking-wider">
              Respuestas registradas correctamente
            </span>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
