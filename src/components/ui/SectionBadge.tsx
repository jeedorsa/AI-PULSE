import React from 'react';

interface SectionBadgeProps {
  letter: string;
  name: string;
  weight: number;
  rightSlot?: React.ReactNode;
}

export const SectionBadge: React.FC<SectionBadgeProps> = ({ letter, name, weight }) => {
  return (
    <div className="flex items-center w-full mb-4">
      <div className="font-mono text-[9px] tracking-[0.25em] text-primary uppercase">
        {name}{weight > 0 ? ` · ${weight}%` : ''}
      </div>
    </div>
  );
};
