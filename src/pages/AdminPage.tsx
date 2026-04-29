import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';

interface ParticipantRow {
  email: string;
  nombre: string;
  posicion: string;
  empresa: string;
  departamento: string;
  token?: string;
  status?: string;
}

type AdminTab = 'upload' | 'participants' | 'invitations' | 'reporteria' | 'links';

const ADMIN_TOKEN_KEY = 'aipulse_admin_token';

function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(token: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Admin-Token': token } : {}),
  };
}


// ── Mapa completo de preguntas para exportación ──────────────────
const QUESTION_MAP: Record<string, string> = {
  V1: '¿En qué área de la organización trabajas?',
  V2: '¿Cuál es tu nivel jerárquico actual?',
  V3: '¿Cuántos años llevas desempeñando tu rol actual?',
  V4: '¿Qué herramientas de IA generativa has utilizado al menos una vez?',
  E2: 'Pensando en el último entregable importante que produjiste, ¿qué papel jugó la IA?',
  E3: 'Cuando la IA te da un resultado incorrecto, ¿cuál es tu reacción más frecuente?',
  E4: '¿Cómo usas la IA ante un tema desconocido fuera de tu especialidad?',
  E5: '¿Qué has enseñado o compartido sobre IA dentro de tu empresa?',
  B1: '¿Cómo verificas que un dato técnico que te dio la IA es correcto?',
  B2: '¿Qué tipo de información corporativa evitas compartir con la IA?',
  B3: '¿Para qué has usado IA este mes?',
  B4: '¿Qué tipos de archivos has analizado con IA además de texto?',
  B5: '¿Qué tarea repetitiva has logrado delegar a la IA?',
  B6: '¿Has logrado que la IA trabaje con información específica de tu empresa?',
  C1: 'Prompt: Email a cliente VIP con retraso de 3 semanas',
  C2: 'Prompt: Mejora de prompt de presentación de resultados',
  C3: 'Prompt: Decisión de lanzar producto con razonamiento paso a paso',
  D1: '¿En qué medida tu jefe o empresa apoya el uso de IA?',
  D2: '¿Has sentido que usar IA era mal visto en tu equipo?',
  D3: '¿Qué herramientas de IA usas actualmente?',
  D4: '¿Qué herramienta necesitas y no tienes acceso?',
  D5: '¿Existen espacios oficiales para compartir aprendizajes de IA?',
  D6: '¿Conoces las políticas de uso responsable de IA de tu empresa?',
  D7: '¿Alguna vez decidiste NO usar IA por razones éticas?',
  D9: '¿Cómo ves el futuro de tu rol con la llegada de la IA?',
};

const V2_OPTIONS: Record<number, string> = { 1: 'Colaborador individual', 2: 'Manager o Líder de equipo', 3: 'Director', 4: 'VP o C-Suite' };
const V3_OPTIONS: Record<number, string> = { 1: 'Menos de 1 año', 2: '1 a 3 años', 3: '3 a 5 años', 4: 'Más de 5 años' };
const E3_OPTIONS: Record<number, string> = { 1: 'No lo noto', 2: 'Repito la pregunta igual', 3: 'Ajusto el prompt manualmente', 4: 'Aplico un proceso sistemático de corrección', 5: 'Comparto la lección con mi equipo' };
const E4_OPTIONS: Record<number, string> = { 1: 'No la uso', 2: 'Busco definiciones rápidas', 3: 'Pido analogías y explicaciones', 4: 'Diseño un plan de estudio y casos prácticos' };
const B1_OPTIONS: Record<number, string> = { 1: 'Confío si suena bien', 2: 'Búsqueda rápida en Google', 3: 'Método sistemático de verificación cruzada' };
const D1_OPTIONS: Record<number, string> = { 1: 'Nunca ha habido incentivo', 2: 'Menciones generales sin acciones', 3: 'He recibido recursos o tiempo específico', 4: 'Existe una estrategia clara con liderazgo' };
const D9_OPTIONS: Record<number, string> = { 1: 'Me genera incertidumbre', 2: 'Tengo curiosidad pero no sé cómo afectará', 3: 'Lo veo como oportunidad de crecimiento', 4: 'La IA ya es central en mi desarrollo profesional' };

