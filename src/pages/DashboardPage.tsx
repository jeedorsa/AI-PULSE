import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const DASHBOARDS: Record<string, { title: string }> = {
  adopcion:     { title: 'Dashboard de Adopción' },
  diagnostico:  { title: 'Diagnóstico AI Pulse' },
  participacion: { title: 'Participación' },
};

export default function DashboardPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const dashboard = DASHBOARDS[tipo || ''];

  useEffect(() => {
    const token = sessionStorage.getItem('aipulse_admin_token');
    if (!token || !dashboard) {
      navigate('/admin', { replace: true });
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/dashboard-html?type=${tipo}`, {
      headers: { 'X-Admin-Token': token },
    })
      .then(res => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.text();
      })
      .then(html => {
        // Crear blob URL para cargar en iframe (mismo origen)
        const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    return () => {
      setBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [tipo, dashboard, navigate]);

  if (!dashboard) return null;

  return (
    <div className="flex flex-col h-screen bg-[#111111]">
      {/* Navbar */}
      <div className="flex items-center gap-4 px-5 h-[52px] bg-[#111111] border-b border-white/10 shrink-0">
        <button
          onClick={() => navigate('/admin')}
          className="font-mono text-[10px] text-[#AAAAAA] hover:text-white uppercase tracking-widest transition-colors"
        >
          ← Admin
        </button>
        <div className="w-px h-4 bg-white/10" />
        <span className="font-mono text-[10px] text-white uppercase tracking-widest">
          {dashboard.title}
        </span>
        {loading && (
          <span className="font-mono text-[9px] text-[#FE3C1C] uppercase tracking-widest animate-pulse ml-2">
            Cargando datos…
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="font-display text-[18px] text-[#FE3C1C] tracking-widest">AI·PULSE</span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center bg-[#111111]">
          <div className="text-center">
            <p className="font-mono text-[12px] text-[#FE3C1C] mb-2 uppercase tracking-widest">Error cargando dashboard</p>
            <p className="font-mono text-[10px] text-[#AAAAAA]">{error}</p>
            <button
              onClick={() => navigate('/admin')}
              className="mt-6 font-mono text-[10px] uppercase tracking-widest text-white border border-white/20 px-4 py-2 hover:border-[#FE3C1C] hover:text-[#FE3C1C] transition-colors"
            >
              ← Volver al admin
            </button>
          </div>
        </div>
      )}

      {/* Dashboard iframe */}
      {!error && (
        <iframe
          ref={iframeRef}
          src={blobUrl || 'about:blank'}
          className="flex-1 w-full border-0"
          title={dashboard.title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.3s' }}
        />
      )}
    </div>
  );
}
