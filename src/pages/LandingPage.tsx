import { useEffect, useState } from 'react';
import { Navbar } from '../components/ui/Navbar';
import { AIQRing } from '../components/ui/AIQRing';

type FormStatus = 'idle' | 'sending' | 'success' | 'error';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !empresa.trim() || !whatsapp.trim()) return;

    setStatus('sending');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), empresa: empresa.trim(), whatsapp: whatsapp.trim() })
      });

      if (!res.ok) throw new Error('Error al registrar');
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Hubo un error. Intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-bk flex flex-col relative overflow-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col justify-center min-h-[calc(100vh-56px)] px-5 py-8 md:px-20 md:pt-20 md:pb-[60px] overflow-hidden">
        
        {/* Glow Background */}
        <div 
          className="absolute top-0 right-0 w-[800px] h-[800px] pointer-events-none translate-x-[30%] -translate-y-[30%]"
          style={{ background: 'radial-gradient(circle, rgba(254,60,28,0.08) 0%, transparent 65%)' }}
        />

        {/* Desktop AIQ Ring */}
        <div 
          className="hidden md:block absolute right-20 top-1/2 -translate-y-1/2 animate-fade-in-up"
          style={{ animationDelay: '700ms' }}
        >
          <div className="scale-[0.8] animate-[scaleIn_500ms_ease-out_700ms_forwards]" style={{ animationFillMode: 'both' }}>
            <AIQRing size={200} />
          </div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-[680px] w-full">
          
          {/* Mobile AIQ Ring */}
          <div className="md:hidden flex justify-center mb-8 animate-fade-in-up" style={{ animationDelay: '700ms' }}>
            <AIQRing size={110} />
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-4 mb-5 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
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
            AI Pulse mide el AIQ de tu equipo — la métrica que define si tu empresa lidera o sigue en la era de la IA.
          </p>

          {/* Waitlist Block */}
          <div className="animate-fade-in-up" style={{ animationDelay: '500ms' }}>

            {status === 'success' ? (
              /* Success State */
              <div className="max-w-[420px] p-6 rounded-[4px] border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-[8px] h-[8px] rounded-full bg-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
                    Registrado
                  </span>
                </div>
                <p className="font-body text-[15px] text-[#333333] leading-[1.6]">
                  Te contactaremos pronto con tu acceso personalizado.
                </p>
              </div>
            ) : (
              /* Form State */
              <>
                {/* Badge */}
                <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-[2px] border border-primary/30 bg-primary/5">
                  <div className="w-[6px] h-[6px] rounded-full bg-primary animate-pulse" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-primary">
                    Join the Waitlist
                  </span>
                </div>

                <p className="font-body text-[14px] font-light text-[#666666] leading-[1.6] max-w-[400px] mb-5">
                  El acceso es por invitación. Déjanos tus datos y te contactamos para activar tu diagnóstico.
                </p>

                <div className="flex flex-col gap-3 max-w-[420px]">
                  {/* Email */}
                  <input
                    type="email"
                    placeholder="Correo corporativo"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-4 py-3 font-body text-[14px] text-[#111111] placeholder:text-[#AAAAAA] focus:outline-none focus:border-primary transition-colors"
                  />
                  {/* Empresa */}
                  <input
                    type="text"
                    placeholder="Nombre de tu empresa"
                    value={empresa}
                    onChange={e => setEmpresa(e.target.value)}
                    className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-4 py-3 font-body text-[14px] text-[#111111] placeholder:text-[#AAAAAA] focus:outline-none focus:border-primary transition-colors"
                  />
                  {/* WhatsApp */}
                  <input
                    type="tel"
                    placeholder="WhatsApp (con código de país, ej: +56 9 1234 5678)"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-4 py-3 font-body text-[14px] text-[#111111] placeholder:text-[#AAAAAA] focus:outline-none focus:border-primary transition-colors"
                  />

                  {/* Error */}
                  {status === 'error' && (
                    <p className="font-body text-[12px] text-[#FF3C3C]">{errorMsg}</p>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={status === 'sending' || !email.trim() || !empresa.trim() || !whatsapp.trim()}
                    className="w-full bg-primary text-white font-body font-semibold text-[14px] px-8 py-[14px] rounded-[2px] hover:shadow-[0_8px_24px_rgba(254,60,28,0.30)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none min-h-[48px]"
                  >
                    {status === 'sending' ? 'Enviando...' : 'Solicitar acceso →'}
                  </button>

                  <p className="font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider text-center">
                    100% confidencial · Sin spam
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.8); }
          to { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
