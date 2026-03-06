import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

interface PromptInputProps {
  question: any;
  value: any; // { text: string, score: number, detected: string[] }
  onChange: (value: any) => void;
}

export const PromptInputQuestion: React.FC<PromptInputProps> = ({ question, value, onChange }) => {
  const [text, setText] = useState(value?.text || '');
  const [activeChips, setActiveChips] = useState<string[]>(value?.detected || []);

  // Debounce analysis
  useEffect(() => {
    const timer = setTimeout(() => {
      analyzePrompt(text);
    }, 800);
    return () => clearTimeout(timer);
  }, [text]);

  const analyzePrompt = (inputText: string) => {
    const lowerText = inputText.toLowerCase();
    const detected: string[] = [];

    // ROL
    if (["actúa como", "eres un", "como si fueras", "en tu rol de", "como experto"].some(k => lowerText.includes(k))) {
      detected.push('ROL');
    }

    // CONTEXTO (length + digits/specifics)
    if (inputText.length >= 80 && (/\d/.test(inputText) || ["cliente", "retraso", "ventas", "trimestre", "producto"].some(k => lowerText.includes(k)))) {
      detected.push('CONTEXTO');
    }

    // FORMATO
    if (["formato", "párrafo", "lista", "email", "tabla", "longitud", "secciones", "corta", "visual"].some(k => lowerText.includes(k))) {
      detected.push('FORMATO');
    }

    // RESTRICCIONES
    if (["no menciones", "evita", "sin", "máximo", "mínimo", "solo", "únicamente"].some(k => lowerText.includes(k))) {
      detected.push('RESTRICCIONES');
    }

    setActiveChips(detected);

    // Calculate Score
    let score = 1;
    if (inputText.length < 20) score = 1;
    else if (detected.length === 0) score = 2;
    else if (detected.length <= 2) score = 3;
    else if (detected.length === 3) score = 4;
    else if (detected.length === 4 && inputText.length >= 150) score = 5;
    else if (detected.length === 4) score = 4;

    onChange({ text: inputText, score, detected });
  };

  const handleTextChange = (val: string) => {
    setText(val);
    // Immediate update for text, analysis is debounced
    onChange({ ...value, text: val });
  };

  const chips = [
    { id: 'ROL', label: 'Rol / Persona' },
    { id: 'CONTEXTO', label: 'Contexto' },
    { id: 'FORMATO', label: 'Formato' },
    { id: 'RESTRICCIONES', label: 'Restricciones' },
  ];

  return (
    <div className="w-full space-y-6">
      {question.scenarioText && (
        <div className="bg-d2 border border-d3 p-6 rounded-xl text-g2 italic">
          <span className="font-bold text-primary not-italic block mb-2 text-sm uppercase tracking-wider">Escenario</span>
          {question.scenarioText}
        </div>
      )}

      <div className="relative">
        <textarea
          className="w-full h-64 bg-d1 border border-d3 rounded-xl p-6 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none font-mono text-sm leading-relaxed"
          placeholder="Escribe tu prompt aquí..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
        
        <div className="absolute bottom-4 right-4 flex gap-2">
           {/* Real-time feedback chips */}
           {chips.map(chip => (
             <motion.div
               key={chip.id}
               initial={false}
               animate={{ 
                 backgroundColor: activeChips.includes(chip.id) ? 'rgba(254,60,28,0.2)' : 'rgba(30,30,30,0.5)',
                 borderColor: activeChips.includes(chip.id) ? '#FE3C1C' : '#4D4D4D',
                 color: activeChips.includes(chip.id) ? '#FE3C1C' : '#808080'
               }}
               className="px-3 py-1 rounded-full text-xs font-bold border border-transparent transition-colors"
             >
               {chip.label}
             </motion.div>
           ))}
        </div>
      </div>
      
      {question.originalPrompt && (
        <div className="text-sm text-g3">
          <span className="font-bold">Prompt original:</span> "{question.originalPrompt}"
        </div>
      )}
    </div>
  );
};
