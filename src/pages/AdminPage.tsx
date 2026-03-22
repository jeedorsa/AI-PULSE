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

type AdminTab = 'upload' | 'participants' | 'invitations' | 'reporteria';

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

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
    if (!loginPassword.trim()) return;

    setLoginLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.authenticated) {
        setLoginError(data.error || 'Contrasena incorrecta');
        setLoginLoading(false);
        return;
      }

      setAdminToken(data.token);
      setIsAuthenticated(true);
      setLoginPassword('');
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Error de conexion. Intenta de nuevo.');
    }
    setLoginLoading(false);
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
                Ingresa la contrasena de administrador
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Contrasena"
                  autoFocus
                  className="w-full bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-4 py-3
                    font-body text-[14px] text-[#111111] placeholder-[#AAAAAA]
                    focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              <Button
                variant="primary"
                type="submit"
                disabled={loginLoading || !loginPassword.trim()}
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
            <button
              onClick={handleLogout}
              className="font-mono text-[9px] uppercase tracking-wider text-[#AAAAAA] hover:text-[#FF3C3C] transition-colors mt-2 px-3 py-2 border border-[#E0E0E0] hover:border-[rgba(255,60,60,0.3)] rounded-[2px]"
            >
              Cerrar sesion
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-[2px] mb-8 border-b border-[#E0E0E0]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'participants') fetchParticipants();
                  if (tab.id === 'reporteria') fetchResults();
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
                          {['Email', 'Nombre', 'Empresa', 'Posición', 'Estado'].map((col) => (
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
                              <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] border ${
                                p.status === 'completed'
                                  ? 'text-[#00AA55] bg-[rgba(0,170,85,0.08)] border-[rgba(0,170,85,0.20)]'
                                  : p.status === 'started'
                                  ? 'text-[#CC8800] bg-[rgba(204,136,0,0.08)] border-[rgba(204,136,0,0.20)]'
                                  : 'text-[#888888] bg-[rgba(0,0,0,0.04)] border-[rgba(0,0,0,0.10)]'
                              }`}>
                                {p.status || 'pending'}
                              </span>
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

              {/* Header resultados */}
              <div className="flex justify-between items-center">
                <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                  {results.length} resultado{results.length !== 1 ? 's' : ''} completo{results.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => {
                    fetchResults();
                    fetchParticipants();
                  }}
                  className="font-mono text-[9px] uppercase tracking-wider h-7 px-3 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:border-primary hover:text-primary transition-colors"
                >
                  ↺ Actualizar
                </button>
              </div>

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
                  {results.map((r, i) => {
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
