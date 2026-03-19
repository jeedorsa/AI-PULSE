import React from 'react';
import { motion } from 'motion/react';

interface AnswerCardProps {
  letter: string;
  text: string;
  selected: boolean;
  onClick: () => void;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ letter, text, selected, onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 4 }}
      className={`
        w-full flex items-start gap-3.5 px-[18px] py-[14px] rounded-[2px] text-left
        transition-all duration-150 ease-out relative
        ${selected 
          ? 'bg-[rgba(254,60,28,0.08)] border border-primary' 
          : 'bg-[#EFEFEF] border border-[#CCCCCC] hover:border-l-[3px] hover:border-l-primary'
        }
      `}
    >
      <span className={`font-display text-[20px] leading-none mt-0.5 ${selected ? 'text-primary' : 'text-[#AAAAAA]'}`}>
        {letter}
      </span>
      
      <span className={`font-body text-[12.5px] font-light leading-relaxed flex-1 ${selected ? 'text-[#E0E0E0]' : 'text-[#555555]'}`}>
        {text}
      </span>

      {selected && (
        <span className="text-primary text-[14px] font-bold absolute top-[14px] right-[14px]">
          ✓
        </span>
      )}
    </motion.button>
  );
};
