import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { questions as defaultQuestions } from '../data/questions';

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface AIQResult {
  score: number;
  level: string;
  levelName: string;
  sectionScores: {
    A: { avg: number; level: string };
    B: { avg: number; level: string };
    C: { avg: number; level: string };
  };
  alerts: string[];
  flags: string[];
  challengeProfile: string;
  regla1_aplicada: boolean;
  regla2_aplicada: boolean;
  regla3_flag: boolean;
  regla4_aplicada: boolean;
  pausa: boolean;
  motivo_pausa: string | null;
}

interface Participant {
  nombre: string;
  email: string;
  empresa: string;
  posicion: string;
  departamento: string;
  token: string;
}

interface AssessmentState {
  userRole: 'csuite' | 'manager' | 'colaborador' | 'independiente' | null;
  currentQuestion: number;
  answers: Record<string, any>;
  currentSection: string;
  aiqResult: AIQResult | null;
  startTime: number | null;
  isEnterprise: boolean;
  aiScores: Record<string, number>;       // scores finales por questionId (del API)
  aiFlags: Record<string, string[]>;      // flags por pregunta del API
  gradingStatus: 'idle' | 'loading' | 'done' | 'error';
  participant: Participant | null;
  participantToken: string | null;
  isAdmin: boolean;
  questions: any[];
  questionsLoaded: boolean;

