import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AIQRing } from './AIQRing';

interface ScoreRingProps {
  score: number;
  level: string;
  levelName: string;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({ score, level, levelName }) => {
  const [displayedLevel, setDisplayedLevel] = useState('L1');
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    // Sequence
    // t=100ms: Ring appears (handled by parent or initial prop)
    
    // t=500ms: Counter animation
    const levels = ['L1', 'L2', 'L3', level];
    let step = 0;
    
    const interval = setInterval(() => {
      if (step < levels.length) {
        setDisplayedLevel(levels[step]);
        step++;
      } else {
        clearInterval(interval);
      }
    }, 120);

    setTimeout(() => {
      clearInterval(interval);
      setDisplayedLevel(level); // Ensure final value
    }, 500 + (levels.length * 120));

    // t=1400ms: Satisfaction bounce handled by motion prop below

    return () => clearInterval(interval);
  }, [level]);

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1, 1, 1.05, 1] }}
        transition={{ 
          duration: 1.4,
          times: [0, 0.4, 0.9, 1, 1], // 0->1 (600ms), wait, 1->1.05->1 (300ms at 1400ms)
          ease: "easeInOut"
        }}
      >
        <AIQRing 
          size={180} 
          label={displayedLevel} 
          sublabel="NIVEL AIQ" 
        />
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.4 }}
        className="font-display text-[36px] md:text-[52px] text-white leading-none mt-8 mb-2"
      >
        {levelName}
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.4 }}
        className="font-mono text-[13px] text-primary tracking-[0.2em]"
      >
        AIQ SCORE: {score.toFixed(2)} / 5.00
      </motion.div>
    </div>
  );
};
