import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  pulsing?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', pulsing = false, fullWidth = false, children, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center font-body font-semibold text-[14px] transition-all duration-150 ease-out disabled:opacity-35 disabled:cursor-not-allowed rounded-[2px]";
    
    const variants = {
      primary: `
        bg-primary text-white px-8 py-[14px]
        hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(254,60,28,0.35)]
        active:scale-[0.98] active:bg-[#D43010]
      `,
      ghost: `
        bg-transparent border border-[#CCCCCC] text-[#555555] px-8 py-[14px]
        hover:border-primary hover:text-[#111111]
      `
    };

    const widthStyles = fullWidth ? "w-full" : "";
    const pulseStyles = pulsing ? "animate-custom-pulse" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${widthStyles} ${pulseStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
