import React, { useState, useEffect, useRef } from 'react';
import { PromptCursor } from '../ui/PromptCursor';
import { useAssessmentStore } from '../../store/useAssessmentStore';

interface PromptingIDEProps {
  question: any;
  value: any;
  onChange: (val: any) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export const PromptingIDE: React.FC<PromptingIDEProps> = ({ question, value, onChange, onFocusChange }) => {
  const [text, setText] = useState(value?.text || '');
  const [isFocused, setIsFocused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chips state
  const [chips, setChips] = useState({
    rol: false,
    contexto: false,
    formato: false,
    restricciones: false
  });

  // Timer logic
  useEffect(() => {
    if (isFocused && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (!isFocused && timerRef.current) {
      // Don't clear timer on blur, just stop counting? 
      // Requirement says "counts up since user focuses". Usually implies continuous or cumulative.
      // Let's keep it running if started, or pause? "Para cuando hace click en Enviar".
      // Let's pause on blur to be safe, or keep running. "Timer elapsed" usually means total time spent.
      // Let's keep it simple: start on first focus, keep running until unmount or submit.
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isFocused]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [text]);

  // Analysis Logic (Debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const lowerText = text.toLowerCase();
      
      const newChips = {
        rol: /actúa como|eres|como si fueras|soy|en tu rol de/.test(lowerText),
        contexto: text.length > 80 && /\d+|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|202\d/.test(lowerText), // Basic check for digits or months/years as proxy for "specific details"
        formato: /formato|párrafo|lista|bullet|email|asunto|tabla/.test(lowerText),
        restricciones: /no menciones|evita|sin|máximo|mínimo|solo|únicamente/.test(lowerText)
      };

      setChips(newChips);

      // Calculate Score (1-5)
      let score = 1;
      const activeChips = Object.values(newChips).filter(Boolean).length;

      if (text.length === 0 || text.length < 20) {
        score = 1;
      } else if (text.length >= 20 && activeChips < 1) {
        score = 2;
      } else if (activeChips >= 1 && activeChips <= 2) {
        score = 3;
      } else if (activeChips === 3) {
        score = 4;
      } else if (activeChips === 4 && text.length >= 150) {
        score = 5;
      }

      // Update store with text and calculated score
      // We store the full object as the answer
      onChange({ text, score, chips: newChips, time: elapsedTime });

    }, 800);

    return () => clearTimeout(timer);
  }, [text, elapsedTime, onChange]);

  const formatTime = (seconds: number) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange?.(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onFocusChange?.(false);
  };

  // Special case for C5 (Narrative)
  if (question.type === 'narrative') {
    return (
      <div className="w-full">
        <div className="font-mono text-[9px] text-[#AAAAAA] mb-2">
          Cuéntame cómo gestionas tus prompts
        </div>
        <textarea
          className="w-full bg-[#050505] border border-[#CCCCCC] rounded-[2px] p-4 text-[#555555] font-mono text-[11.5px] leading-[1.75] focus:border-primary outline-none resize-none min-h-[120px]"
          placeholder="Describe tu sistema de organización, si tienes uno..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Scenario Card */}
      <div className="bg-[#E5E5E5] border border-[#CCCCCC] border-l-[3px] border-l-primary px-5 py-4 rounded-[2px] mb-5">
        <div className="font-mono text-[8px] uppercase text-primary tracking-[0.2em] mb-2">
          Escenario {question.id}
        </div>
        <p className="font-body text-[13px] text-[#555555] leading-[1.6] font-normal">
          {question.scenarioText}
        </p>

        {/* C3 Special Case */}
        {question.originalPrompt && (
          <div className="bg-[#0a0a0a] border-l-2 border-[#CCCCCC] px-[14px] py-[10px] rounded-[2px] mt-2">
            <div className="font-mono text-[7.5px] text-[#AAAAAA] mb-1">
              PROMPT A MEJORAR
            </div>
            <p className="font-mono text-[10.5px] text-[#666666] italic leading-[1.6]">
              "{question.originalPrompt}"
            </p>
          </div>
        )}
      </div>

      {/* IDE Input */}
      <div className={`
        bg-[#050505] border rounded-[2px] p-4 relative transition-colors duration-200
        ${isFocused ? 'border-primary' : 'border-[#CCCCCC]'}
      `}>
        <div className="flex items-start">
          <span className="text-primary mr-2 font-mono text-[11.5px] mt-[2px]">{'>'}</span>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Escribe tu prompt aquí..."
              className="w-full bg-transparent border-none outline-none resize-none font-mono text-base md:text-[11.5px] text-[#CCCCCC] leading-[1.75] min-h-[140px] placeholder-[#555555]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#222222] gap-2">
          <span className="font-mono text-[9px] text-[#555555] hidden md:block">
            Incluye: rol · contexto · formato · restricciones
          </span>
          <span className="font-mono text-[9px] text-[#555555] md:hidden">
            rol · contexto · formato · restricciones
          </span>
          <span className="font-mono text-[10px] text-[#555555] shrink-0">
            ⏱ {formatTime(elapsedTime)}
          </span>
        </div>
      </div>
    </div>
  );
};
