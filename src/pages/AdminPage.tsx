import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Navbar } from '../components/ui/Navbar';
import { Button } from '../components/ui/Button';
import { questions as defaultQuestions } from '../data/questions';

interface ParticipantRow {
  email: string;
  nombre: string;
  posicion: string;
  empresa: string;
  departamento: string;
  token?: string;
  status?: string;
}

type AdminTab = 'upload' | 'participants' | 'empresas' | 'invitations' | 'reporteria' | 'links' | 'archivos' | 'preguntas';

interface CompanyRow {
  empresa: string;
  enabled: boolean;
  totalParticipantes: number;
}

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

// Rúbrica v5 guarda varias respuestas como objetos ({value}, {text}, {selected}, {choice})
// en vez de strings planos — esto extrae un texto renderizable sin importar la forma.
function answerToText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.text === 'string' && val.text.trim()) return val.text;
    if (Array.isArray(val.selected)) return val.selected.join(', ');
    if (typeof val.value === 'number' || typeof val.value === 'string') return String(val.value);
    if (typeof val.choice === 'string') return val.choice;
  }
  return '';
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
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [togglingCompany, setTogglingCompany] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [sendingMessage, setSendingMessage] = useState('');

  // Reportería
  interface ResultRow {
    email: string; nombre: string; empresa: string;
    aiqScore: number; aiqLevel: string; sectionA: number; sectionB: number; sectionC: number;
    flags?: string[]; recomendacionesIds?: string[];
    rubricVersion?: string; completedAt: string; durationMinutes: number | null; answers: Record<string, any>;
  }
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [generatingCompanyReport, setGeneratingCompanyReport] = useState(false);
  const [reportProgressMsg, setReportProgressMsg] = useState('');
  const [companyProgressMsg, setCompanyProgressMsg] = useState('');
  const [generatingPdfZip, setGeneratingPdfZip] = useState(false);
  const [pdfZipProgressMsg, setPdfZipProgressMsg] = useState('');

  // ── Archivos de enriquecimiento ──
  type FileStatus = { exists: boolean; uploadedAt?: string; count?: number; users?: number; filename?: string; size?: number };
  const [companyFiles, setCompanyFiles] = useState<Record<string, FileStatus>>({});
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{ tipo: string; msg: string; ok: boolean } | null>(null);

  const fetchCompanyFiles = async () => {
    try {
      const res = await fetch('/api/company-files-list', { headers: adminHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await res.json();
      setCompanyFiles(data.files || {});
    } catch {}
  };

  const handleCompanyFileUpload = async (tipo: string, file: File) => {
    setUploadingFile(tipo);
    setUploadMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      // Chunked para no explotar el call stack con archivos grandes
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      const res = await fetch('/api/company-upload', {
        method: 'POST',
        headers: { ...adminHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, filename: file.name, data: base64 }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Error del servidor (${res.status})`); }
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      setUploadMsg({ tipo, msg: `✓ ${data.count?.toLocaleString()} registros cargados`, ok: true });
      fetchCompanyFiles();
    } catch (err: any) {
      setUploadMsg({ tipo, msg: err.message, ok: false });
    } finally {
      setUploadingFile(null);
    }
  };

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

  const PDF_ZIP_MSGS = [
    'Generando el PDF de cada participante...',
    'Empaquetando los PDFs en un .zip...',
    'Casi listo...',
  ];
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterRubricVersion, setFilterRubricVersion] = useState<'' | 'v6' | 'v5' | 'legacy'>('');
  const [linkEmpresa, setLinkEmpresa] = useState('');
  const [linkDominio, setLinkDominio] = useState('');

  // ── Preguntas (editor) ─────────────────────────────────────────────────────
  const [qList, setQList] = useState<any[]>(defaultQuestions);
  const [qDirty, setQDirty] = useState(false);
  const [qSaving, setQSaving] = useState(false);
  const [qSaveMsg, setQSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQ, setNewQ] = useState<{ id: string; section: string; type: string; text: string; options: string }>({
    id: '', section: 'D', type: 'open', text: '', options: ''
  });

  const fetchQuestionsConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/questions-config');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setQList(data.questions);
      } else {
        setQList(defaultQuestions);
      }
      setQDirty(false);
    } catch {}
  }, []);

  const saveQuestionsConfig = async () => {
    setQSaving(true);
    setQSaveMsg(null);
    try {
      const token = getAdminToken();
      const res = await fetch('/api/questions-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
        body: JSON.stringify({ questions: qList })
      });
      const data = await res.json();
      if (!res.ok) {
        setQSaveMsg({ ok: false, msg: data.error || 'Error guardando' });
      } else {
        setQSaveMsg({ ok: true, msg: `Guardado · ${data.count} preguntas` });
        setQDirty(false);
      }
    } catch (err: any) {
      setQSaveMsg({ ok: false, msg: err.message || 'Error de red' });
    } finally {
      setQSaving(false);
    }
  };

  const deleteQuestionAt = (idx: number) => {
    setQList(prev => prev.filter((_, i) => i !== idx));
    setQDirty(true);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQList(prev => {
      const arr = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
    setQDirty(true);
  };

  const addQuestion = () => {
    const id = newQ.id.trim();
    const text = newQ.text.trim();
    if (!id || !text) { setQSaveMsg({ ok: false, msg: 'ID y texto son obligatorios' }); return; }
    if (qList.some(q => q.id === id)) { setQSaveMsg({ ok: false, msg: `Ya existe pregunta con id "${id}"` }); return; }

    const q: any = { id, section: newQ.section, type: newQ.type };
    if (newQ.type === 'open') {
      q.text = text;
    } else if (newQ.type === 'mixed_scale') {
      q.scaleText = text;
      const opts = newQ.options.split('\n').map(s => s.trim()).filter(Boolean);
      q.scaleOptions = opts.length > 0
        ? opts.map((label, i) => ({ value: i + 1, label }))
        : [
            { value: 1, label: 'Nivel 1' },
            { value: 2, label: 'Nivel 2' },
            { value: 3, label: 'Nivel 3' },
            { value: 4, label: 'Nivel 4' },
          ];
    } else if (newQ.type === 'mixed_multi') {
      q.multiText = text;
      q.multiOptions = newQ.options.split('\n').map(s => s.trim()).filter(Boolean);
      if (q.multiOptions.length === 0) { setQSaveMsg({ ok: false, msg: 'Debe ingresar al menos una opción (una por línea)' }); return; }
    }
    setQList(prev => [...prev, q]);
    setQDirty(true);
    setShowAddForm(false);
    setNewQ({ id: '', section: 'D', type: 'open', text: '', options: '' });
    setQSaveMsg(null);
  };
  const [linkCopied, setLinkCopied] = useState(false);

  async function safeJsonFetch(res: Response): Promise<any> {
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new Error(`El servidor tardó demasiado o devolvió un error inesperado (HTTP ${res.status}). Intenta de nuevo.`); }
  }

  const generateReport = async (email: string) => {
    setGeneratingReport(email);
    const intervalId = startProgressMessages(setReportProgressMsg, INDIVIDUAL_MSGS, 14000);

    const openReport = (html: string) => {
      window.open(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })), '_blank');
    };

    const pollForIndividual = (pollMs = 12000, maxAttempts = 15) => {
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const res = await fetch('/api/report-generate', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ email }) });
          if (res.status === 401) { handleUnauthorized(); return; }
          const data = await safeJsonFetch(res);
          if (data.html) {
            clearInterval(intervalId); setGeneratingReport(null); setReportProgressMsg('');
            openReport(data.html); return;
          }
          if (attempts < maxAttempts) setTimeout(poll, pollMs);
          else { clearInterval(intervalId); setGeneratingReport(null); setReportProgressMsg(''); alert('El informe está tardando más de lo esperado. Intenta de nuevo en 1 minuto.'); }
        } catch {
          if (attempts < maxAttempts) setTimeout(poll, pollMs);
          else { clearInterval(intervalId); setGeneratingReport(null); setReportProgressMsg(''); }
        }
      };
      setTimeout(poll, pollMs);
    };

    try {
      const res = await fetch('/api/report-generate', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ email }) });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await safeJsonFetch(res);
      if (data.html) { openReport(data.html); return; }
      if (res.status === 202 || data.status === 'generating') {
        setReportProgressMsg('Generando informe... se abrirá automáticamente');
        pollForIndividual(12000, 15); return;
      }
      throw new Error(data.error || `Error ${res.status}`);
    } catch (err: any) {
      clearInterval(intervalId); setGeneratingReport(null); setReportProgressMsg('');
      alert(`Error generando el informe: ${err.message}`);
    }
  };

  const generateCompanyReport = async (empresa: string) => {
    setGeneratingCompanyReport(true);
    const intervalId = startProgressMessages(setCompanyProgressMsg, COMPANY_MSGS, 18000);

    const openReport = (html: string) => {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      window.open(URL.createObjectURL(blob), '_blank');
    };

    const pollForReport = (pollIntervalMs = 15000, maxAttempts = 24) => {
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const res = await fetch('/api/report-generate-company', {
            method: 'POST',
            headers: adminHeaders(),
            body: JSON.stringify({ empresa }),
          });
          if (res.status === 401) { handleUnauthorized(); return; }
          const data = await safeJsonFetch(res);
          if (data.html) {
            clearInterval(intervalId);
            setGeneratingCompanyReport(false);
            setCompanyProgressMsg('');
            openReport(data.html);
            return;
          }
          // Aún generando (202) — seguir esperando
          if (attempts < maxAttempts) {
            setTimeout(poll, pollIntervalMs);
          } else {
            clearInterval(intervalId);
            setGeneratingCompanyReport(false);
            setCompanyProgressMsg('');
            alert(`El informe de ${empresa} está tardando más de lo esperado. Intenta abrir nuevamente en 2 minutos.`);
          }
        } catch {
          // Error de red transitorio — seguir intentando si quedan intentos
          if (attempts < maxAttempts) setTimeout(poll, pollIntervalMs);
          else {
            clearInterval(intervalId);
            setGeneratingCompanyReport(false);
            setCompanyProgressMsg('');
          }
        }
      };
      setTimeout(poll, pollIntervalMs);
    };

    try {
      const res = await fetch('/api/report-generate-company', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ empresa }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      const data = await safeJsonFetch(res);

      if (data.html) {
        // Tenía caché — respuesta inmediata
        openReport(data.html);
        return;
      }
      if (res.status === 202 || data.status === 'generating') {
        // Worker disparado — polling automático cada 15s, hasta 6 minutos
        setCompanyProgressMsg('Generando informe... se abrirá automáticamente cuando esté listo');
        pollForReport(15000, 24);
        return;
      }
      throw new Error(data.error || 'Respuesta inesperada del servidor');
    } catch (err: any) {
      clearInterval(intervalId);
      setGeneratingCompanyReport(false);
      setCompanyProgressMsg('');
      alert(`Error generando el informe de empresa: ${err.message}`);
    }
  };

  const generatePdfZip = async (empresa: string) => {
    setGeneratingPdfZip(true);
    const intervalId = startProgressMessages(setPdfZipProgressMsg, PDF_ZIP_MSGS, 3000);
    try {
      const res = await fetch('/api/report-generate-company-pdf', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ empresa }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) {
        const data = await safeJsonFetch(res);
        throw new Error(data.error || `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reportes-pdf-${empresa.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error generando los PDFs: ${err.message}`);
    } finally {
      clearInterval(intervalId);
      setGeneratingPdfZip(false);
      setPdfZipProgressMsg('');
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

  const handleToggleCompany = async (empresa: string, enabled: boolean) => {
    setTogglingCompany(empresa);
    try {
      const res = await fetch('/api/company-update', {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ empresa, enabled })
      });
      if (res.ok) fetchCompanies();
      else { const d = await res.json(); alert(`Error: ${d.error}`); }
    } catch {
      alert('Error al actualizar empresa');
    } finally {
      setTogglingCompany(null);
    }
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

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies-list', {
        headers: adminHeaders(),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();
      if (data.companies) {
        setCompanies(data.companies);
      }
    } catch (err) {
      console.error('Fetch companies error:', err);
    }
  };

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'upload', label: 'Cargar Excel' },
    { id: 'participants', label: 'Participantes' },
    { id: 'empresas', label: 'Empresas' },
    { id: 'invitations', label: 'Invitaciones' },
    { id: 'links', label: 'Links de Acceso' },
    { id: 'reporteria', label: 'Reportería' },
    { id: 'archivos', label: 'Archivos' },
    { id: 'preguntas', label: 'Preguntas' },
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
            <div className="flex flex-col items-end gap-3 mt-2">
              {/* Tableros */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-widest mr-1">Tableros</span>
                {[
                  { tipo: 'adopcion', label: 'Adopción' },
                  { tipo: 'diagnostico', label: 'Diagnóstico' },
                  { tipo: 'participacion', label: 'Participación' },
                ].map(({ tipo, label }) => (
                  <button
                    key={tipo}
                    onClick={() => window.open(`/dashboard/${tipo}`, '_blank')}
                    className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border border-[#111111] text-[#111111] rounded-[2px] hover:bg-[#111111] hover:text-white transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Acciones */}
              <div className="flex items-center gap-2">
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
          </div>

          {/* Tabs */}
          <div className="flex gap-[2px] mb-8 border-b border-[#E0E0E0]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'participants') fetchParticipants();
                  if (tab.id === 'empresas') fetchCompanies();
                  if (tab.id === 'reporteria') { fetchResults(); fetchParticipants(); }
                  if (tab.id === 'archivos') fetchCompanyFiles();
                  if (tab.id === 'preguntas') fetchQuestionsConfig();
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

          {/* Empresas Tab */}
          {activeTab === 'empresas' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {companies.length === 0 ? (
                <div className="text-center py-16">
                  <p className="font-body text-[14px] text-[#AAAAAA]">
                    No hay empresas cargadas. Sube un Excel de participantes primero.
                  </p>
                </div>
              ) : (
                <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E0E0E0] flex justify-between items-center gap-3 flex-wrap">
                    <span className="font-mono text-[9px] text-primary uppercase tracking-wider">
                      {companies.length} empresas
                    </span>
                    <Button
                      variant="ghost"
                      onClick={fetchCompanies}
                      className="text-[9px] h-7 px-3"
                    >
                      Actualizar
                    </Button>
                  </div>
                  <p className="font-body text-[12px] font-light text-[#666666] leading-[1.6] px-5 pt-4">
                    Desactivar una empresa bloquea <strong>nuevos inicios</strong> de la prueba (por link directo, whitelist o dominio abierto). Quien ya esté respondiendo puede terminar y enviar sin problema.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#E0E0E0]">
                          {['Empresa', 'Participantes', 'Estado'].map((col) => (
                            <th key={col} className="font-mono text-[8px] text-[#AAAAAA] uppercase tracking-wider py-2 px-3">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((c) => (
                          <tr key={c.empresa} className="border-b border-[#EEEEEE] hover:bg-[#EFEFEF]">
                            <td className="font-body text-[11px] text-[#111111] font-medium py-2 px-3">{c.empresa}</td>
                            <td className="font-body text-[11px] text-[#666666] py-2 px-3">{c.totalParticipantes}</td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() => handleToggleCompany(c.empresa, !c.enabled)}
                                disabled={togglingCompany === c.empresa}
                                className={`font-mono text-[8px] uppercase tracking-wider px-3 py-1 rounded-[2px] border transition-colors disabled:opacity-50 ${
                                  c.enabled
                                    ? 'text-[#00AA55] border-[rgba(0,170,85,0.30)] hover:bg-[rgba(0,170,85,0.08)]'
                                    : 'text-[#FF3C3C] border-[rgba(255,60,60,0.30)] hover:bg-[rgba(255,60,60,0.08)]'
                                }`}
                              >
                                {togglingCompany === c.empresa ? '...' : c.enabled ? '✓ Activa' : '✕ Desactivada'}
                              </button>
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

          {/* ── ARCHIVOS TAB ─────────────────────────────────────────── */}
          {activeTab === 'archivos' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="mb-6">
                <h2 className="font-display text-[22px] text-[#111111] mb-1">Archivos de enriquecimiento</h2>
                <p className="font-body text-[13px] text-[#666666]">
                  Sube el maestro de empleados y el reporte de uso de IA para enriquecer los tableros analíticos con datos de jerarquía y actividad Copilot.
                </p>
              </div>

              {(['maestro', 'copilot', 'otro'] as const).map((tipo) => {
                const labels: Record<string, { title: string; desc: string; hint: string }> = {
                  maestro: { title: 'Maestro de empleados', desc: 'Listado completo con jerarquía, área, sucursal y nivel.', hint: 'Col. requeridas: Nombre, Correo, Empresa, Área, Sucursal, Cargo, Nivel, Director CAN' },
                  copilot: { title: 'Datos de uso de IA', desc: 'Reporte de interacciones Copilot por usuario.', hint: 'Sheet "Report" — col. UserId y Count of accesses (pre-agregado por usuario)' },
                  otro:    { title: 'Otro archivo', desc: 'Cualquier xlsx adicional de referencia.', hint: 'Se guarda tal cual como JSON genérico' },
                };
                const { title, desc, hint } = labels[tipo];
                const status = companyFiles[tipo];
                const isUploading = uploadingFile === tipo;
                const msg = uploadMsg?.tipo === tipo ? uploadMsg : null;

                return (
                  <div key={tipo} className="border border-[#E0E0E0] rounded-[2px] p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-body text-[14px] font-semibold text-[#111111]">{title}</span>
                          {status?.exists
                            ? <span className="font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-[2px]">✓ Subido</span>
                            : <span className="font-mono text-[8px] uppercase tracking-wider px-2 py-0.5 bg-[#F5F5F5] text-[#AAAAAA] border border-[#E0E0E0] rounded-[2px]">No cargado</span>
                          }
                        </div>
                        <p className="font-body text-[12px] text-[#666666] mb-1">{desc}</p>
                        <p className="font-mono text-[9px] text-[#AAAAAA]">{hint}</p>
                        {status?.exists && (
                          <div className="mt-2 flex gap-4 font-mono text-[9px] text-[#666666]">
                            {status.count && <span>{status.count.toLocaleString()} registros</span>}
                            {status.users && <span>· {status.users.toLocaleString()} usuarios únicos</span>}
                            {status.uploadedAt && <span>· {new Date(status.uploadedAt).toLocaleDateString('es-CL')}</span>}
                            {status.filename && <span>· {status.filename}</span>}
                          </div>
                        )}
                        {msg && (
                          <p className={`mt-2 font-mono text-[10px] ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.msg}</p>
                        )}
                      </div>
                      <label className={`cursor-pointer font-mono text-[9px] uppercase tracking-wider px-4 py-2 border rounded-[2px] transition-colors whitespace-nowrap ${
                        isUploading
                          ? 'border-[#CCCCCC] text-[#AAAAAA] cursor-not-allowed'
                          : 'border-primary text-primary hover:bg-primary hover:text-white'
                      }`}>
                        {isUploading ? '⏳ Subiendo...' : (status?.exists ? '↑ Reemplazar' : '↑ Subir xlsx')}
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCompanyFileUpload(tipo, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 border-t border-[#E0E0E0]">
                <p className="font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider">
                  Los archivos se usan para enriquecer los tableros analíticos. No afectan las encuestas ni los informes individuales.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── PREGUNTAS TAB ──────────────────────────────────────────── */}
          {activeTab === 'preguntas' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="mb-2">
                <h2 className="font-display text-[22px] text-[#111111] mb-1">Editor de preguntas</h2>
                <p className="font-body text-[13px] text-[#666666]">
                  Lista las preguntas actuales del assessment. Podés eliminar, reordenar o añadir. Usá <code className="font-mono text-[11px] bg-[#F5F5F5] px-1">{'{empresa}'}</code> en el texto para que se reemplace dinámicamente con el nombre de la empresa del participante.
                </p>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 sticky top-[56px] z-10 bg-white py-3 border-b border-[#E0E0E0]">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#555555]">
                    {qList.length} preguntas {qDirty && <span className="text-primary">· sin guardar</span>}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  {qSaveMsg && (
                    <span className={`font-mono text-[10px] ${qSaveMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{qSaveMsg.msg}</span>
                  )}
                  <button
                    onClick={() => setShowAddForm(s => !s)}
                    className="font-mono text-[9px] uppercase tracking-wider px-3 py-2 border border-[#111111] rounded-[2px] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors"
                  >
                    {showAddForm ? '× Cancelar' : '+ Añadir pregunta'}
                  </button>
                  <button
                    onClick={() => { if (confirm('¿Restaurar al set por defecto? Se descartan los cambios no guardados.')) { setQList(defaultQuestions); setQDirty(true); } }}
                    className="font-mono text-[9px] uppercase tracking-wider px-3 py-2 border border-[#CCCCCC] rounded-[2px] text-[#666666] hover:bg-[#F5F5F5] transition-colors"
                  >
                    Restaurar default
                  </button>
                  <button
                    onClick={saveQuestionsConfig}
                    disabled={!qDirty || qSaving}
                    className={`font-mono text-[9px] uppercase tracking-wider px-4 py-2 rounded-[2px] transition-colors ${qDirty && !qSaving ? 'bg-primary text-white border border-primary hover:bg-primary/90' : 'bg-[#F5F5F5] text-[#AAAAAA] border border-[#E0E0E0] cursor-not-allowed'}`}
                  >
                    {qSaving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>

              {/* Add form */}
              {showAddForm && (
                <div className="bg-[#F7F7F7] border border-[#E0E0E0] rounded-[2px] p-5 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">ID (corto, único)</label>
                      <input type="text" value={newQ.id} onChange={e => setNewQ({ ...newQ, id: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="ej: D10" className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-mono text-[12px]" />
                    </div>
                    <div>
                      <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">Sección</label>
                      <select value={newQ.section} onChange={e => setNewQ({ ...newQ, section: e.target.value })} className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-mono text-[12px]">
                        <option value="V">V — punto de partida</option>
                        <option value="A">A — experiencia</option>
                        <option value="B">B — criterio</option>
                        <option value="C">C — ejecución</option>
                        <option value="D">D — cultura</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">Tipo</label>
                      <select value={newQ.type} onChange={e => setNewQ({ ...newQ, type: e.target.value })} className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-mono text-[12px]">
                        <option value="open">Texto abierto</option>
                        <option value="mixed_scale">Escala (1-4)</option>
                        <option value="mixed_multi">Múltiple opción</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">Texto de la pregunta</label>
                    <textarea value={newQ.text} onChange={e => setNewQ({ ...newQ, text: e.target.value })} rows={2} placeholder="ej: ¿Qué herramientas de IA conoces en {empresa}?" className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-body text-[13px]" />
                  </div>
                  {(newQ.type === 'mixed_scale' || newQ.type === 'mixed_multi') && (
                    <div>
                      <label className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] block mb-1">Opciones (una por línea)</label>
                      <textarea value={newQ.options} onChange={e => setNewQ({ ...newQ, options: e.target.value })} rows={5} placeholder={newQ.type === 'mixed_scale' ? "Nivel bajo\nNivel medio\nNivel alto\nMáximo" : "Opción A\nOpción B\nOpción C"} className="w-full bg-white border border-[#CCCCCC] rounded-[2px] px-3 py-2 font-body text-[12px] font-mono" />
                    </div>
                  )}
                  <button onClick={addQuestion} className="font-mono text-[9px] uppercase tracking-wider px-4 py-2 bg-[#111111] text-white rounded-[2px] hover:bg-[#333333]">
                    + Añadir a la lista
                  </button>
                </div>
              )}

              {/* Questions list */}
              <div className="space-y-2">
                {qList.map((q, idx) => {
                  const text = q.text || q.scaleText || q.multiText || q.closedText || '(sin texto)';
                  const opts = q.scaleOptions?.map((o: any) => o.label) || q.multiOptions || q.closedOptions?.map((o: any) => o.label) || [];
                  return (
                    <div key={`${q.id}-${idx}`} className="border border-[#E0E0E0] rounded-[2px] p-4 hover:border-[#CCCCCC] transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col gap-1">
                          <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0} className={`font-mono text-[10px] w-6 h-5 rounded-[2px] ${idx === 0 ? 'text-[#CCCCCC] cursor-not-allowed' : 'text-[#666666] hover:bg-[#F5F5F5]'}`}>▲</button>
                          <button onClick={() => moveQuestion(idx, 1)} disabled={idx === qList.length - 1} className={`font-mono text-[10px] w-6 h-5 rounded-[2px] ${idx === qList.length - 1 ? 'text-[#CCCCCC] cursor-not-allowed' : 'text-[#666666] hover:bg-[#F5F5F5]'}`}>▼</button>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-[#AAAAAA]">#{idx + 1}</span>
                            <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-[2px] text-[#666666]">{q.id}</span>
                            <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-[2px]">{q.section}</span>
                            <span className="font-mono text-[9px] text-[#AAAAAA]">{q.type}</span>
                          </div>
                          <p className="font-body text-[13px] text-[#111111] leading-snug">{text}</p>
                          {opts.length > 0 && (
                            <ul className="mt-2 space-y-0.5">
                              {opts.slice(0, 6).map((o: string, i: number) => (
                                <li key={i} className="font-mono text-[10px] text-[#666666]">· {o}</li>
                              ))}
                              {opts.length > 6 && <li className="font-mono text-[10px] text-[#AAAAAA]">… {opts.length - 6} más</li>}
                            </ul>
                          )}
                        </div>
                        <button
                          onClick={() => { if (confirm(`¿Eliminar pregunta ${q.id}?`)) deleteQuestionAt(idx); }}
                          className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border border-red-300 text-red-600 rounded-[2px] hover:bg-red-50 transition-colors whitespace-nowrap"
                        >
                          × Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── REPORTERÍA TAB ───────────────────────────────────────── */}
          {activeTab === 'reporteria' && (() => {
            const matchesReporteriaFilters = (r: ResultRow) =>
              (!filterEmpresa || r.empresa === filterEmpresa) &&
              (!filterRubricVersion || r.rubricVersion === filterRubricVersion ||
                (filterRubricVersion === 'legacy' && r.rubricVersion !== 'v5' && r.rubricVersion !== 'v6'));

            return (
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

              {/* Filtro por empresa + versión de rúbrica */}
              {results.length > 0 && (() => {
                const empresas = Array.from(new Set(results.map(r => r.empresa).filter(Boolean))).sort();
                return (
                  <div className="flex items-center gap-3 flex-wrap">
                    {empresas.length >= 2 && (
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
                    )}
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] whitespace-nowrap">Filtrar por rúbrica</span>
                      <select
                        value={filterRubricVersion}
                        onChange={e => setFilterRubricVersion(e.target.value as '' | 'v6' | 'v5' | 'legacy')}
                        className="bg-[#F7F7F7] border border-[#CCCCCC] rounded-[2px] px-3 py-1.5 font-mono text-[11px] text-[#333333] focus:outline-none focus:border-primary/60 transition-colors"
                      >
                        <option value="">Todas las versiones</option>
                        <option value="v6">Rúbrica V6</option>
                        <option value="v5">Rúbrica V5 (histórica)</option>
                        <option value="legacy">Legacy (pre-V5)</option>
                      </select>
                      {filterRubricVersion && (
                        <button onClick={() => setFilterRubricVersion('')} className="font-mono text-[9px] text-[#AAAAAA] hover:text-primary transition-colors">
                          × limpiar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Header resultados */}
              {(() => {
                const filtered = results.filter(matchesReporteriaFilters);
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
                      {filterEmpresa && filtered.length > 0 && (
                        <div className="flex flex-col items-end gap-1">
                          <button
                            onClick={() => generatePdfZip(filterEmpresa)}
                            disabled={generatingPdfZip}
                            className="font-mono text-[9px] uppercase tracking-wider h-7 px-3 border border-[#111111] rounded-[2px] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {generatingPdfZip ? '⏳ Generando PDFs...' : 'Extraer reportes PDF'}
                          </button>
                          {generatingPdfZip && pdfZipProgressMsg && (
                            <p className="font-mono text-[8px] text-[#AAAAAA] tracking-wider animate-pulse">{pdfZipProgressMsg}</p>
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
                  {results.filter(matchesReporteriaFilters).map((r, i) => {
                    const isExpanded = expandedResult === r.email;
                    const levelColor = r.aiqLevel === 'L4' || r.aiqLevel === 'L4L' || r.aiqLevel === 'L4T' ? '#00AA55' : r.aiqLevel === 'L3' ? '#CC8800' : '#AAAAAA';
                    // Rúbrica v5/v6: escala 1.0-4.0. Registros legacy (pre-migración): escala 0-5.
                    const scoreMax = (r.rubricVersion === 'v5' || r.rubricVersion === 'v6') ? 4 : 5;
                    const scoreWidth = (r.aiqScore / scoreMax) * 100;
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
                            <p className="font-mono text-[9px] text-[#AAAAAA] uppercase tracking-wider truncate">{r.empresa}</p>
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
                            {r.answers?.V2?.selected?.length > 0 && (
                              <div>
                                <p className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA] mb-2">Herramientas que usa</p>
                                <div className="flex flex-wrap gap-2">
                                  {r.answers.V2.selected.map((tool: string) => (
                                    <span key={tool} className="font-mono text-[9px] px-2 py-1 bg-primary/5 border border-primary/20 rounded-[2px] text-primary">{tool}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Respuestas abiertas clave */}
                            <div className="space-y-3">
                              <p className="font-mono text-[8px] uppercase tracking-wider text-[#AAAAAA]">Respuestas destacadas</p>
                              {[
                                { label: 'Último entregable con IA', value: answerToText(r.answers?.E2) },
                                { label: 'Seguridad de datos', value: answerToText(r.answers?.B2) },
                                { label: 'Automatización lograda', value: answerToText(r.answers?.B4) },
                                { label: 'Prompt C1 (email cliente)', value: answerToText(r.answers?.C1) },
                                { label: 'Prompt C2 (mejora)', value: answerToText(r.answers?.C2) },
                                { label: 'Prompt C3 (razonamiento)', value: answerToText(r.answers?.C3) },
                              ].filter(item => item.value && item.value.trim().length > 3).map((item, k) => (
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
                                { label: 'Relación con la IA (V1)', value: answerToText(r.answers?.V1) },
                                { label: 'Apoyo de su jefe', value: answerToText(r.answers?.D1) },
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
            );
          })()}

        </div>
      </div>
    </div>
  );
}
