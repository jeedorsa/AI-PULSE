import React from 'react';

interface AIQRingProps {
  size?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export const AIQRing: React.FC<AIQRingProps> = ({ 
  size = 180, 
  label = "AIQ", 
  sublabel = "Tu métrica\nde madurez",
  className = ''
}) => {
  // Calculate relative sizes based on the prop size to maintain proportions
  const centerSize = size - 40; // inset 20px means 40px total reduction
  const labelSize = size / 2.6;
  
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Animated SVG Rings */}
      <svg 
        className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none"
        viewBox="0 0 200 200"
      >
        {/* Outer dashed ring */}
        <circle 
          cx="100" cy="100" r="95" 
          fill="none" 
          stroke="var(--color-primary)" 
          strokeWidth="1" 
          strokeDasharray="6 6" 
          opacity="0.3" 
        />
        {/* Inner solid ring */}
        <circle 
          cx="100" cy="100" r="82" 
          fill="none" 
          stroke="var(--color-primary)" 
          strokeWidth="0.5" 
          opacity="0.15" 
        />
      </svg>

      {/* Central Content */}
      <div 
        className="absolute flex flex-col items-center justify-center z-10 overflow-hidden"
        style={{
          width: centerSize,
          height: centerSize,
          borderRadius: '50%',
          backgroundColor: 'rgba(254,60,28,0.08)',
          border: '1px solid rgba(254,60,28,0.4)'
        }}
      >
        <span 
          className="font-display text-primary leading-none"
          style={{ fontSize: `${labelSize}px` }}
        >
          {label}
        </span>
        <span 
          className="font-mono text-[#808080] text-center uppercase tracking-[0.15em] whitespace-pre-line mt-1"
          style={{ fontSize: '9px', lineHeight: '1.4' }}
        >
          {sublabel}
        </span>
      </div>
    </div>
  );
};
