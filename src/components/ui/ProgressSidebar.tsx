import React from 'react';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../../store/useAssessmentStore';
import { questions } from '../../data/questions';

export const ProgressSidebar: React.FC = () => {
  const { currentQuestion } = useAssessmentStore();
  
  const totalQuestions = questions.length;
  const percentComplete = Math.round((currentQuestion / totalQuestions) * 100);
  const minutesRemaining = Math.max(1, Math.round(12 * (1 - currentQuestion / totalQuestions)));

  const sections = [
    { id: 'A', name: 'Escenarios', total: 5, weight: 40, desc: 'Evalúa tu capacidad de aplicar IA en situaciones reales.' },
    { id: 'B', name: 'Conocimiento', total: 6, weight: 25, desc: 'Mide tu comprensión técnica y gestión de riesgos.' },
    { id: 'C', name: 'Prompting', total: 5, weight: 35, desc: 'Analiza tu habilidad para comunicarte con la IA.' },
    { id: 'D', name: 'Organizacional', total: 8, weight: 0, desc: 'Contexto sobre el soporte de tu empresa.' },
    { id: 'GAPS', name: 'Cierre', total: 2, weight: 0, desc: 'Impacto y percepción final.' }
  ];

  // Helper to calculate progress per section
  const getSectionStatus = (sectionId: string) => {
    const sectionQuestions = questions.filter(q => q.section === sectionId);
    const firstIndex = questions.findIndex(q => q.section === sectionId);
    const lastIndex = firstIndex + sectionQuestions.length - 1;
    
    const completedCount = Math.max(0, Math.min(currentQuestion - firstIndex, sectionQuestions.length));
    
    if (currentQuestion > lastIndex) return 'completed';
    if (currentQuestion >= firstIndex && currentQuestion <= lastIndex) return 'active';
    return 'pending';
  };

  const getCompletedCount = (sectionId: string) => {
    const sectionQuestions = questions.filter(q => q.section === sectionId);
    const firstIndex = questions.findIndex(q => q.section === sectionId);
    const lastIndex = firstIndex + sectionQuestions.length - 1;
    
    if (currentQuestion > lastIndex) return sectionQuestions.length;
    if (currentQuestion < firstIndex) return 0;
    return currentQuestion - firstIndex;
  };

  const currentSectionData = sections.find(s => {
    const q = questions[currentQuestion];
    return q && q.section === s.id;
  });

  // Section C Checklist Logic
  const currentQuestionData = questions[currentQuestion];
  const isSectionC = currentQuestionData?.section === 'C';
  const currentAnswer = useAssessmentStore(state => state.answers[currentQuestionData?.id]);
  const chips = currentAnswer?.chips || { rol: false, contexto: false, formato: false, restricciones: false };

  return (
    <aside className="hidden md:flex flex-col gap-5 w-[280px] bg-[#F7F7F7] border-l border-[#E0E0E0] p-8 h-full fixed right-0 top-0 pt-[80px]">
      
      {/* Block 1: Total Progress */}
      <div>
        <div className="font-mono text-[8.5px] uppercase text-[#AAAAAA] mb-2.5 tracking-wider">
          Progreso total
        </div>
        <div className="w-full h-1 bg-[#1a1a1a] rounded-[1px] overflow-hidden">
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${percentComplete}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <div className="font-mono text-[9px] text-[#AAAAAA] mt-1.5">
          {percentComplete}% completado · ~{minutesRemaining}' restantes
        </div>
      </div>

      {/* Block 2: Sections */}
      <div>
        <div className="font-mono text-[8.5px] uppercase text-[#AAAAAA] mb-2.5 tracking-wider">
          Secciones
        </div>
        <div className="flex flex-col gap-2">
          {sections.map(section => {
            const status = getSectionStatus(section.id);
            const completed = getCompletedCount(section.id);
            
            return (
              <div 
                key={section.id}
                className={`
                  flex items-center gap-2.5 px-2.5 py-2 rounded-[2px] transition-all duration-300
                  ${status === 'active' ? 'bg-[rgba(254,60,28,0.08)]' : ''}
                  ${status === 'pending' ? 'opacity-40' : 'opacity-100'}
                  ${status === 'completed' ? 'opacity-50' : ''}
                `}
              >
                <span className={`font-display text-[16px] leading-none ${status === 'pending' ? 'text-[#AAAAAA]' : 'text-primary'}`}>
                  {section.id}
                </span>
                <span className={`font-body text-[10.5px] flex-1 ${status === 'active' ? 'font-medium text-[#555555]' : 'text-[#AAAAAA]'}`}>
                  {section.name}
                </span>
                <span className={`font-mono text-[9px] ${status === 'completed' ? 'text-primary' : 'text-[#AAAAAA]'}`}>
                  {completed}/{section.total} {status === 'completed' && '✓'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section C Extra Block: Checklist */}
      {isSectionC && currentQuestionData.type !== 'narrative' && (
        <div className="mt-4">
          <div className="font-mono text-[8.5px] uppercase text-[#AAAAAA] mb-2.5 tracking-wider">
            Elementos en tu prompt
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {[
              { id: 'rol', label: 'Rol asignado' },
              { id: 'contexto', label: 'Contexto específico' },
              { id: 'formato', label: 'Formato esperado' },
              { id: 'restricciones', label: 'Restricciones' }
            ].map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <span className={`text-[12px] ${chips[item.id as keyof typeof chips] ? 'text-[#00CC66]' : 'text-[#AAAAAA]'}`}>
                  {chips[item.id as keyof typeof chips] ? '✓' : '○'}
                </span>
                <span className={`font-body text-[11px] ${chips[item.id as keyof typeof chips] ? 'text-[#111111]' : 'text-[#666666]'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <div className="bg-[#EFEFEF] border border-[#CCCCCC] px-[10px] py-2 rounded-[2px]">
            <p className="font-mono text-[8px] text-[#AAAAAA] leading-[1.6]">
              El checklist orienta, no evalúa. Escribe con libertad.
            </p>
          </div>
        </div>
      )}

      {/* Block 3: Section Info */}
      {currentSectionData && !isSectionC && (
        <div className="mt-auto border-t border-[#E0E0E0] pt-4">
          <p className="font-mono text-[8.5px] text-[#AAAAAA] leading-[1.6] whitespace-pre-line">
            Sección {currentSectionData.id} · {currentSectionData.weight}% del AIQ final{'\n'}
            {currentSectionData.desc}
          </p>
        </div>
      )}

    </aside>
  );
};
