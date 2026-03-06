import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';
import { AIQRing } from '../components/ui/AIQRing';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bk flex flex-col relative overflow-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col justify-center min-h-[calc(100vh-56px-80px)] px-5 py-8 md:px-20 md:pt-20 md:pb-[60px] overflow-hidden">
        
        {/* Glow Background */}
        <div 
          className="absolute top-0 right-0 w-[800px] h-[800px] pointer-events-none translate-x-[30%] -translate-y-[30%]"
          style={{
            background: 'radial-gradient(circle, rgba(254,60,28,0.06) 0%, transparent 65%)'
          }}
        />

        {/* Desktop AIQ Ring (Absolute) */}
        <div 
          className="hidden md:block absolute right-20 top-1/2 -translate-y-1/2 animate-fade-in-up"
          style={{ animationDelay: '700ms' }}
        >
          <div className="scale-[0.8] animate-[scaleIn_500ms_ease-out_700ms_forwards]" style={{ animationFillMode: 'both' }}>
             <AIQRing size={200} />
          </div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-[700px] w-full">
          
          {/* Mobile AIQ Ring (Centered) */}
          <div 
            className="md:hidden flex justify-center mb-8 animate-fade-in-up"
            style={{ animationDelay: '700ms' }}
          >
             <AIQRing size={110} />
          </div>

          {/* Eyebrow */}
          <div 
            className="flex items-center gap-4 mb-5 animate-fade-in-up"
            style={{ animationDelay: '100ms' }}
          >
            <div className="w-[24px] h-[1px] bg-primary" />
            <span className="font-mono text-[10px] tracking-[0.4em] text-primary uppercase">
              Diagnóstico de Madurez en IA · Enterprise Edition v1.0
            </span>
          </div>

          {/* Headline */}
          <h1 
            className="font-display text-[52px] md:text-[80px] leading-[0.90] text-white mb-5 animate-fade-in-up max-w-full md:max-w-[700px]"
            style={{ animationDelay: '200ms' }}
          >
            Descubre dónde está tu organización en la era de la <span className="text-primary">inteligencia artificial</span>
          </h1>

          {/* Lead */}
          <p 
            className="font-body text-[17px] font-light text-[#B3B3B3] leading-[1.6] max-w-[480px] mb-9 animate-fade-in-up"
            style={{ animationDelay: '350ms' }}
          >
            AI Pulse mide tu AIQ — la métrica de madurez en IA que define si tu empresa lidera o sigue.
          </p>

          {/* CTA Row */}
          <div 
            className="flex flex-col md:flex-row gap-3 items-stretch md:items-center animate-fade-in-up w-full md:w-auto"
            style={{ animationDelay: '500ms' }}
          >
            <Button 
              variant="primary" 
              pulsing={true} 
              onClick={() => navigate('/gate')}
              className="w-full md:w-auto min-h-[48px]"
            >
              Calcular mi AIQ →
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/gate?type=enterprise')}
              className="w-full md:w-auto min-h-[48px]"
            >
              Diagnóstico para equipos
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="bg-[#161616] border-t border-[#1a1a1a] px-5 py-8 md:px-20 md:py-5 grid grid-cols-2 md:flex md:flex-wrap items-center gap-8 md:gap-8">
        {[
          { num: "31", label: "Preguntas\ncalibradas" },
          { num: "5", label: "Niveles de\nmadurez" },
          { num: "12'", label: "Tiempo\nestimado" },
          { num: "4", label: "Secciones\nevaluadas" }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="font-display text-[28px] text-primary leading-none">{item.num}</span>
            <span className="font-mono text-[9px] uppercase text-[#4D4D4D] leading-[1.4] whitespace-pre-line">
              {item.label}
            </span>
          </div>
        ))}

        <div className="hidden md:flex items-center gap-2 ml-auto">
          <div className="w-[6px] h-[6px] rounded-full bg-primary" />
          <span className="font-mono text-[9px] text-[#4D4D4D]">
            Resultados inmediatos · Sin registro requerido
          </span>
        </div>
      </div>
      
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.8); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
