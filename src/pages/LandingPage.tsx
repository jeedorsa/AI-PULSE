import { useEffect } from 'react';
import { Navbar } from '../components/ui/Navbar';
import { AIQRing } from '../components/ui/AIQRing';

export default function LandingPage() {

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
            background: 'radial-gradient(circle, rgba(254,60,28,0.08) 0%, transparent 65%)'
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
            className="font-display text-[52px] md:text-[80px] leading-[0.90] text-[#111111] mb-5 animate-fade-in-up max-w-full md:max-w-[700px]"
            style={{ animationDelay: '200ms' }}
          >
            Descubre dónde está tu organización en la era de la <span className="text-primary">inteligencia artificial</span>
          </h1>

          {/* Lead */}
          <p 
            className="font-body text-[17px] font-light text-[#555555] leading-[1.6] max-w-[480px] mb-9 animate-fade-in-up"
            style={{ animationDelay: '350ms' }}
          >
            AI Pulse mide tu AIQ — la métrica de madurez en IA que define si tu empresa lidera o sigue.
          </p>

          {/* Access Block */}
          <div
            className="animate-fade-in-up"
            style={{ animationDelay: '500ms' }}
          >
            {/* Próximamente badge */}
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-[2px] border border-primary/30 bg-primary/5">
              <div className="w-[6px] h-[6px] rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-primary">
                Acceso por invitación
              </span>
            </div>

            <p className="font-body text-[15px] font-light text-[#666666] leading-[1.65] max-w-[420px] mb-5">
              AI Pulse está disponible exclusivamente para organizaciones invitadas.
              Recibirás un link de acceso personalizado directamente en tu correo.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <a
                href="mailto:contacto@javiercruz.ai?subject=Solicitud%20de%20acceso%20AI%20Pulse"
                className="inline-flex items-center justify-center gap-2 bg-primary text-white font-body font-semibold text-[14px] px-8 py-[14px] rounded-[2px] hover:shadow-[0_8px_24px_rgba(254,60,28,0.30)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 w-full sm:w-auto min-h-[48px]"
              >
                Contáctanos para acceso →
              </a>
              <div className="flex items-center justify-center gap-2 px-5 py-[14px] border border-[#CCCCCC] rounded-[2px] w-full sm:w-auto min-h-[48px]">
                <div className="w-[5px] h-[5px] rounded-full bg-[#AAAAAA]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#AAAAAA]">
                  Próximamente disponible
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="bg-[#EFEFEF] border-t border-[#E0E0E0] px-5 py-8 md:px-20 md:py-5 grid grid-cols-2 md:flex md:flex-wrap items-center gap-8 md:gap-8">
        {[
          { num: "31", label: "Preguntas\ncalibradas" },
          { num: "5", label: "Niveles de\nmadurez" },
          { num: "12'", label: "Tiempo\nestimado" },
          { num: "4", label: "Secciones\nevaluadas" }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="font-display text-[28px] text-primary leading-none">{item.num}</span>
            <span className="font-mono text-[9px] uppercase text-[#AAAAAA] leading-[1.4] whitespace-pre-line">
              {item.label}
            </span>
          </div>
        ))}

        <div className="hidden md:flex items-center gap-2 ml-auto">
          <div className="w-[6px] h-[6px] rounded-full bg-primary" />
          <span className="font-mono text-[9px] text-[#AAAAAA]">
            Acceso exclusivo · Por invitación
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
