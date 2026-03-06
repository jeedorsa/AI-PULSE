import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from './Button';

interface NavbarProps {
  showBack?: boolean;
  progress?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ showBack = false, progress }) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 w-full h-[56px] z-50 bg-[rgba(8,8,8,0.96)] backdrop-blur-md border-b border-[#1a1a1a]">
      <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left Side */}
        <div className="flex items-center">
          {showBack ? (
            <button 
              onClick={() => navigate(-1)}
              className="text-g2 hover:text-white transition-colors duration-150 font-mono text-sm uppercase tracking-wider flex items-center gap-2"
            >
              ← Volver
            </button>
          ) : (
            <div className="font-display text-[22px] tracking-[3px] text-white select-none">
              AI <span className="text-primary">PULSE</span>
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="hidden md:block">
          <Button variant="ghost" className="text-[10px] uppercase tracking-widest h-8 px-4">
            Enterprise →
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {typeof progress === 'number' && (
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#1a1a1a]">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      )}
    </nav>
  );
};
