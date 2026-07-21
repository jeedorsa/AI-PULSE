import React from 'react';
import { usePasteGuard, PASTE_BLOCKED_MESSAGE } from '../../hooks/usePasteGuard';
import { Toast } from '../ui/Toast';

interface OpenQuestionProps {
  question: any;
  value: any;
  onChange: (value: any) => void;
}

export const OpenQuestion: React.FC<OpenQuestionProps> = ({ question, value, onChange }) => {
  const { blocked, onPaste, clearBlocked } = usePasteGuard();

  return (
    <div className="w-full space-y-4">
      <textarea
        className="w-full h-48 bg-d2 border border-d3 rounded-xl p-4 text-[#111111] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-body text-lg"
        placeholder="Escribe tu respuesta aquí..."
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
      />
      <Toast message={PASTE_BLOCKED_MESSAGE} isVisible={blocked} onClose={clearBlocked} />
    </div>
  );
};
