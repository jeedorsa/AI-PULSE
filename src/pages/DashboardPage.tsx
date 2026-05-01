import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAssessmentStore } from '../store/useAssessmentStore';

const DASHBOARDS: Record<string, { title: string; file: string }> = {
  adopcion: {
    title: 'Dashboard de Adopción',
    file: '/dashboards/dashboard-adopcion.html',
  },
  diagnostico: {
    title: 'Diagnóstico AI Pulse',
    file: '/dashboards/dashboard-diagnostico.html',
  },
  participacion: {
    title: 'Participación',
    file: '/dashboards/dashboard-participacion.html',
  },
};

export default function DashboardPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  // Reusar el token de admin que ya está en sessionStorage
  const dashboard = DASHBOARDS[tipo || ''];

  useEffect(() => {
    const token = sessionStorage.getItem('aipulse_admin_token');
    if (!token || !dashboard) {
      navigate('/admin', { replace: true });
    }
  }, [dashboard, navigate]);

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
        <div className="ml-auto flex items-center gap-2">
          <span className="font-display text-[18px] text-[#FE3C1C] tracking-widest">AI·PULSE</span>
        </div>
      </div>

      {/* Dashboard iframe */}
      <iframe
        src={dashboard.file}
        className="flex-1 w-full border-0"
        title={dashboard.title}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
