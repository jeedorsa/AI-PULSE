import { useState } from 'react';

type Lang = 'es' | 'en';

const COPY = {
  es: {
    brandLine1: 'El 70% se cree intermedio.',
    brandLine2: 'Casi todos son principiantes.',
    brandSub: 'AI Pulse mide el nivel real de dominio de IA de tu equipo. Datos, no percepción.',
    brandFoot: '// Building Human-AI Advantage',
    heading: 'Inicia sesión',
    sub: 'Accede a tu diagnóstico de IA y retoma donde lo dejaste.',
    google: 'Continuar con Google',
    microsoft: 'Continuar con Microsoft',
  },
  en: {
    brandLine1: "70% think they're intermediate.",
    brandLine2: 'Almost all are beginners.',
    brandSub: "AI Pulse measures your team's real AI mastery. Data, not perception.",
    brandFoot: '// Building Human-AI Advantage',
    heading: 'Sign in',
    sub: 'Access your AI diagnostic and pick up where you left off.',
    google: 'Continue with Google',
    microsoft: 'Continue with Microsoft',
  },
};

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>('es');
  const t = COPY[lang];

  return (
    <div className="min-h-screen w-full flex flex-col bg-white relative">
      {/* Selector de idioma */}
      <div className="absolute top-4 right-4 z-10 flex bg-[#161616] rounded-[9px] p-[3px]">
        <button
          onClick={() => setLang('es')}
          className={`font-body text-[12.5px] font-semibold px-3 py-1.5 rounded-[7px] transition-colors ${lang === 'es' ? 'bg-[#FE3C1C] text-white' : 'text-[#9a9a9a]'}`}
        >
          ES
        </button>
        <button
          onClick={() => setLang('en')}
          className={`font-body text-[12.5px] font-semibold px-3 py-1.5 rounded-[7px] transition-colors ${lang === 'en' ? 'bg-[#FE3C1C] text-white' : 'text-[#9a9a9a]'}`}
        >
          EN
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Panel de marca */}
        <div className="relative w-full md:w-[47%] bg-black overflow-hidden flex flex-col justify-between p-8 md:p-11 min-h-[280px]">
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1.6px)', backgroundSize: '15px 15px' }}
          />
          <div className="absolute -right-[150px] -bottom-[150px] w-[380px] h-[380px] rounded-full" style={{ background: 'linear-gradient(135deg,#F30302,#FE3C1C)' }} />
          <div className="absolute -right-[70px] -bottom-[70px] w-[230px] h-[230px] rounded-full bg-black" />

          <div className="relative font-display text-[22px] tracking-[3px] text-white select-none">
            AI <span className="text-primary">PULSE</span>
          </div>

          <div className="relative">
            <div className="font-display uppercase leading-[0.94] text-[34px] md:text-[58px] text-white">
              {t.brandLine1} <span className="text-[#FE3C1C]">{t.brandLine2}</span>
            </div>
            <p className="hidden md:block mt-[22px] max-w-[330px] font-body text-[15px] leading-[1.5] text-[#B3B3B3]">
              {t.brandSub}
            </p>
          </div>

          <div className="hidden md:block relative font-mono text-[12px] text-[#808080]">
            {t.brandFoot}
          </div>
        </div>

        {/* Acceso */}
        <div className="flex-1 flex items-center justify-center p-8 md:p-10">
          <div className="w-full max-w-[380px] font-body text-black">
            <div className="font-display text-[22px] tracking-[3px] text-[#111111] select-none mb-[26px]">
              AI <span className="text-primary">PULSE</span>
            </div>

            <h1 className="font-display uppercase text-[42px] leading-[0.96] tracking-[0.01em] m-0 mb-[10px]">
              {t.heading}<span className="text-[#FE3C1C]">.</span>
            </h1>
            <p className="m-0 mb-[28px] text-[14.5px] leading-[1.45] text-[#808080] max-w-[330px]">{t.sub}</p>

            <div className="flex flex-col gap-[10px]">
              <button
                type="button"
                className="flex items-center justify-center gap-[10px] h-[48px] w-full bg-white border border-[#DADADA] rounded-[10px] text-[14.5px] font-medium text-[#1a1a1a] hover:bg-[#F7F7F7] hover:border-[#B3B3B3] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                {t.google}
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-[10px] h-[48px] w-full bg-white border border-[#DADADA] rounded-[10px] text-[14.5px] font-medium text-[#1a1a1a] hover:bg-[#F7F7F7] hover:border-[#B3B3B3] transition-colors"
              >
                <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                  <rect x="0" y="0" width="8.4" height="8.4" fill="#F25022" />
                  <rect x="9.6" y="0" width="8.4" height="8.4" fill="#7FBA00" />
                  <rect x="0" y="9.6" width="8.4" height="8.4" fill="#00A4EF" />
                  <rect x="9.6" y="9.6" width="8.4" height="8.4" fill="#FFB900" />
                </svg>
                {t.microsoft}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Vinka */}
      <footer className="w-full bg-white border-t border-black/[0.08]">
        <div className="max-w-[1120px] mx-auto px-6 py-7 flex flex-col md:grid md:grid-cols-3 items-center gap-4">
          <div
            className="md:justify-self-start"
            style={{
              fontFamily: '"Big Shoulders Display", sans-serif',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'rgb(0, 0, 0)',
              fontSize: '28px',
            }}
          >
            VINKA
          </div>
          <span className="font-body text-[#808080] text-[13.5px] text-center md:justify-self-center">© 2026 Vinka SAS · vinka.one</span>
          <a
            href="https://linkedin.com/company/vinka"
            target="_blank"
            rel="noopener"
            className="font-body font-medium text-black text-[13.5px] no-underline border-b border-[#FE3C1C] pb-0.5 md:justify-self-end"
          >
            LinkedIn
          </a>
        </div>
      </footer>
    </div>
  );
}
