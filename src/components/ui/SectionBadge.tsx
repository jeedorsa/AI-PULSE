import React, { ReactNode } from 'react';

interface SectionBadgeProps {
  letter: 'A' | 'B' | 'C' | 'D';
  name: string;
  weight: number;
  rightSlot?: ReactNode;
}

export const SectionBadge: React.FC<SectionBadgeProps> = ({ letter, name, weight, rightSlot }) => {
  return (
    <div className="flex items-center justify-between w-full mb-4">
      <div className="font-mono text-[9px] tracking-[0.25em] text-primary uppercase">
        SECCIÓN {letter} · {name} · {weight}%
      </div>
      {rightSlot && (
        <div>
          {rightSlot}
        </div>
      )}
    </div>
  );
};
