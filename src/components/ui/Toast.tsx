import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, duration = 2500 }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 left-1/2 z-[200] bg-primary text-white px-4 py-2 rounded-[2px] shadow-lg whitespace-nowrap"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider">
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
