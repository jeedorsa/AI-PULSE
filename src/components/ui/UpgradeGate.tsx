import React from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { useNavigate } from 'react-router-dom';

interface UpgradeGateProps {
  level: string;
  levelName: string;
}

export const UpgradeGate: React.FC<UpgradeGateProps> = ({ level, levelName }) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    alert("Próximamente disponible");
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 4.0, duration: 0.5 }}
      className="w-full max-w-[640px] mx-auto mt-6"
    >
      {/* Dashed Separator */}
      <div className="border-t border-dashed border-[#2a2a2a] mb-6" />

      {/* Main Gate Card */}
      <div className="bg-[#161616] border border-[rgba(254,60,28,0.2)] p-7 rounded-[2px] text-left">
        <div className="font-mono text-[9px] tracking-[0.3em] text-primary uppercase mb-3">
          Individual Pro — Tu hoja de ruta completa
        </div>
        
        <p className="font-body text-[13px] text-[#B3B3B3] leading-[1.6] mb-4">
          Tu AIQ es {level} — {levelName}. El reporte completo incluye tu plan de acción semana a semana hacia el siguiente nivel.
        </p>

        {/* Blur Preview */}
        <div className="bg-[#0a0a0a] p-4 rounded-[2px] mb-4 relative overflow-hidden select-none">
          <div className="font-mono text-[10px] text-[#808080] leading-[1.8] blur-[3px]">
            SEMANA 1: FUNDAMENTOS TÉCNICOS<br/>
            - Acción 1: Revisar configuración de privacidad<br/>
            - Acción 2: Establecer banco de prompts base<br/>
            SEMANA 2: OPTIMIZACIÓN DE FLUJO<br/>
            - Acción 1: Automatizar reporte semanal<br/>
            ...
          </div>
          <div 
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(10,10,10,0) 40%, rgba(10,10,10,0.8))' }}
          />
        </div>

        <Button variant="primary" fullWidth onClick={handleUpgrade}>
          Ver mi plan de acción completo →
        </Button>
      </div>

      {/* Enterprise Bridge */}
      <div className="mt-[3px] bg-[#0f0f0f] border border-[#1f1f1f] p-5 md:p-6 rounded-[2px] flex flex-col md:flex-row items-center gap-5 text-left">
        <span className="text-[24px] flex-shrink-0">🏢</span>
        <div className="flex-1">
          <div className="font-body text-[12px] font-bold text-white mb-1">
            ¿Tu equipo también debería conocer su AIQ?
          </div>
          <div className="font-body text-[11px] text-[#808080]">
            El diagnóstico Enterprise mapea las brechas organizacionales.
          </div>
        </div>
        <Button variant="ghost" className="whitespace-nowrap" onClick={() => navigate('/gate?type=enterprise')}>
          Diagnóstico Enterprise →
        </Button>
      </div>
    </motion.div>
  );
};
