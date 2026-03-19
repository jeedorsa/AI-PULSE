import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';
import { questions } from '../data/questions';
import { Button } from '../components/ui/Button';
import { Navbar } from '../components/ui/Navbar';
import { SectionBadge } from '../components/ui/SectionBadge';
import { AnswerCard } from '../components/ui/AnswerCard';
import { ProgressSidebar } from '../components/ui/ProgressSidebar';

// Question Components
import { OpenQuestion } from '../components/question-types/OpenQuestion';
import { MixedScaleQuestion } from '../components/question-types/MixedScaleQuestion';
import { MixedMultiQuestion } from '../components/question-types/MixedMultiQuestion';
import { MixedConditionalQuestion } from '../components/question-types/MixedConditionalQuestion';
import { PromptInputQuestion } from '../components/question-types/PromptInputQuestion';
import { MixedDynamicQuestion } from '../components/question-types/MixedDynamicQuestion';
import { PromptingIDE } from '../components/question-types/PromptingIDE';
import { useState } from 'react';

export default function AssessmentPage() {
  const navigate = useNavigate();
  const { currentQuestion, answers, answerQuestion, nextQuestion, userRole, participant } = useAssessmentStore();
  const [isIdeFocused, setIsIdeFocused] = useState(false);
  
  const question = questions[currentQuestion];
  const currentAnswer = answers[question?.id];

  // Safety check: allow access if user has role (legacy) OR has a verified participant token
  useEffect(() => {
    if (!userRole && !participant) {
      navigate('/', { replace: true });
      return;
    }
    if (!question) {
      navigate('/');
    }
  }, [question, userRole, participant, navigate]);

  if (!question || (!userRole && !participant)) return null;

  const handleNext = () => {
    const nextIdx = currentQuestion + 1;
    
    // Check if finished
    if (nextIdx >= questions.length) {
      // calculateAIQ(); // Moved to ProcessingPage
      navigate('/processing');
      return;
    }

    const nextQ = questions[nextIdx];
    
    // Check for section change
    if (nextQ.section !== question.section) {
      // Navigate to checkpoint
      nextQuestion(); // Advance index so when we return we are at next Q
      navigate(`/checkpoint/${question.section}`); // Pass COMPLETED section
    } else {
      nextQuestion();
    }
  };

  const isAnswered = () => {
    const val = answers[question.id];
    if (!val) return false;
    
    if (question.type === 'open') return typeof val === 'string' ? val.length > 0 : val?.text?.length > 0;
    if (question.type === 'narrative') return typeof val === 'string' ? val.length > 0 : val?.text?.length > 0;
    if (question.type === 'mixed_scale') return val.value !== undefined;
    if (question.type === 'mixed_multi') return val.selected?.length > 0;
    if (question.type === 'mixed_conditional') return val.choice !== undefined;
    if (question.type === 'prompt_input') return val.text?.length > 0;
    if (question.type === 'mixed_dynamic') return val.selected?.length > 0;
    
    return true;
  };

  const renderQuestionInput = () => {
    const commonProps = {
      question,
      value: currentAnswer,
      onChange: (val: any) => answerQuestion(question.id, val)
    };

    // Special handling for Section C (Prompting)
    if (question.section === 'C') {
      return (
        <PromptingIDE 
          {...commonProps} 
          onFocusChange={setIsIdeFocused}
        />
      );
    }

    switch (question.type) {
      case 'open':
      case 'narrative':
        return <OpenQuestion {...commonProps} />;
      case 'mixed_scale':
        return <MixedScaleQuestion {...commonProps} />;
      case 'mixed_multi':
        return <MixedMultiQuestion {...commonProps} />;
      case 'mixed_conditional':
        return <MixedConditionalQuestion {...commonProps} />;
      case 'prompt_input':
        return <PromptInputQuestion {...commonProps} />;
      case 'mixed_dynamic':
        return <MixedDynamicQuestion {...commonProps} />;
      default:
        return <div className="text-red-500">Unknown question type: {question.type}</div>;
    }
  };

  const percentComplete = Math.round((currentQuestion / questions.length) * 100);

  // Section Name Map
  const sectionNames: Record<string, string> = {
    'A': 'Escenarios',
    'B': 'Conocimiento',
    'C': 'Prompting',
    'D': 'Organizacional',
    'GAPS': 'Cierre'
  };

  const sectionWeights: Record<string, number> = {
    'A': 40,
    'B': 25,
    'C': 35,
    'D': 0,
    'GAPS': 0
  };

  return (
    <div className="min-h-screen bg-white text-[#111111] flex flex-col">
      <Navbar progress={percentComplete} />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_280px] pt-[56px]">
        
        {/* Main Content Area */}
        <main className="relative px-5 py-6 md:px-14 md:py-12 flex flex-col min-h-[calc(100vh-56px)] pb-[100px] md:pb-12">
          
          {/* Mobile Progress Header */}
          <div className="md:hidden mb-6 transition-opacity duration-250" style={{ opacity: isIdeFocused ? 0 : 1, height: isIdeFocused ? 0 : 'auto', overflow: 'hidden' }}>
            <div className="w-full h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden mb-2">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${percentComplete}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-[8px] text-primary uppercase tracking-wider">
                Sección {question.section} · {sectionNames[question.section]}
              </span>
              <span className="font-mono text-[8px] text-[#AAAAAA]">
                {currentQuestion + 1} / {questions.length}
              </span>
            </div>
          </div>

          {/* Mobile Focus Mode Header */}
          <div className="md:hidden mb-4 transition-all duration-250" style={{ 
            opacity: isIdeFocused ? 1 : 0, 
            height: isIdeFocused ? 'auto' : 0,
            overflow: 'hidden',
            display: isIdeFocused ? 'flex' : 'none'
          }}>
            <div className="flex justify-between items-center w-full border-b border-[#E0E0E0] pb-2">
              <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                MODO ESCRITURA
              </span>
              <span className="font-mono text-[9px] text-[#AAAAAA]">
                ⏱ {currentAnswer?.time ? Math.floor(currentAnswer.time / 60).toString().padStart(2, '0') + ':' + (currentAnswer.time % 60).toString().padStart(2, '0') : '00:00'}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-[540px] mx-auto md:mx-0"
            >
              {/* Section Badge */}
              <div className="transition-opacity duration-250" style={{ opacity: isIdeFocused ? 0.1 : 1 }}>
                <SectionBadge 
                  letter={question.section as any} 
                  name={sectionNames[question.section]} 
                  weight={sectionWeights[question.section]}
                  rightSlot={question.concept && (
                    <span className="font-mono text-[9px] text-[#00D4FF] bg-[rgba(0,212,255,0.08)] border border-[rgba(0,212,255,0.2)] px-2.5 py-1 rounded-[2px] uppercase tracking-wider">
                      CONCEPTO: {question.concept}
                    </span>
                  )}
                />
              </div>

              {/* Question Text */}
              <div className="transition-opacity duration-250" style={{ opacity: isIdeFocused ? 0.1 : 1 }}>
                <h2 className="font-body text-[16px] md:text-[20px] font-medium text-[#111111] leading-[1.5] mb-8">
                  {question.text || question.scaleText || question.multiText || question.closedText}
                </h2>
              </div>

              {/* Answer Input Area */}
              <div className="mb-8">
                {renderQuestionInput()}
              </div>

            </motion.div>
          </AnimatePresence>

          {/* Navigation Footer */}
          <div className={`
            fixed bottom-0 left-0 w-full bg-white border-t border-[#E0E0E0] p-4 z-50
            flex justify-between items-center md:relative md:bg-transparent md:border-t md:p-0 md:pt-6 md:mt-auto md:block
            transition-all duration-250 pb-[calc(16px+env(safe-area-inset-bottom))]
          `}>
            {/* Desktop Counter */}
            <span className={`hidden md:inline font-mono text-[10px] text-[#AAAAAA] uppercase tracking-wider ${isIdeFocused ? 'hidden' : ''}`}>
              Pregunta {currentQuestion + 1} de {questions.length}
            </span>

            {/* Mobile Back Button (Ghost) */}
            <div className="md:hidden">
               {/* Optional: Add back button logic if needed, currently just placeholder or hidden if first Q */}
               {currentQuestion > 0 && (
                 <button 
                   onClick={() => navigate(-1)} // This might need real back logic in store if we want to support back
                   className="text-[#666666] text-[12px] font-body px-3 py-2"
                 >
                   ← Anterior
                 </button>
               )}
            </div>
            
            <Button 
              variant="primary" 
              onClick={handleNext}
              disabled={!isAnswered()}
              className={`px-6 py-3 text-[13px] min-h-[48px] ${isIdeFocused ? 'w-full' : 'ml-auto md:ml-0'}`}
            >
              {isIdeFocused ? 'Enviar prompt ✓' : 'Siguiente →'}
            </Button>
          </div>

        </main>

        {/* Sidebar (Desktop Only) */}
        <ProgressSidebar />

      </div>
    </div>
  );
}
