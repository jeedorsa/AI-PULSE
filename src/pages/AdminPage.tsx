import React, { useState, useRef } from 'react';
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

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('upload');
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [sendingMessage, setSendingMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('uploading');
    setUploadMessage('');

    try {
      const arrayBuffer = await file.arrayBuffer();

      const response = await fetch('/api/participants/upload', {
        method: 'POST',
        body: arrayBuffer,
        headers: { 'Content-Type': 'application/octet-stream' },
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        setUploadStatus('error');
        setUploadMessage(data.error || 'Error al procesar el archivo');
        return;
      }

      setParticipants(data.participants || []);
      setUploadStatus('success');
      setUploadMessage(`${data.participants?.length || 0} participantes cargados correctamente`);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus('error');
      setUploadMessage('Error al subir el archivo. Intenta de nuevo.');
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
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendAll: true }),
      });

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
      const response = await fetch('/api/participants/list');
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

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col">
      <Navbar />

      <div className="flex-1 pt-[56px]">
        <div className="max-w-[900px] mx-auto px-5 py-8 md:px-14 md:py-12">

          {/* Header */}
          <div className="mb-8">
            <span className="font-mono text-[9px] tracking-[0.4em] text-primary uppercase block mb-3">
              PANEL DE ADMINISTRACION
            </span>
            <h1 className="font-display text-[32px] md:text-[42px] leading-[0.95] text-white mb-2">
              AI <span className="text-primary">PULSE</span> Admin
            </h1>
            <p className="font-body text-[14px] font-light text-[#808080]">
              Gestiona participantes, envia invitaciones y administra el diagnostico.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-[2px] mb-8 border-b border-[#1a1a1a]">
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
                    : 'text-[#4D4D4D] hover:text-[#808080]'
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
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-[2px] p-5">
                <h3 className="font-body text-[14px] font-semibold text-white mb-3">
                  Formato del Excel
                </h3>
                <p className="font-body text-[12px] font-light text-[#808080] leading-[1.6] mb-3">
                  El archivo Excel (.xlsx) debe contener las siguientes columnas en la primera fila:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#1a1a1a]">
                        {['email', 'nombre', 'posicion', 'empresa', 'departamento'].map((col) => (
                          <th key={col} className="font-mono text-[9px] text-primary uppercase tracking-wider py-2 px-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#111]">
                        <td className="font-body text-[11px] text-[#808080] py-2 px-3">juan@empresa.com</td>
                        <td className="font-body text-[11px] text-[#808080] py-2 px-3">Juan Perez</td>
                        <td className="font-body text-[11px] text-[#808080] py-2 px-3">Manager</td>
                        <td className="font-body text-[11px] text-[#808080] py-2 px-3">ACME Corp</td>
                        <td className="font-body text-[11px] text-[#808080] py-2 px-3">Marketing</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#2a2a2a] rounded-[2px] p-10 flex flex-col items-center cursor-pointer hover:border-primary/40 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="text-[32px] mb-3">+</span>
                <p className="font-body text-[13px] text-[#808080] mb-1">
                  {uploadStatus === 'uploading' ? 'Procesando...' : 'Haz clic para seleccionar archivo Excel'}
                </p>
                <p className="font-mono text-[9px] text-[#4D4D4D] uppercase tracking-wider">
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
                <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-[2px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#1a1a1a] flex justify-between items-center">
                    <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                      {participants.length} participantes cargados
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[#0f0f0f]">
                        <tr className="border-b border-[#1a1a1a]">
                          {['Email', 'Nombre', 'Posicion', 'Empresa', 'Depto'].map((col) => (
                            <th key={col} className="font-mono text-[8px] text-[#4D4D4D] uppercase tracking-wider py-2 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p, i) => (
                          <tr key={i} className="border-b border-[#111] hover:bg-[#161616]">
                            <td className="font-body text-[11px] text-white py-2 px-3">{p.email}</td>
                            <td className="font-body text-[11px] text-[#B3B3B3] py-2 px-3">{p.nombre}</td>
                            <td className="font-body text-[11px] text-[#808080] py-2 px-3">{p.posicion}</td>
                            <td className="font-body text-[11px] text-[#808080] py-2 px-3">{p.empresa}</td>
                            <td className="font-body text-[11px] text-[#808080] py-2 px-3">{p.departamento}</td>
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
                  <p className="font-body text-[14px] text-[#4D4D4D]">
                    No hay participantes cargados. Sube un Excel primero.
                  </p>
                </div>
              ) : (
                <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-[2px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#1a1a1a] flex justify-between items-center">
                    <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                      {participants.length} participantes
                    </span>
                    <Button
                      variant="ghost"
                      onClick={fetchParticipants}
                      className="text-[9px] h-7 px-3"
                    >
                      Actualizar
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#1a1a1a]">
                          {['Email', 'Nombre', 'Posicion', 'Estado'].map((col) => (
                            <th key={col} className="font-mono text-[8px] text-[#4D4D4D] uppercase tracking-wider py-2 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p, i) => (
                          <tr key={i} className="border-b border-[#111] hover:bg-[#161616]">
                            <td className="font-body text-[11px] text-white py-2 px-3">{p.email}</td>
                            <td className="font-body text-[11px] text-[#B3B3B3] py-2 px-3">{p.nombre}</td>
                            <td className="font-body text-[11px] text-[#808080] py-2 px-3">{p.posicion}</td>
                            <td className="py-2 px-3">
                              <span className={`font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] ${
                                p.status === 'completed'
                                  ? 'text-[#00CC66] bg-[rgba(0,204,102,0.08)]'
                                  : p.status === 'started'
                                  ? 'text-[#FFD600] bg-[rgba(255,214,0,0.08)]'
                                  : 'text-[#4D4D4D] bg-[rgba(77,77,77,0.08)]'
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
              <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-[2px] p-6">
                <h3 className="font-body text-[14px] font-semibold text-white mb-3">
                  Enviar invitaciones
                </h3>
                <p className="font-body text-[12px] font-light text-[#808080] leading-[1.6] mb-5">
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
