import React from 'react';
import { motion } from 'motion/react';

interface ChallengeCardProps {
  profile: string;
  levelName: string;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ profile, levelName }) => {
  
  const content: Record<string, { title: string; text: string }> = {
    'balanced': {
      title: `Eres un ${levelName}. Estás usando la IA con criterio real.`,
      text: "Tus tres secciones muestran consistencia. El siguiente paso no es saber más — es acelerar la ejecución y empezar a automatizar."
    },
    'technical_gap': {
      title: `Eres un ${levelName}. Tu prompting está adelantado a tu conocimiento técnico.`,
      text: "Sabes ejecutar, pero no siempre sabes por qué funciona. Esa brecha es tu mayor riesgo cuando la IA falle o cambie."
    },
    'knowledge_gap': {
      title: `Eres un ${levelName}. Entiendes los conceptos pero la ejecución te limita.`,
      text: "Tienes la teoría. Lo que falta es práctica deliberada en prompting real. La distancia entre entender y ejecutar es donde está el nivel siguiente."
    },
    'leader': {
      title: "Amplificador Estratégico. Eres parte del 5% superior en madurez de IA.",
      text: "Tu AIQ coloca a tu organización en posición de ventaja. El desafío ahora es escalar ese conocimiento — que no se quede contigo."
    }
  };

  const data = content[profile] || content['balanced']; // Fallback

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3.2, duration: 0.5 }}
      className="bg-[#161616] border border-[#2a2a2a] border-l-[3px] border-l-primary p-6 md:p-7 rounded-[2px] text-left w-full mx-auto"
    >
      <h3 className="font-body text-[15px] font-bold text-white mb-2">
        {data.title}
      </h3>
      <p className="font-body text-[12.5px] font-light text-[#B3B3B3] leading-[1.6]">
        {data.text}
      </p>
    </motion.div>
  );
};
