import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import { useAssessmentStore } from '../store/useAssessmentStore';

export default function CheckpointPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userRole } = useAssessmentStore();
  
  const sectionId = id || 'A';

  useEffect(() => {
    if (!userRole) {
      navigate('/', { replace: true });
      return;
    }
    if (!['A', 'B', 'C', 'D'].includes(sectionId)) {
      navigate('/assessment', { replace: true });
    }
  }, [userRole, sectionId, navigate]);

  const contentMap: Record<string, { subtitle: string; next: { title: string; sub: string } }> = {
    'A': {
      subtitle: "ESCENARIOS DE USO",
      next: { title: "Conocimiento Técnico", sub: "Evaluación de fundamentos y arquitectura" }
    },
    'B': {
      subtitle: "CONOCIMIENTO TÉCNICO",
      next: { title: "Habilidades de Prompting", sub: "Ejercicios prácticos de ingeniería de prompts" }
    },
    'C': {
      subtitle: "HABILIDADES DE PROMPTING",
      next: { title: "Dimensión Organizacional", sub: "Impacto y adopción en tu entorno" }
    },
    'D': {
      subtitle: "DIMENSIÓN ORGANIZACIONAL",
      next: { title: "Análisis de Brechas", sub: "Identificación de oportunidades de mejora" }
    }
  };

  const currentContent = contentMap[sectionId] || contentMap['A'];

  const handleContinue = () => {
    // nextQuestion() ya fue llamado en AssessmentPage antes de navegar aquí
    // Solo navegamos de vuelta al assessment
    navigate('/assessment');
  };

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center text-center p-5 md:p-14 relative overflow-hidden">
      
      {/* Glow Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(254,60,28,0.05) 0%, transparent 65%)'
        }}
      />

      {/* Decorative Number */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[120px] md:text-[180px] text-[rgba(254,60,28,0.04)] pointer-events-none z-0 animate-[fadeIn_800ms_ease-out]"
      >
        {sectionId}
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-[600px] w-full">
        
        {/* Eyebrow */}
        <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase mb-4 block">
            · Sección completada ·
          </span>
        </div>

        {/* Title */}
        <h1 
          className="font-display text-[40px] md:text-[56px] text-white tracking-[0.5px] leading-none mb-3 animate-fade-in-up"
          style={{ animationDelay: '250ms' }}
        >
          SECCIÓN {sectionId} <span className="text-primary">COMPLETADA</span>
        </h1>

        {/* Subtitle */}
        <p 
          className="font-mono text-[10px] text-[#4D4D4D] tracking-[0.2em] uppercase mb-10 animate-fade-in-up"
          style={{ animationDelay: '350ms' }}
        >
          {currentContent.subtitle}
        </p>

        {/* Progress Segments */}
        <div 
          className="flex gap-[3px] mb-10 animate-[fadeIn_600ms_ease-out_400ms_forwards] opacity-0"
        >
          {['A', 'B', 'C', 'D'].map((seg) => {
            const isCompleted = seg <= sectionId;
            return (
              <div 
                key={seg} 
                className={`w-[64px] h-[4px] rounded-[2px] transition-colors duration-600 ${isCompleted ? 'bg-primary' : 'bg-[#1e1e1e]'}`}
              />
            );
          })}
        </div>

        {/* Next Section Card */}
        <div 
          className="bg-[#161616] border border-[#2a2a2a] p-6 md:p-8 rounded-[2px] text-left w-full max-w-[400px] animate-fade-in-up"
          style={{ animationDelay: '600ms' }}
        >
          <div className="font-mono text-[9px] text-primary uppercase tracking-[0.2em] mb-2">
            Siguiente
          </div>
          <div className="font-body text-[14px] font-semibold text-white mb-1">
            {currentContent.next.title}
          </div>
          <div className="font-body text-[11.5px] text-[#808080]">
            {currentContent.next.sub}
          </div>
        </div>

        {/* CTA */}
        <div 
          className="mt-6 animate-[fadeIn_600ms_ease-out_800ms_forwards] opacity-0 w-full md:w-auto"
        >
          <Button variant="primary" onClick={handleContinue} className="w-full md:w-auto min-h-[48px]">
            Continuar →
          </Button>
        </div>

      </div>
    </div>
  );
}
