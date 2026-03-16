import React from 'react';
import { motion } from 'motion/react';

interface SectionBarsProps {
  sectionScores: Record<string, { score: number; level: string }>;
  alerts: string[];
}

export const SectionBars: React.FC<SectionBarsProps> = ({ sectionScores, alerts }) => {
  const sections = ['A', 'B', 'C'];
  
  // Find lowest score to check for alert coloring
  const scores = sections.map(id => sectionScores[id]?.score || 0);
  const minScore = Math.min(...scores);

  return (
    <div className="w-full max-w-[500px] mx-auto my-8 flex flex-col gap-3">
      {sections.map((id, index) => {
        const data = sectionScores[id];
        if (!data) return null;

        const percent = Math.max(0, ((data.score - 1) / 4) * 100);
        const isLowest = data.score === minScore;
        const hasAlert = alerts.length > 0; // Simplified check, prompt says "Si hay alerta"
        const isCritical = isLowest && hasAlert;

        return (
          <motion.div 
            key={id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 + (index * 0.2) }}
            className="grid grid-cols-[20px_1fr_80px] items-center gap-3"
          >
            <span className="font-display text-[20px] text-[#4D4D4D] leading-none">
              {id}
            </span>
            
            <div className="h-[5px] bg-[#1a1a1a] rounded-[3px] overflow-hidden w-full">
              <motion.div 
                className={`h-full ${isCritical ? 'bg-[#F30302]' : 'bg-primary'}`}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1.2, delay: 2.4 + (index * 0.2), ease: "easeOut" }}
              />
            </div>

            {/* Solución al error "Cannot read properties of undefined" */}
            <span className={`font-mono text-[10px] text-right ${isCritical ? 'text-[#F30302]' : 'text-[#808080]'}`}>
              {data?.level || 'N/A'} · {(data?.score || 0).toFixed(1)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};
