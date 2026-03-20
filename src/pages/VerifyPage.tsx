import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAssessmentStore } from '../store/useAssessmentStore';
import { Button } from '../components/ui/Button';
import { Navbar } from '../components/ui/Navbar';

type VerifyStatus = 'loading' | 'confirm' | 'error' | 'invalid_email';

export default function VerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setParticipant, participant } = useAssessmentStore();

  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [participantData, setParticipantData] = useState<{
    maskedEmail: string;
    nombre: string;
    posicion: string;
    empresa: string;
    departamento: string;
  } | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // If already verified, go to assessment
  useEffect(() => {
    if (participant) {
      navigate('/assessment', { replace: true });
    }
  }, [participant, navigate]);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No se proporcionó un token de acceso. Verifica el link que recibiste por correo.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth-verify?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok || data.error) {
          setStatus('error');
          setErrorMessage(data.error || 'Token inválido o expirado. Contacta al administrador.');
          return;
        }

        setParticipantData(data);
        setStatus('confirm');
      } catch (err) {
        console.error('Verify error:', err);
        setStatus('error');
        setErrorMessage('Error al verificar el token. Intenta de nuevo más tarde.');
      }
    };

    verifyToken();
  }, [token]);

  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!participantData || !token || !emailInput.trim()) return;

    setConfirming(true);
    try {
      const response = await fetch(`/api/auth-verify?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await response.json();

      if (!response.ok || !data.verified) {
        setStatus('invalid_email');
        setConfirming(false);
        return;
      }

      // Server confirmed email matches - set participant and go to assessment
      setParticipant({
        email: data.email,
        nombre: data.nombre,
        posicion: data.posicion,
        empresa: data.empresa,
        departamento: data.departamento,
        token,
      });

      navigate('/assessment', { replace: true });
    } catch (err) {
      console.error('Email confirmation error:', err);
      setStatus('error');
      setErrorMessage('Error al confirmar el correo. Intenta de nuevo más tarde.');
      setConfirming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && emailInput.trim()) {
      handleConfirm();
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col relative overflow-hidden">
      <Navbar />

      {/* Glow Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(254,60,28,0.04) 0%, transparent 60%)'
        }}
      />

      <div className="flex-1 flex items-center justify-center px-5 py-8 pt-[80px]">
        <div className="relative z-10 w-full max-w-[480px]">

          {/* Loading State */}
          {status === 'loading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-[#E0E0E0] rounded-full" />
                <motion.div
                  className="absolute inset-0 border-t-4 border-primary rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <p className="font-mono text-[11px] text-[#666666] uppercase tracking-wider">
                Verificando acceso...
              </p>
            </motion.div>
          )}

          {/* Confirm Email State */}
          {status === 'confirm' && participantData && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              {/* Eyebrow */}
              <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase mb-5 block text-center">
                VERIFICACION DE IDENTIDAD
              </span>

              {/* Greeting */}
              <h1 className="font-display text-[32px] md:text-[42px] leading-[0.95] text-[#111111] mb-4 text-center">
                Hola, <span className="text-primary">{participantData.nombre.split(' ')[0]}</span>
              </h1>

              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] text-center mb-8 max-w-[400px]">
                Para confirmar tu identidad, ingresa el correo electrónico al que recibiste esta invitación.
              </p>

              {/* Participant Info Card */}
              <div className="w-full bg-[#EFEFEF] border border-[#CCCCCC] rounded-[2px] p-5 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider block mb-1">
                      Nombre
                    </span>
                    <span className="font-body text-[13px] text-[#111111]">
                      {participantData.nombre}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider block mb-1">
                      Posicion
                    </span>
                    <span className="font-body text-[13px] text-[#111111]">
                      {participantData.posicion}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider block mb-1">
                      Empresa
                    </span>
                    <span className="font-body text-[13px] text-[#111111]">
                      {participantData.empresa}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider block mb-1">
                      Departamento
                    </span>
                    <span className="font-body text-[13px] text-[#111111]">
                      {participantData.departamento}
                    </span>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="w-full mb-6">
                <label className="font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider block mb-2">
                  Confirma tu correo electronico
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (status === 'invalid_email') setStatus('confirm');
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="tu@correo.com"
                  autoFocus
                  className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-4 py-3 text-[#111111] font-body text-[14px] placeholder:text-[#AAAAAA] focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={!emailInput.trim() || confirming}
                className="w-full min-h-[48px]"
              >
                {confirming ? 'Verificando...' : 'Confirmar y comenzar diagnostico'}
              </Button>

              <p className="font-mono text-[9px] text-[#AAAAAA] text-center mt-3 uppercase tracking-wider">
                Confidencial · ~12 minutos
              </p>
            </motion.div>
          )}

          {/* Invalid Email State */}
          {status === 'invalid_email' && participantData && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(255,60,60,0.1)] border border-[rgba(255,60,60,0.2)] flex items-center justify-center mb-5">
                <span className="text-[20px]">!</span>
              </div>

              <h2 className="font-display text-[24px] text-[#111111] mb-3 text-center">
                Correo no coincide
              </h2>

              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] text-center mb-6 max-w-[400px]">
                El correo que ingresaste no corresponde al registrado para esta invitacion. Verifica e intenta de nuevo.
              </p>

              {/* Email Input - retry */}
              <div className="w-full mb-6">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setStatus('confirm');
                  }}
                  placeholder="tu@correo.com"
                  autoFocus
                  className="w-full bg-white border border-[rgba(255,60,60,0.3)] rounded-[2px] px-4 py-3 text-[#111111] font-body text-[14px] placeholder:text-[#AAAAAA] focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <Button
                variant="primary"
                onClick={() => setStatus('confirm')}
                className="w-full min-h-[48px]"
              >
                Intentar de nuevo
              </Button>
            </motion.div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-full bg-[rgba(255,60,60,0.1)] border border-[rgba(255,60,60,0.2)] flex items-center justify-center mb-5">
                <span className="text-[20px]">!</span>
              </div>

              <h2 className="font-display text-[24px] text-[#111111] mb-3 text-center">
                Acceso no autorizado
              </h2>

              <p className="font-body text-[14px] font-light text-[#555555] leading-[1.6] text-center max-w-[400px]">
                {errorMessage}
              </p>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