  setRole: (role: 'csuite' | 'manager' | 'colaborador' | 'independiente') => void;
  setEnterprise: (isEnterprise: boolean) => void;
  setParticipant: (participant: Participant) => void;
  setParticipantToken: (token: string) => void;
  setAdmin: (isAdmin: boolean) => void;
  setQuestions: (questions: any[]) => void;
  loadQuestions: () => Promise<void>;
  answerQuestion: (questionId: string, value: any) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  restoreProgress: (currentQuestion: number, answers: Record<string, any>) => void;
  calculateAIQ: () => AIQResult;
  reset: () => void;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getLevelFromScore = (score: number): { level: string; name: string } => {
  if (score < 2.0)  return { level: 'L1',  name: 'Novato' };
  if (score < 3.0)  return { level: 'L2',  name: 'Experimentador' };
  if (score < 4.0)  return { level: 'L3',  name: 'Practicante' };
  if (score <= 4.5) return { level: 'L4T', name: 'Amplificador Técnico' };
  return              { level: 'L4L', name: 'Amplificador Estratégico' };
};

/**
 * Extrae el score numérico local de una respuesta (fallback cuando el API no ha
 * corrido todavía). Lo usa SOLO calculateAIQ como respaldo —
 * el score del API siempre tiene prioridad.
 */
const localScore = (ans: any, questionId: string): number => {
  if (!ans) return 0;

  // Preguntas de escala — el value ya es 1-5
  if (typeof ans === 'object' && typeof ans.value === 'number') return ans.value;

  // PromptInput — score calculado por PromptingIDE (chips RCTFR)
  if (typeof ans === 'object' && typeof ans.score === 'number') return ans.score;

  // Respuestas de texto — heurística por longitud (fallback básico)
  const text = typeof ans === 'string' ? ans : ans?.text || '';
  if (!text || text.length < 10) return 1;
  if (text.length < 50)  return 2;
  if (text.length < 150) return 3;
  return 4;
};

// ─── STORE ────────────────────────────────────────────────────────────────────

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set, get) => ({
      userRole: null,
      currentQuestion: 0,
      answers: {},
      currentSection: 'A',
      aiqResult: null,
      startTime: null,
      isEnterprise: false,
      aiScores: {},
      aiFlags: {},
      gradingStatus: 'idle',
      participant: null,
      participantToken: null,
      isAdmin: false,
      questions: defaultQuestions,
      questionsLoaded: false,

      // ── Setters básicos ─────────────────────────────────────────────────────

      setRole: (role) => set({ userRole: role, startTime: Date.now() }),
      setEnterprise: (isEnterprise) => set({ isEnterprise }),
      setQuestions: (qs) => set({ questions: qs, questionsLoaded: true }),
      loadQuestions: async () => {
        try {
          const res = await fetch('/api/questions-config');
          if (!res.ok) { set({ questionsLoaded: true }); return; }
          const data = await res.json();
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            set({ questions: data.questions, questionsLoaded: true });
          } else {
            set({ questionsLoaded: true });
          }
        } catch {
          set({ questionsLoaded: true });
        }
      },

      setParticipant: (participant) => {
        const positionToRole = (pos: string): AssessmentState['userRole'] => {
          const lower = pos.toLowerCase();
          if (lower.includes('c-suite') || lower.includes('vp') || lower.includes('director')) return 'csuite';
          if (lower.includes('manager') || lower.includes('lead') || lower.includes('líder') || lower.includes('jefe')) return 'manager';
          if (lower.includes('independiente') || lower.includes('freelance') || lower.includes('consultor')) return 'independiente';
          return 'colaborador';
        };
        set({
          participant,
          participantToken: participant.token,
          userRole: positionToRole(participant.posicion),
          startTime: Date.now(),
          isEnterprise: true,
          // Reset siempre al identificar un nuevo participante.
          // Si hay progreso guardado en API, restoreProgress() lo sobrescribe después.
          currentQuestion: 0,
          answers: {},
          aiqResult: null,
        });
      },

      setParticipantToken: (token) => set({ participantToken: token }),
      setAdmin: (isAdmin) => set({ isAdmin }),

      // ── Navegación y guardado de progreso ──────────────────────────────────

      answerQuestion: (questionId, value) => {
        set((state) => {
          const newAnswers = { ...state.answers, [questionId]: value };
          const token = state.participantToken;
          const currentQuestion = state.currentQuestion;
          if (token) {
            clearTimeout((window as any).__progressSaveTimer);
            (window as any).__progressSaveTimer = setTimeout(() => {
              fetch('/api/progress-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, currentQuestion, answers: newAnswers })
              }).catch(() => {});
            }, 1500);
          }
          return { answers: newAnswers };
        });
      },

      nextQuestion: () => {
        set((state) => {
          const nextIndex = state.currentQuestion + 1;
          const token = state.participantToken;
          if (token && nextIndex < get().questions.length) {
            fetch('/api/progress-save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, currentQuestion: nextIndex, answers: state.answers })
            }).catch(() => {});
          }
          if (nextIndex < get().questions.length) {
            return { currentQuestion: nextIndex, currentSection: get().questions[nextIndex].section as any };
          }
          return { currentQuestion: nextIndex };
        });
      },

      prevQuestion: () => {
        set((state) => {
          const prevIndex = state.currentQuestion - 1;
          if (prevIndex >= 0) {
            return { currentQuestion: prevIndex, currentSection: get().questions[prevIndex].section as any };
          }
          return {};
        });
      },

      restoreProgress: (currentQuestion, answers) => {
        const section = get().questions[currentQuestion]?.section || 'A';
        set({ currentQuestion, answers, currentSection: section as any });
      },

      // ── CÁLCULO AIQ FINAL ──────────────────────────────────────────────────
      /**
       * Implementa exactamente el framework del SKILL aiq-evaluator:
       *
       * Fórmula:
       *   A = (E2×0.35) + (E3×0.20) + (E4×0.15) + (E5×0.30)
       *   B = pesos dinámicos según perfil_con_automatizacion
       *   C = (C1×0.30) + (C2×0.30) + (C3×0.40)
       *   AIQ_Base = (A×0.30) + (B×0.30) + (C×0.40)
       *
       * Reglas (en orden):
       *   Regla 1 — Piso de Seguridad: SOLO si B2=L1 (score=1) → AIQ_Final ≤ 2.9
       *   Regla 2 — Techo Consistencia: AIQ≥4.0 y <2 secciones ≥4.0 → AIQ=3.9
       *   Regla 3 — Desequilibrio: max_sección - min_sección ≥ 2 → flag (sin cambio de score)
       *   Regla 4 — Confirmación L4-L: AIQ≥4.6 y <2 señales L4-L → AIQ=4.5
       *
       * Intenta llamar al API consolidate primero para usar la lógica del servidor.
       * Si falla, aplica la misma lógica localmente como fallback.
       */
      calculateAIQ: () => {
        const { answers, aiScores, aiFlags } = get();

        // Recopilar todos los flags activos de todas las preguntas
        const allFlags: string[] = [];
        Object.values(aiFlags).forEach(flags => allFlags.push(...flags));

        // Detectar perfil_con_automatizacion
        // TODO: ajustar pesos de fórmulas para Inchcape v1.0 la próxima semana
        const perfilConAutomatizacion = false; // B3/B5 eliminados

        // Obtener score final por pregunta (API tiene prioridad sobre local)
        const getScore = (id: string): number => {
          if (aiScores[id] !== undefined) return aiScores[id];
          return localScore(answers[id], id);
        };

        // ── Sección A (peso total: 0.30) — temporal hasta ajuste v1.0 ────────
        const A = (getScore('E2') * 0.40) +
                  (getScore('E3') * 0.25) +
                  (getScore('E5') * 0.35);

        // ── Sección B (peso total: 0.30) — temporal hasta ajuste v1.0 ────────
        const B = (getScore('B1') * 0.30) +
                  (getScore('B2') * 0.40) +
                  (getScore('B4') * 0.30);

        // ── Sección C (peso total: 0.40) ────────────────────────────────────
        const C = (getScore('C1') * 0.30) +
                  (getScore('C2') * 0.30) +
                  (getScore('C3') * 0.40);

        const aiq_base = (A * 0.30) + (B * 0.30) + (C * 0.40);
        let aiq_final  = aiq_base;
        const alerts: string[] = [];
        let regla1 = false, regla2 = false, regla3 = false, regla4 = false;
        let pausa = false, motivo_pausa: string | null = null;

        // ── Regla 1: Piso de Seguridad ──────────────────────────────────────
        // SOLO se activa si B2 = L1 (score = 1). Ninguna otra pregunta activa esta regla.
        const b2Score = getScore('B2');
        if (b2Score === 1 || allFlags.includes('regla1_activa')) {
          regla1 = true;
          if (aiq_final > 2.9) aiq_final = 2.9;
          alerts.push('REGLA_1');
          pausa = true;
          motivo_pausa = 'B2=L1 — riesgo de seguridad crítico (Regla 1)';
        }

        // ── Regla 2: Techo de Consistencia ──────────────────────────────────
        const sectionsAbove4 = [A, B, C].filter(x => x >= 4.0).length;
        if (!regla1 && aiq_final >= 4.0 && sectionsAbove4 < 2) {
          regla2 = true;
          aiq_final = 3.9;
          alerts.push('REGLA_2');
        }

        // ── Regla 3: Perfil Desequilibrado (solo flag) ───────────────────────
        const maxS = Math.max(A, B, C);
        const minS = Math.min(A, B, C);
        if (maxS - minS >= 2.0) {
          regla3 = true;
          alerts.push('REGLA_3_DESEQUILIBRIO');
          if (aiq_final >= 4.0) {
            pausa = true;
            motivo_pausa = motivo_pausa || 'Perfil desequilibrado con AIQ ≥ 4.0';
          }
        }

        // ── Regla 4: Confirmación L4-L ───────────────────────────────────────
        const l4lSignals = ['senial_l4l_e5', 'senial_l4l_d5', 'senial_l4l_d6']
          .filter(f => allFlags.includes(f));
        if (!regla1 && !regla2 && aiq_final >= 4.6 && l4lSignals.length < 2) {
          regla4 = true;
          aiq_final = 4.5;
          alerts.push('REGLA_4');
        }

        aiq_final = Math.round(aiq_final * 100) / 100;
        const finalLevel = getLevelFromScore(aiq_final);

        // ── Challenge Profile ────────────────────────────────────────────────
        let challengeProfile = 'balanced';
        if (B < A - 0.8 && B < C - 0.8)      challengeProfile = 'technical_gap';
        else if (C < A - 0.8 && C < B - 0.8) challengeProfile = 'prompting_gap';
        else if (A > 4.0 && B > 4.0 && C > 4.0) challengeProfile = 'leader';

        const result: AIQResult = {
          score:     aiq_final,
          level:     finalLevel.level,
          levelName: finalLevel.name,
          sectionScores: {
            A: { avg: Math.round(A * 100) / 100, level: getLevelFromScore(A).level },
            B: { avg: Math.round(B * 100) / 100, level: getLevelFromScore(B).level },
            C: { avg: Math.round(C * 100) / 100, level: getLevelFromScore(C).level }
          },
          alerts,
          flags: allFlags,
          challengeProfile,
          regla1_aplicada: regla1,
          regla2_aplicada: regla2,
          regla3_flag:     regla3,
          regla4_aplicada: regla4,
          pausa,
          motivo_pausa
        };

        set({ aiqResult: result });
        return result;
      },

      reset: () => set({
        userRole: null,
        currentQuestion: 0,
        answers: {},
        currentSection: 'A',
        aiqResult: null,
        startTime: null,
        isEnterprise: false,
        aiScores: {},
        aiFlags: {},
        gradingStatus: 'idle',
        participant: null,
        participantToken: null,
        isAdmin: false,
      }),
    }),
    {
      name: 'assessment-storage',
      partialize: (state) => ({
        userRole:         state.userRole,
        currentQuestion:  state.currentQuestion,
        answers:          state.answers,
        currentSection:   state.currentSection,
        aiqResult:        state.aiqResult,
        startTime:        state.startTime,
        isEnterprise:     state.isEnterprise,
        aiScores:         state.aiScores,
        aiFlags:          state.aiFlags,
        participant:      state.participant,
        participantToken: state.participantToken,
        isAdmin:          state.isAdmin,
      }),
    }
  )
);
