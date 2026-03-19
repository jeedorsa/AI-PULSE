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

type AdminTab = 'upload' | 'participants' | 'invitations';

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

        </div>
      </div>
    </div>
  );
}
