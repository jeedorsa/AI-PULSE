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
        <div className="font-mono text-[9px] text-[#4D4D4D] mb-2">
          Cuéntame cómo gestionas tus prompts
        </div>
        <textarea
          className="w-full bg-[#050505] border border-[#2a2a2a] rounded-[2px] p-4 text-[#B3B3B3] font-mono text-[11.5px] leading-[1.75] focus:border-primary outline-none resize-none min-h-[120px]"
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
      <div className={`
        bg-[#1e1e1e] border border-[#2a2a2a] border-l-[3px] border-l-primary 
        px-5 py-4 rounded-[2px] mb-5 transition-opacity duration-250
        ${isFocused ? 'md:opacity-100 opacity-10' : 'opacity-100'}
      `}>
        <div className="font-mono text-[8px] uppercase text-primary tracking-[0.2em] mb-2">
          Escenario {question.id}
        </div>
        <p className="font-body text-[13px] text-[#B3B3B3] leading-[1.6] font-normal">
          {question.scenarioText}
        </p>

        {/* C3 Special Case */}
        {question.originalPrompt && (
          <div className="bg-[#0a0a0a] border-l-2 border-[#2a2a2a] px-[14px] py-[10px] rounded-[2px] mt-2">
            <div className="font-mono text-[7.5px] text-[#4D4D4D] mb-1">
              PROMPT A MEJORAR
            </div>
            <p className="font-mono text-[10.5px] text-[#808080] italic leading-[1.6]">
              "{question.originalPrompt}"
            </p>
          </div>
        )}
      </div>

      {/* Guidance Chips */}
      <div className={`
        flex flex-wrap gap-[6px] mb-3 transition-opacity duration-250
        ${isFocused ? 'md:opacity-100 opacity-10' : 'opacity-100'}
      `}>
        {[
          { id: 'rol', label: '💡 Rol asignado' },
          { id: 'contexto', label: '💡 Contexto específico' },
          { id: 'formato', label: '💡 Formato esperado' },
          { id: 'restricciones', label: '💡 Restricciones' }
        ].map(chip => (
          <div
            key={chip.id}
            className={`
              font-mono text-[8.5px] px-2 py-[3px] rounded-[2px] border transition-all duration-200
              ${chips[chip.id as keyof typeof chips]
                ? 'bg-[rgba(0,200,100,0.06)] border-[rgba(0,200,100,0.15)] text-[#00CC66]'
                : 'bg-[#161616] border-[#1f1f1f] text-[#4D4D4D]'
              }
            `}
          >
            {chip.label}
          </div>
        ))}
      </div>

      {/* IDE Input */}
      <div className={`
        bg-[#050505] border rounded-[2px] p-4 relative transition-colors duration-200
        ${isFocused ? 'border-primary' : 'border-[#2a2a2a]'}
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
              className="w-full bg-transparent border-none outline-none resize-none font-mono text-[11.5px] text-[#B3B3B3] leading-[1.75] min-h-[120px] placeholder-[#2a2a2a]"
            />
            {/* Cursor visible if focused OR empty */}
            {(isFocused || !text) && (
               <span className="absolute pointer-events-none" style={{ 
                 left: text ? 'auto' : '0', // Simple positioning for empty state
                 top: text ? 'auto' : '0',
                 display: text && !isFocused ? 'none' : 'inline-block' // Hide if has text and not focused
               }}>
                 {/* 
                    Note: Positioning the cursor exactly at the end of text in a textarea is hard without a mirror div.
                    For this requirement "PromptCursor visible when textarea is in focus or empty",
                    we can just show it at the end if we had a mirror, or just rely on native cursor + custom block cursor at start?
                    The prompt says "PromptCursor... visible cuando el textarea está en focus o vacío".
                    Let's simplify: Show it only when empty as a placeholder cursor, or append it?
                    Actually, a blinking block cursor usually replaces the native caret. 
                    Since we can't easily replace native caret in textarea, let's just show it when empty.
                 */}
                 {!text && <PromptCursor />}
               </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#1a1a1a]">
          <span className="font-mono text-[9px] text-[#4D4D4D]">
            Incluye: rol · contexto · formato · restricciones
          </span>
          <span className="font-mono text-[10px] text-[#4D4D4D]">
            ⏱ {formatTime(elapsedTime)}
          </span>
        </div>
      </div>
    </div>
  );
};