function resolveAnswer(id: string, raw: any): string {
  if (raw === undefined || raw === null) return '';
  switch (id) {
    case 'V1': return typeof raw === 'string' ? raw : '';
    case 'V2': return V2_OPTIONS[raw?.value] || String(raw?.value || '');
    case 'V3': return V3_OPTIONS[raw?.value] || String(raw?.value || '');
    case 'V4': return (raw?.selected || []).join(', ');
    case 'E2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'E3': return E3_OPTIONS[raw?.value] || String(raw?.value || '');
    case 'E4': return E4_OPTIONS[raw?.value] || String(raw?.value || '');
    case 'E5': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B1': return B1_OPTIONS[raw?.value] || String(raw?.value || '');
    case 'B2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B3': return (raw?.selected || []).join(', ');
    case 'B4': return [(raw?.selected || []).join(', '), raw?.text || ''].filter(Boolean).join(' — ');
    case 'B5': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'B6': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'C1': return raw?.text || '';
    case 'C2': return raw?.text || '';
    case 'C3': return raw?.text || '';
    case 'D1': return [D1_OPTIONS[raw?.value] || '', raw?.text || ''].filter(Boolean).join(' → ');
    case 'D2': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D3': {
      const selected = raw?.selected || [];
      const origins = raw?.origins || {};
      return selected.map((t: string) => origins[t] ? `${t} (${origins[t]})` : t).join(', ');
    }
    case 'D4': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D5': return [raw?.choice || '', raw?.text || ''].filter(Boolean).join(' → ');
    case 'D6': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D7': return typeof raw === 'string' ? raw : raw?.text || '';
    case 'D9': return D9_OPTIONS[raw?.value] || String(raw?.value || '');
    default: return typeof raw === 'string' ? raw : JSON.stringify(raw);
  }
}

function downloadJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('upload');
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [sendingMessage, setSendingMessage] = useState('');

  // Reportería
  interface ResultRow {
    email: string; nombre: string; posicion: string; empresa: string; departamento: string;
    aiqScore: number; aiqLevel: string; sectionA: number; sectionB: number; sectionC: number;
    challengeProfile: string; completedAt: string; answers: Record<string, any>;
  }
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [generatingCompanyReport, setGeneratingCompanyReport] = useState(false);
  const [reportProgressMsg, setReportProgressMsg] = useState('');
  const [companyProgressMsg, setCompanyProgressMsg] = useState('');

  function startProgressMessages(setter: (msg: string) => void, messages: string[], intervalMs = 12000) {
    let i = 0;
    setter(messages[0]);
    const id = setInterval(() => {
      i = Math.min(i + 1, messages.length - 1);
      setter(messages[i]);
    }, intervalMs);
    return id;
  }

  const INDIVIDUAL_MSGS = [
    'Leyendo respuestas del participante...',
    'Analizando dimensiones AIQ...',
    'Generando diagnóstico con IA...',
    'Redactando fortalezas y brechas...',
    'Preparando informe personalizado...',
    'Casi listo, guardando informe...',
  ];

  const COMPANY_MSGS = [
    'Cargando respuestas de todos los participantes...',
    'Calculando métricas organizacionales...',
    'Detectando arquetipo y brechas...',
    'Generando análisis narrativo con IA...',
    'Elaborando plan de acción 30/60/90 días...',
    'Preparando informe enterprise...',
    'Casi listo, guardando informe...',
  ];
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [linkEmpresa, setLinkEmpresa] = useState('');
  const [linkDominio, setLinkDominio] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  async function safeJsonFetch(res: Response): Promise<any> {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`El servidor tardó demasiado o devolvió un error inesperado (HTTP ${res.status}). Intenta de nuevo.`); }
  }

  const generateReport = async (email: string) => {
    setGeneratingReport(email);
    const intervalId = startProgressMessages(setReportProgressMsg, INDIVIDUAL_MSGS, 14000);
    try {
      const res = await fetch('/api/report-generate', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ email }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await safeJsonFetch(res);
      if (res.status === 202 || data.status === 'pending') {
        alert(`⏳ ${data.message || 'El informe se está generando. Vuelve en 1-2 minutos e intenta de nuevo.'}`);
        return;
      }
      if (!res.ok || !data.html) throw new Error(data.error || `Error ${res.status}`);

      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(`Error generando el informe: ${err.message}`);
    } finally {
      clearInterval(intervalId);
      setGeneratingReport(null);
      setReportProgressMsg('');
    }
  };

  const generateCompanyReport = async (empresa: string) => {
    setGeneratingCompanyReport(true);
    const intervalId = startProgressMessages(setCompanyProgressMsg, COMPANY_MSGS, 18000);
    try {
      const res = await fetch('/api/report-generate-company', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ empresa }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await safeJsonFetch(res);
      if (res.status === 202 || data.status === 'pending') {
        alert(`⏳ ${data.message || 'El informe se está generando en background. Vuelve en 5-10 minutos.'}`);
        return;
      }
      if (!res.ok || !data.html) throw new Error(data.error || 'El informe llegó vacío');
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(`Error generando el informe de empresa: ${err.message}`);
    } finally {
      clearInterval(intervalId);
      setGeneratingCompanyReport(false);
      setCompanyProgressMsg('');
    }
  };

  const fetchResults = async () => {
    setLoadingResults(true);
    try {
      const response = await fetch('/api/results-list', { headers: adminHeaders() });
      if (response.status === 401) { handleUnauthorized(); return; }
      const data = await response.json();
      if (data.results) setResults(data.results);
    } catch (err) { console.error('results error:', err); }
    setLoadingResults(false);
  };

  const handleResend = async (email: string, empresa: string) => {
    try {
      const res = await fetch('/api/invitation-resend', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ email, empresa })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Invitación reenviada a ${email}`);
        fetchParticipants();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch { alert('Error al reenviar'); }
  };

  const handleStatusChange = async (email: string, status: string) => {
    try {
      const res = await fetch('/api/participant-update', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ email, status })
      });
      if (res.ok) fetchParticipants();
      else { const d = await res.json(); alert(`Error: ${d.error}`); }
    } catch { alert('Error al actualizar status'); }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if we have a stored token on mount
  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) return;

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        setLoginError(data.error || 'Usuario o contrasena incorrectos');
        setLoginLoading(false);
        return;
      }

      setAdminToken(data.token);
      setIsAuthenticated(true);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Error de conexion. Intenta de nuevo.');
    }
    setLoginLoading(false);
  };

  const handleOpenDemo = async () => {
    try {
      const res = await fetch('/api/coach-demo', { method: 'POST', headers: adminHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      if (!data.success) throw new Error('Error iniciando demo');
      // Guardar sesión demo en sessionStorage y abrir en nueva pestaña
      sessionStorage.setItem('aipulse_coach_email', data.email);
      sessionStorage.setItem('aipulse_coach_token', data.sessionToken);
      sessionStorage.setItem('aipulse_coach_demo', JSON.stringify({
        profile: data.profile, tasks: data.tasks,
        chatHistory: data.chatHistory, analysis: data.analysis, isDemo: true
      }));
      window.open('/coach', '_blank');
    } catch (err: any) {
      alert(`Error abriendo demo: ${err.message}`);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    setIsAuthenticated(false);
    setParticipants([]);
    setUploadStatus('idle');
    setUploadMessage('');
    setSendingStatus('idle');
    setSendingMessage('');
  };

  const handleUnauthorized = useCallback(() => {
    clearAdminToken();
    setIsAuthenticated(false);
    setLoginError('Sesion expirada. Inicia sesion de nuevo.');
    setUploadStatus('idle');
    setUploadMessage('');
    setSendingStatus('idle');
    setSendingMessage('');
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('');

    try {
      // Convert file to base64 to avoid binary body issues with Azure Static Web Apps
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const response = await fetch('/api/participants-upload', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ fileData: base64, fileName: file.name }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok || data.error) {
        setUploadStatus('error');
        setUploadMessage(data.error || 'Error al procesar el archivo');
        return;
      }

      setParticipants(data.participants || []);
      setUploadStatus('success');
      setUploadMessage(`${data.participants?.length || 0} participantes cargados correctamente`);
    } catch (err: unknown) {
      console.error('Upload error:', err);
      setUploadStatus('error');
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setUploadMessage(`Error al subir el archivo: ${msg}`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendInvitations = async () => {
    setSendingStatus('sending');
    setSendingMessage('');

    try {
      const response = await fetch('/api/invitations-send', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ sendAll: true }),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok || data.error) {
        setSendingStatus('error');
        setSendingMessage(data.error || 'Error al enviar invitaciones');
        return;
      }

      setSendingStatus('success');
      setSendingMessage(`${data.sent || 0} invitaciones enviadas correctamente`);
      // Refresh participants list
      fetchParticipants();
    } catch (err) {
      console.error('Send error:', err);
      setSendingStatus('error');
      setSendingMessage('Error al enviar invitaciones. Intenta de nuevo.');
    }
  };

  const fetchParticipants = async () => {
    try {
      const response = await fetch('/api/participants-list', {
        headers: adminHeaders(),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();
      if (data.participants) {
        setParticipants(data.participants);
      }
    } catch (err) {
      console.error('Fetch participants error:', err);
    }
  };

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'upload', label: 'Cargar Excel' },
    { id: 'participants', label: 'Participantes' },
    { id: 'invitations', label: 'Invitaciones' },
    { id: 'links', label: 'Links de Acceso' },
    { id: 'reporteria', label: 'Reportería' },
  ];

  // ── Login Screen ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <div className="flex-1 pt-[56px] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[380px] px-5"
          >
            <div className="text-center mb-8">
              <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase block mb-3">
                ACCESO RESTRINGIDO
              </span>
              <h1 className="font-display text-[28px] md:text-[36px] leading-[0.95] text-[#111111] mb-2">
                AI <span className="text-primary">PULSE</span> Admin
              </h1>
              <p className="font-body text-[13px] font-light text-[#666666]">
                Ingresa tus credenciales de administrador
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Usuario"
                  autoFocus
                  autoComplete="username"
                  className="w-full bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-4 py-3
                    font-body text-[14px] text-[#111111] placeholder-[#AAAAAA]
                    focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Contrasena"
                  autoComplete="current-password"
                  className="w-full bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-4 py-3
                    font-body text-[14px] text-[#111111] placeholder-[#AAAAAA]
                    focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              <Button
                variant="primary"
                type="submit"
                disabled={loginLoading || !loginUsername.trim() || !loginPassword.trim()}
                className="w-full min-h-[48px]"
              >
                {loginLoading ? 'Verificando...' : 'Iniciar sesion'}
              </Button>

              {loginError && (
                <div className="p-3 rounded-[2px] border bg-[rgba(255,60,60,0.05)] border-[rgba(255,60,60,0.2)]">
                  <p className="font-body text-[12px] text-[#FF3C3C] text-center">
                    {loginError}
                  </p>
                </div>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Admin Dashboard ──
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <div className="flex-1 pt-[56px]">
        <div className="max-w-[900px] mx-auto px-5 py-8 md:px-14 md:py-12">

          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase block mb-3">
                PANEL DE ADMINISTRACION
              </span>
              <h1 className="font-display text-[32px] md:text-[42px] leading-[0.95] text-[#111111] mb-2">
                AI <span className="text-primary">PULSE</span> Admin
              </h1>
              <p className="font-body text-[14px] font-light text-[#666666]">
                Gestiona participantes, envia invitaciones y administra el diagnostico.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleOpenDemo}
                className="font-mono text-[9px] uppercase tracking-wider px-3 py-2 border border-primary rounded-[2px] text-primary hover:bg-primary hover:text-white transition-colors"
              >
                ▶ Ver Coach Demo
              </button>
              <button
                onClick={handleLogout}
                className="font-mono text-[9px] uppercase tracking-wider text-[#AAAAAA] hover:text-[#FF3C3C] transition-colors px-3 py-2 border border-[#E0E0E0] hover:border-[rgba(255,60,60,0.3)] rounded-[2px]"
              >
                Cerrar sesion
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-[2px] mb-8 border-b border-[#E0E0E0]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'participants') fetchParticipants();
                  if (tab.id === 'reporteria') { fetchResults(); fetchParticipants(); }
                }}
                className={`
                  px-5 py-3 font-mono text-[10px] uppercase tracking-wider transition-all
                  ${activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary -mb-[1px]'
                    : 'text-[#AAAAAA] hover:text-[#666666]'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Instructions */}
              <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-5">
                <h3 className="font-body text-[14px] font-semibold text-[#111111] mb-3">
                  Formato del Excel
                </h3>
                <p className="font-body text-[12px] font-light text-[#666666] leading-[1.6] mb-3">
                  El archivo Excel (.xlsx) debe contener las siguientes columnas en la primera fila:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#E0E0E0]">
                        {['email', 'nombre', 'posicion', 'empresa', 'departamento'].map((col) => (
                          <th key={col} className="font-mono text-[9px] text-primary uppercase tracking-wider py-2 px-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#EEEEEE]">
                        <td className="font-body text-[11px] text-[#666666] py-2 px-3">juan@empresa.com</td>
                        <td className="font-body text-[11px] text-[#666666] py-2 px-3">Juan Perez</td>
                        <td className="font-body text-[11px] text-[#666666] py-2 px-3">Manager</td>
                        <td className="font-body text-[11px] text-[#666666] py-2 px-3">ACME Corp</td>
                        <td className="font-body text-[11px] text-[#666666] py-2 px-3">Marketing</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#CCCCCC] rounded-[2px] p-10 flex flex-col items-center cursor-pointer hover:border-primary/40 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="text-[32px] mb-3">+</span>
                <p className="font-body text-[13px] text-[#666666] mb-1">
                  {uploadStatus === 'uploading' ? 'Procesando...' : 'Haz clic para seleccionar archivo Excel'}
                </p>
                <p className="font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider">
                  .xlsx o .xls
                </p>
              </div>

              {/* Status Message */}
              {uploadMessage && (
                <div className={`p-4 rounded-[2px] border ${
                  uploadStatus === 'success'
                    ? 'bg-[rgba(0,204,102,0.05)] border-[rgba(0,204,102,0.2)]'
                    : 'bg-[rgba(255,60,60,0.05)] border-[rgba(255,60,60,0.2)]'
                }`}>
                  <p className={`font-body text-[12px] ${
                    uploadStatus === 'success' ? 'text-[#00CC66]' : 'text-[#FF3C3C]'
                  }`}>
                    {uploadMessage}
                  </p>
                </div>
              )}

              {/* Preview of uploaded data */}
              {participants.length > 0 && uploadStatus === 'success' && (
                <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E0E0E0] flex justify-between items-center">
                    <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                      {participants.length} participantes cargados
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[#F7F7F7]">
                        <tr className="border-b border-[#E0E0E0]">
                          {['Email', 'Nombre', 'Posicion', 'Empresa', 'Depto'].map((col) => (
                            <th key={col} className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider py-2 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p, i) => (
                          <tr key={i} className="border-b border-[#EEEEEE] hover:bg-[#EFEFEF]">
                            <td className="font-body text-[11px] text-[#111111] py-2 px-3">{p.email}</td>
                            <td className="font-body text-[11px] text-[#555555] py-2 px-3">{p.nombre}</td>
                            <td className="font-body text-[11px] text-[#666666] py-2 px-3">{p.posicion}</td>
                            <td className="font-body text-[11px] text-[#666666] py-2 px-3">{p.empresa}</td>
                            <td className="font-body text-[11px] text-[#666666] py-2 px-3">{p.departamento}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {participants.length === 0 ? (
                <div className="text-center py-16">
                  <p className="font-body text-[14px] text-[#AAAAAA]">
                    No hay participantes cargados. Sube un Excel primero.
                  </p>
                </div>
              ) : (
                <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E0E0E0] flex justify-between items-center gap-3 flex-wrap">
                    <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                      {participants.length} participantes
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={fetchParticipants}
                        className="text-[9px] h-7 px-3"
                      >
                        Actualizar
                      </Button>
                      <button
                        onClick={() => {
                          const headers = ['Email', 'Nombre', 'Posicion', 'Empresa', 'Departamento', 'Estado'];
                          const rows = participants.map(p => [
                            p.email,
                            p.nombre,
                            p.posicion,
                            p.empresa || '',
                            p.departamento || '',
                            p.status || 'pending'
                          ]);
                          const csv = [headers, ...rows]
                            .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                            .join('\n');
                          const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `aipulse-participantes-${new Date().toISOString().slice(0,10)}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="font-mono text-[9px] uppercase tracking-wider h-7 px-3 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:border-primary hover:text-primary transition-colors"
                      >
                        ↓ Exportar CSV
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#E0E0E0]">
                          {['Email', 'Nombre', 'Empresa', 'Posición', 'Estado', ''].map((col) => (
                            <th key={col} className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider py-2 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p, i) => (
                          <tr key={i} className="border-b border-[#EEEEEE] hover:bg-[#EFEFEF]">
                            <td className="font-body text-[11px] text-[#111111] py-2 px-3">{p.email}</td>
                            <td className="font-body text-[11px] text-[#555555] py-2 px-3">{p.nombre}</td>
                            <td className="font-body text-[11px] text-[#555555] font-medium py-2 px-3">{p.empresa || '—'}</td>
                            <td className="font-body text-[11px] text-[#666666] py-2 px-3">{p.posicion}</td>
                            <td className="py-2 px-3">
                              <select
                                value={p.status || 'pending'}
                                onChange={(e) => handleStatusChange(p.email, e.target.value)}
                                className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] border cursor-pointer bg-transparent ${
                                  p.status === 'completed'
                                    ? 'text-[#00AA55] border-[rgba(0,170,85,0.30)]'
                                    : p.status === 'started'
                                    ? 'text-[#CC8800] border-[rgba(204,136,0,0.30)]'
                                    : p.status === 'invited'
                                    ? 'text-[#5588FF] border-[rgba(85,136,255,0.30)]'
                                    : p.status === 'cancelled'
                                    ? 'text-[#FF3C3C] border-[rgba(255,60,60,0.30)]'
                                    : 'text-[#888888] border-[rgba(0,0,0,0.15)]'
                                }`}
                              >
                                <option value="pending">pending</option>
                                <option value="invited">invited</option>
                                <option value="started">started</option>
                                <option value="completed">completed</option>
                                <option value="cancelled">cancelled</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              {p.status !== 'completed' && (
                                <button
                                  onClick={() => handleResend(p.email, p.empresa)}
                                  className="font-mono text-[8px] uppercase tracking-wider px-2 py-1 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                                >
                                  ↺ Reenviar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Invitations Tab */}
          {activeTab === 'invitations' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-6">
                <h3 className="font-body text-[14px] font-semibold text-[#111111] mb-3">
                  Enviar invitaciones
                </h3>
                <p className="font-body text-[12px] font-light text-[#666666] leading-[1.6] mb-5">
                  Se enviara un correo con un link unico a cada participante que tenga estado "pending".
                  El link contiene un token de acceso que expira en 7 dias.
                </p>

                <Button
                  variant="primary"
                  onClick={handleSendInvitations}
                  disabled={sendingStatus === 'sending'}
                  className="min-h-[48px]"
                >
                  {sendingStatus === 'sending' ? 'Enviando...' : 'Enviar invitaciones pendientes'}
                </Button>
              </div>

              {/* Status Message */}
              {sendingMessage && (
                <div className={`p-4 rounded-[2px] border ${
                  sendingStatus === 'success'
                    ? 'bg-[rgba(0,204,102,0.05)] border-[rgba(0,204,102,0.2)]'
                    : 'bg-[rgba(255,60,60,0.05)] border-[rgba(255,60,60,0.2)]'
                }`}>
                  <p className={`font-body text-[12px] ${
                    sendingStatus === 'success' ? 'text-[#00CC66]' : 'text-[#FF3C3C]'
                  }`}>
                    {sendingMessage}
                  </p>
                </div>
              )}
            </motion.div>
          )}


          {/* ── LINKS DE ACCESO TAB ─────────────────────────────────── */}
          {activeTab === 'links' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-6 space-y-5">
                <div>
                  <h3 className="font-body text-[14px] font-semibold text-[#111111] mb-1">Generar link de acceso por dominio</h3>
                  <p className="font-body text-[12px] font-light text-[#666666] leading-[1.6]">
                    Cualquier persona con el dominio configurado puede entrar sin estar en una lista. El sistema crea su registro automáticamente y aparece en Reportería.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">Nombre de empresa</label>
                    <input
                      type="text"
                      value={linkEmpresa}
                      onChange={e => setLinkEmpresa(e.target.value)}
                      placeholder="ej: Inchskape"
                      className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-body text-[13px] text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">Dominio(s) de correo</label>
                    <input
                      type="text"
                      value={linkDominio}
                      onChange={e => setLinkDominio(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      placeholder="ej: acme.com,acme.cl,acme.com.mx"
                      className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-body text-[13px] text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:border-primary/60 transition-colors"
                    />
                    <p className="font-mono text-[8px] text-[#AAAAAA] mt-1">Para múltiples dominios, sepáralos con coma</p>
                  </div>
                </div>

                {linkEmpresa.trim() && linkDominio.trim() && (
                  <div className="space-y-3">
                    <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block">Link generado</label>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 bg-white border border-[#E0E0E0] rounded-[2px] px-3 py-2 font-mono text-[11px] text-[#555555] break-all select-all">
                        {`${window.location.origin}/acceso?empresa=${encodeURIComponent(linkEmpresa.trim().toLowerCase())}&dominio=${encodeURIComponent(linkDominio.trim())}`}
                      </div>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/acceso?empresa=${encodeURIComponent(linkEmpresa.trim().toLowerCase())}&dominio=${encodeURIComponent(linkDominio.trim())}`;
                          navigator.clipboard.writeText(url);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="font-mono text-[9px] uppercase tracking-wider px-3 py-2 border border-primary rounded-[2px] text-primary hover:bg-primary hover:text-white transition-colors whitespace-nowrap"
                      >
                        {linkCopied ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <p className="font-mono text-[9px] text-[#AAAAAA]">
                      Solo personas con correo {linkDominio.trim().split(',').map((d: string) => `@${d.trim()}`).join(' o ')} podrán acceder.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── REPORTERÍA TAB ───────────────────────────────────────── */}
          {activeTab === 'reporteria' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

              {/* KPIs */}
              {(() => {
                const total = participants.length;
                const completed = participants.filter(p => p.status === 'completed').length;
                const invited = participants.filter(p => p.status === 'invited').length;
                const pending = participants.filter(p => p.status === 'pending').length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total invitados', value: total, color: '#111111' },
                      { label: 'Completados', value: completed, color: '#00AA55' },
                      { label: 'Link enviado', value: invited, color: '#CC8800' },
                      { label: 'Pendientes', value: pending, color: '#AAAAAA' },
                    ].map((kpi, i) => (
                      <div key={i} className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-4">
                        <div className="font-display text-[32px] leading-none mb-1" style={{ color: kpi.color }}>{kpi.value}</div>
                        <div className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA]">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Barra de progreso general */}
              {(() => {
                const total = participants.length;
                const completed = participants.filter(p => p.status === 'completed').length;
                const invited = participants.filter(p => p.status === 'invited').length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const pctInvited = total > 0 ? Math.round((invited / total) * 100) : 0;
                return total > 0 ? (
                  <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#555555]">Tasa de completion</span>
                      <span className="font-display text-[20px] text-primary">{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
                      <div className="h-full flex">
                        <div className="h-full bg-[#00AA55] transition-all duration-500" style={{ width: `${pct}%` }} />
                        <div className="h-full bg-[#FFCC44] transition-all duration-500" style={{ width: `${pctInvited}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="font-mono text-[8px] text-[#AAAAAA] flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#00AA55]"/> Completado
                      </span>
                      <span className="font-mono text-[8px] text-[#AAAAAA] flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full bg-[#FFCC44]"/> Link enviado
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Filtro por empresa */}
              {results.length > 0 && (() => {
                const empresas = Array.from(new Set(results.map(r => r.empresa).filter(Boolean))).sort();
                if (empresas.length < 2) return null;
                return (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] whitespace-nowrap">Filtrar por empresa</span>
                    <select
                      value={filterEmpresa}
                      onChange={e => setFilterEmpresa(e.target.value)}
                      className="bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-3 py-1.5 font-mono text-[11px] text-[#333333] focus:outline-none focus:border-primary/60 transition-colors"
                    >
                      <option value="">Todas las empresas</option>
                      {empresas.map(emp => (
                        <option key={emp} value={emp}>{emp}</option>
                      ))}
                    </select>
                    {filterEmpresa && (
                      <button onClick={() => setFilterEmpresa('')} className="font-mono text-[9px] text-[#AAAAAA] hover:text-primary transition-colors">
                        × limpiar
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Header resultados */}
              {(() => {
                const filtered = filterEmpresa ? results.filter(r => r.empresa === filterEmpresa) : results;
                return (
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                      {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} completo{filtered.length !== 1 ? 's' : ''}
                      {filterEmpresa && <span className="text-[#AAAAAA] ml-2">· {filterEmpresa}</span>}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { fetchResults(); fetchParticipants(); }}
                        className="font-mono text-[9px] uppercase tracking-wider h-7 px-3 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:border-primary hover:text-primary transition-colors"
                      >
                        ↺ Actualizar
                      </button>
                      {filtered.length > 0 && (
                        <button
                          onClick={() => downloadJSON(filtered, `respuestas-${new Date().toISOString().slice(0,10)}.json`)}
                          className="font-mono text-[9px] uppercase tracking-wider h-7 px-3 border border-primary rounded-[2px] text-primary hover:bg-primary hover:text-white transition-colors"
                        >
                          ↓ Descargar{filterEmpresa ? ` ${filterEmpresa}` : ' todo'} JSON
                        </button>
                      )}
                      {filterEmpresa && filtered.length > 0 && (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => generateCompanyReport(filterEmpresa)}
                            disabled={generatingCompanyReport}
                            className="font-mono text-[9px] uppercase tracking-wider h-7 px-3 border border-[#111111] rounded-[2px] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingCompanyReport ? '⏳ Generando (~4 min)...' : `⚡ Informe ${filterEmpresa}`}
                          </button>
                          {generatingCompanyReport && companyProgressMsg && (
                            <p className="font-mono text-[8px] text-[#AAAAAA] tracking-wider animate-pulse">{companyProgressMsg}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {loadingResults ? (
                <div className="text-center py-10">
                  <p className="font-body text-[13px] text-[#AAAAAA]">Cargando resultados...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-[#CCCCCC] rounded-[2px]">
                  <p className="font-body text-[14px] text-[#AAAAAA]">Aún no hay assessments completados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(filterEmpresa ? results.filter(r => r.empresa === filterEmpresa) : results).map((r, i) => {
                    const isExpanded = expandedResult === r.email;
                    const levelColor = r.aiqLevel === 'L4L' || r.aiqLevel === 'L4T' ? '#00AA55' : r.aiqLevel === 'L3' ? '#CC8800' : '#AAAAAA';
                    const scoreWidth = (r.aiqScore / 5) * 100;
                    return (
                      <div key={i} className="border border-[#E0E0E0] rounded-[2px] overflow-hidden">
                        {/* Row header */}
                        <button
                          onClick={() => setExpandedResult(isExpanded ? null : r.email)}
                          className="w-full bg-[#F7F7F7] hover:bg-[#EFEFEF] transition-colors px-5 py-4 flex items-center gap-4 text-left"
                        >
                          {/* Nombre + empresa */}
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-[13px] font-semibold text-[#111111] truncate">{r.nombre}</p>
                            <p className="font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider truncate">{r.empresa} · {r.posicion}</p>
                          </div>

                          {/* AIQ Score bar */}
                          <div className="hidden md:flex flex-col items-end gap-1 w-[120px]">
                            <div className="flex items-center gap-2 w-full">
                              <div className="flex-1 h-[3px] bg-[#E0E0E0] rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all" style={{ width: `${scoreWidth}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-[#555555] w-6 text-right">{r.aiqScore.toFixed(1)}</span>
                            </div>
                            <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: levelColor }}>{r.aiqLevel}</span>
                          </div>

                          {/* Section scores */}
                          <div className="hidden md:flex gap-3">
                            {[['A', r.sectionA], ['B', r.sectionB], ['C', r.sectionC]].map(([sec, val]) => (
                              <div key={sec as string} className="text-center">
                                <div className="font-mono text-[10px] text-[#555555]">{(val as number).toFixed(1)}</div>
                                <div className="font-mono text-[7px] text-[#AAAAAA] uppercase">{sec}</div>
                              </div>
                            ))}
                          </div>

                          {/* Fecha */}
                          <div className="text-right">
                            <p className="font-mono text-[8px] text-[#AAAAAA]">
                              {r.completedAt ? new Date(r.completedAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '—'}
                            </p>
                            <p className="font-mono text-[9px] text-[#AAAAAA] mt-1">{isExpanded ? '▲' : '▼'}</p>
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="bg-white border-t border-[#E0E0E0] p-5 space-y-5">

                            {/* Scores detalle */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { label: 'AIQ Total', value: r.aiqScore.toFixed(2), sub: r.aiqLevel },
                                { label: 'Experiencia Real', value: r.sectionA.toFixed(2), sub: '30%' },
                                { label: 'Criterio Técnico', value: r.sectionB.toFixed(2), sub: '30%' },
                                { label: 'Laboratorio', value: r.sectionC.toFixed(2), sub: '40%' },
                              ].map((s, j) => (
                                <div key={j} className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-3 text-center">
                                  <div className="font-display text-[24px] text-primary leading-none">{s.value}</div>
                                  <div className="font-mono text-[7px] uppercase tracking-wider text-[#555555] mt-1">{s.label}</div>
                                  <div className="font-mono text-[7px] text-[#AAAAAA]">{s.sub}</div>
                                </div>
                              ))}
                            </div>

                            {/* Herramientas que usa */}
                            {r.answers?.V4?.selected?.length > 0 && (
                              <div>
                                <p className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] mb-2">Herramientas que usa</p>
                                <div className="flex flex-wrap gap-2">
                                  {r.answers.V4.selected.map((tool: string) => (
                                    <span key={tool} className="font-mono text-[9px] px-2 py-1 bg-primary/5 border border-primary/20 rounded-[2px] text-primary">{tool}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Respuestas abiertas clave */}
                            <div className="space-y-3">
                              <p className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA]">Respuestas destacadas</p>
                              {[
                                { label: 'Último entregable con IA', value: r.answers?.E2 },
                                { label: 'Seguridad de datos', value: r.answers?.B2 },
                                { label: 'Automatización lograda', value: r.answers?.B5 },
                                { label: 'IA con info de empresa', value: r.answers?.B6 },
                                { label: 'Prompt C1 (email cliente)', value: r.answers?.C1?.text },
                                { label: 'Prompt C2 (mejora)', value: r.answers?.C2?.text },
                                { label: 'Prompt C3 (razonamiento)', value: r.answers?.C3?.text },
                              ].filter(item => item.value && item.value.trim && item.value.trim().length > 3).map((item, k) => (
                                <div key={k} className="border-l-2 border-primary/30 pl-3">
                                  <p className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] mb-1">{item.label}</p>
                                  <p className="font-body text-[12px] text-[#333333] leading-[1.6]">{item.value}</p>
                                </div>
                              ))}
                            </div>

                            {/* Usos de IA este mes */}
                            {r.answers?.B3?.selected?.length > 0 && (
                              <div>
                                <p className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] mb-2">Usos de IA este mes</p>
                                <div className="flex flex-wrap gap-2">
                                  {r.answers.B3.selected.map((uso: string) => (
                                    <span key={uso} className="font-mono text-[9px] px-2 py-1 bg-[#F0F0F0] border border-[#E0E0E0] rounded-[2px] text-[#555555]">{uso}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Acciones */}
                            <div className="flex justify-end gap-2 pt-2 border-t border-[#EEEEEE]">
                              <button
                                onClick={() => downloadJSON(r, `respuestas-${(r.nombre || r.email || 'participante').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`)}
                                className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:border-primary hover:text-primary transition-colors"
                              >
                                ↓ Descargar respuestas JSON
                              </button>
                              <div className="flex flex-col items-end gap-1">
                                <button
                                  onClick={() => generateReport(r.email)}
                                  disabled={generatingReport === r.email}
                                  className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border border-primary rounded-[2px] text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {generatingReport === r.email ? '⏳ Generando (~4 min)...' : '⚡ Generar informe AIQ'}
                                </button>
                                {generatingReport === r.email && reportProgressMsg && (
                                  <p className="font-mono text-[8px] text-[#AAAAAA] tracking-wider animate-pulse">{reportProgressMsg}</p>
                                )}
                              </div>
                            </div>

                            {/* Info personal */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-[#EEEEEE]">
                              {[
                                { label: 'Email', value: r.email },
                                { label: 'Departamento', value: r.departamento },
                                { label: 'Área declarada', value: r.answers?.V1 },
                                { label: 'Apoyo de su jefe', value: r.answers?.D1?.text },
                                { label: 'Challenge Profile', value: r.challengeProfile },
                                { label: 'Completado', value: r.completedAt ? new Date(r.completedAt).toLocaleString('es-CL') : '—' },
                              ].map((field, m) => field.value ? (
                                <div key={m}>
                                  <p className="font-mono text-[7px] uppercase tracking-wider text-[#AAAAAA]">{field.label}</p>
                                  <p className="font-body text-[11px] text-[#333333] mt-0.5">{field.value}</p>
                                </div>
                              ) : null)}
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
