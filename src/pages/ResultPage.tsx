import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';
import { ScoreRing } from '../components/ui/ScoreRing';
import { SectionBars } from '../components/ui/SectionBars';
import { ChallengeCard } from '../components/ui/ChallengeCard';
import { UpgradeGate } from '../components/ui/UpgradeGate';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';

export default function ResultPage() {
  const navigate = useNavigate();
  const { aiqResult, participant, answers, aiScores, startTime } = useAssessmentStore();
  const [showToast, setShowToast] = useState(false);

useEffect(() => {
  if (!aiqResult) { 
    navigate('/'); 
    return; 
  }

  const saveResults = async () => {
    try {
      await fetch('/api/results-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: participant?.token,
          participant,
          answers,
          aiScores,
          aiqResult,
          metadata: {
            startTime,
            completedAt: new Date().toISOString(),
            durationMinutes: startTime 
              ? (Date.now() - startTime) / 60000 
              : null
          }
        })
      });
    } catch (err) {
      console.error('Error saving results:', err);
    }
  };

  // Solo disparamos el guardado si tenemos un token válido
  if (participant?.token) {
    saveResults();
  }
}, [aiqResult, participant, answers, aiScores, startTime, navigate]);

  if (!aiqResult) return null;

  const handleShare = async () => {
    const shareData = {
      title: `Mi AIQ: ${aiqResult.level} — ${aiqResult.levelName}`,
      text: 'Acabo de calcular mi madurez en IA.',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShowToast(true);
    }
  };

  const getActionItems = () => {
    const items = [];
    const profile = aiqResult.challengeProfile;
    
    // Priority 1
    if (profile === 'technical_gap') {
      items.push({ title: "Dominar seguridad de datos con IA", text: "Aprende a sanitizar inputs y configurar entornos seguros." });
    } else if (profile === 'knowledge_gap') {
      items.push({ title: "Práctica de prompting estructurado diario", text: "Dedica 15 min al día a refinar prompts complejos." });
    } else if (aiqResult.level === 'L4') {
      items.push({ title: "Diseñar un programa de adopción para tu equipo", text: "Estandariza los casos de uso exitosos." });
    } else {
      items.push({ title: "Identificar 3 casos de uso recurrentes", text: "Documenta tareas repetitivas que la IA puede asumir." });
    }

    // Priority 2 (Generic next step)
    items.push({ title: "Establecer métricas de éxito", text: "Define KPIs claros para tus implementaciones de IA." });

    return items;
  };

  const actionItems = getActionItems();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-8 md:p-14 relative overflow-x-hidden">
      
      {/* Glow Background */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[600px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at top, rgba(254,60,28,0.07), transparent 55%)'
        }}
      />

      <div className="relative z-10 w-full max-w-[640px] text-center">
        
        {/* 1. Score Reveal */}
        <ScoreRing 
          score={aiqResult.score} 
          level={aiqResult.level} 
          levelName={aiqResult.levelName} 
        />

        {/* 2. Alert Badge */}
        {aiqResult.alerts.includes('REGLA_3') && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0 }}
            className="inline-block mt-4 bg-[rgba(255,214,0,0.08)] border border-[rgba(255,214,0,0.2)] px-4 py-1.5 rounded-[2px]"
          >
            <span className="font-mono text-[9px] text-[#FFD600]">
              ⚠ Alerta activa — Regla 3: brecha de niveles entre secciones
            </span>
          </motion.div>
        )}

        {/* 3. Section Bars */}
        <SectionBars 
          sectionScores={aiqResult.sectionScores} 
          alerts={aiqResult.alerts} 
        />

        {/* 4. Challenge Card */}
        <ChallengeCard 
          profile={aiqResult.challengeProfile} 
          levelName={aiqResult.levelName} 
        />

        {/* 5. Action Items */}
        <div className="mt-4 w-full text-left">
          {actionItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.6 + (i * 0.2) }}
              className="flex gap-3.5 p-[14px_18px] bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] mb-[3px]"
            >
              <span className="font-display text-[28px] text-[rgba(254,60,28,0.3)] leading-none min-w-[20px]">
                {i + 1}
              </span>
              <div className="flex flex-col">
                <span className="font-body text-[12px] font-bold text-[#111111] mb-1">
                  {item.title}
                </span>
                <span className="font-body text-[11px] font-light text-[#666666] leading-[1.5]">
                  {item.text}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile Share Button */}
        <div className="md:hidden mt-6 w-full">
          <Button variant="ghost" fullWidth onClick={handleShare} className="min-h-[48px]">
            📤 Compartir mi AIQ
          </Button>
        </div>

        {/* 6. Upgrade Gate */}
        <UpgradeGate 
          level={aiqResult.level} 
          levelName={aiqResult.levelName} 
        />

      </div>

      <Toast 
        message="¡URL COPIADA!" 
        isVisible={showToast} 
        onClose={() => setShowToast(false)} 
      />
    </div>
  );
}
