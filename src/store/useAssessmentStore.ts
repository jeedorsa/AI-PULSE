import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { questions } from '../data/questions';
import { gradeAnswer } from '../lib/geminiClient';

interface SectionScore {
  avg: number;
  level: string;
}

interface AIQResult {
  score: number;
  level: string;
  levelName: string;
  sectionScores: {
    A: SectionScore;
    B: SectionScore;
    C: SectionScore;
  };
  alerts: string[];
  challengeProfile: string;
}

export interface Participant {
  email: string;
  nombre: string;
  posicion: string;
  empresa: string;
  departamento: string;
  token: string;
}

interface AssessmentState {
  userRole: 'csuite' | 'manager' | 'colaborador' | 'independiente' | null;
  currentQuestion: number;
  answers: Record<string, any>;
  currentSection: 'A' | 'B' | 'C' | 'D' | 'GAPS';
  aiqResult: AIQResult | null;
  startTime: number | null;
  isEnterprise: boolean;
  aiScores: Record<string, number>;   // scores de Azure OpenAI por questionId
  gradingStatus: 'idle' | 'loading' | 'done' | 'error';

  // ── Token-based auth ──
  participant: Participant | null;
  participantToken: string | null;
  isAdmin: boolean;

  setRole: (role: 'csuite' | 'manager' | 'colaborador' | 'independiente') => void;
  setEnterprise: (isEnterprise: boolean) => void;
  setParticipant: (participant: Participant) => void;
  setParticipantToken: (token: string) => void;
  setAdmin: (isAdmin: boolean) => void;
  answerQuestion: (questionId: string, value: any) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  gradeWithAI: () => Promise<void>;   // llama a Azure OpenAI para preguntas abiertas
  calculateAIQ: () => AIQResult;
  reset: () => void;
}

const getLevelFromScore = (score: number): { level: string; name: string } => {
  if (score <= 1.5) return { level: 'L1', name: 'Novato' };
  if (score <= 2.5) return { level: 'L2', name: 'Experimentador' };
  if (score < 3.6) return { level: 'L3', name: 'Practicante' };
  if (score <= 4.4) return { level: 'L4T', name: 'Amplificador Técnico' };
  return { level: 'L4L', name: 'Amplificador Estratégico' };
};

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
      gradingStatus: 'idle',
      participant: null,
      participantToken: null,
      isAdmin: false,

      setRole: (role) => set({ userRole: role, startTime: Date.now() }),
      setEnterprise: (isEnterprise) => set({ isEnterprise }),
      setParticipant: (participant) => {
        // Auto-map position to role
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
        });
      },
      setParticipantToken: (token) => set({ participantToken: token }),
      setAdmin: (isAdmin) => set({ isAdmin }),

      answerQuestion: (questionId, value) => {
        set((state) => ({
          answers: { ...state.answers, [questionId]: value }
        }));
      },

      nextQuestion: () => {
        set((state) => {
          const nextIndex = state.currentQuestion + 1;
          if (nextIndex < questions.length) {
            return {
              currentQuestion: nextIndex,
              currentSection: questions[nextIndex].section as any
            };
          }
          return { currentQuestion: nextIndex };
        });
      },

      prevQuestion: () => {
        set((state) => {
          const prevIndex = state.currentQuestion - 1;
          if (prevIndex >= 0) {
            return {
              currentQuestion: prevIndex,
              currentSection: questions[prevIndex].section as any
            };
          }
          return {};
        });
      },

      // ── Califica todas las preguntas abiertas con Azure OpenAI en paralelo ──
      gradeWithAI: async () => {
        set({ gradingStatus: 'loading' });
        const { answers } = get();

        // Solo preguntas tipo 'open' o 'narrative' que tengan scoringSignals
        const openQuestions = questions.filter(
          q => (q.type === 'open' || q.type === 'narrative') && (q as any).scoringSignals
        );

        try {
          const results = await Promise.allSettled(
            openQuestions.map(async (q) => {
              const answer = answers[q.id];
              if (!answer) return { id: q.id, score: 1 };

              const answerText = typeof answer === 'string' ? answer : answer.text || '';
              if (answerText.trim().length < 15) return { id: q.id, score: 1 };

              const graded = await gradeAnswer({
                questionId: q.id,
                questionText: q.text || q.scaleText || '',
                scoringSignals: (q as any).scoringSignals,
                answer: answerText,
                concept: (q as any).concept,
              });

              return { id: q.id, score: graded.score };
            })
          );

          const newAiScores: Record<string, number> = {};
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
              newAiScores[r.value.id] = r.value.score;
            } else {
              // Si falla una, poner score neutral
              newAiScores[openQuestions[i].id] = 2;
            }
          });

          set({ aiScores: newAiScores, gradingStatus: 'done' });
        } catch (err) {
          console.error('gradeWithAI error:', err);
          set({ gradingStatus: 'error' });
        }
      },

      calculateAIQ: () => {
        const { answers, aiScores } = get();

        const getScore = (id: string) => {
          // 1. Prioridad: score de Azure OpenAI si existe
          if (aiScores[id] !== undefined) return aiScores[id];

          const ans = answers[id];
          if (!ans) return 0;

          // Explicit numeric value (MixedScale)
          if (typeof ans === 'object' && typeof ans.value === 'number') return ans.value;

          // Explicit score (PromptInput)
          if (typeof ans === 'object' && typeof ans.score === 'number') return ans.score;

          // Heuristic for Open/Narrative text questions (Mock grading)
          // In a real app, this would be graded by AI or human
          if (typeof ans === 'string' || (typeof ans === 'object' && typeof ans.text === 'string')) {
            const text = typeof ans === 'string' ? ans : ans.text;
            if (!text || text.length < 10) return 1;
            if (text.length < 50) return 2;
            if (text.length < 150) return 3;
            return 4; // Reward detailed answers with L4
          }

          return 0;
        };

        // Calculate section averages
        const calculateSectionAvg = (section: string) => {
          const sectionQuestions = questions.filter(q => q.section === section);
          if (sectionQuestions.length === 0) return 0;

          let sum = 0;
          let count = 0;

          sectionQuestions.forEach(q => {
            const score = getScore(q.id);
            // Only count if we have a "valid" score (even 1 is valid if answered)
            // We assume if it's answered, it's > 0 based on logic above
            if (score > 0) {
              sum += score;
              count++;
            }
          });

          return count === 0 ? 0 : sum / count;
        };

        const avgA = calculateSectionAvg('A');
        const avgB = calculateSectionAvg('B');
        const avgC = calculateSectionAvg('C');

        // Formula: Score = (promedio_seccionA × 0.40) + (promedio_seccionC × 0.35) + (promedio_seccionB × 0.25)
        let rawScore = (avgA * 0.40) + (avgC * 0.35) + (avgB * 0.25);

        // Apply Rules
        let finalLevel = getLevelFromScore(rawScore);
        const alerts: string[] = [];

        // REGLA 1 (Piso de Seguridad): Si cualquier sección tiene promedio ≤ 1.5, nivel máximo = L2
        if (avgA <= 1.5 || avgB <= 1.5 || avgC <= 1.5) {
          if (rawScore > 2.5) {
            rawScore = 2.5; // Cap at L2 upper bound
            finalLevel = { level: 'L2', name: 'Experimentador' };
            alerts.push('REGLA_1');
          }
        }

        // REGLA 2 (Techo): Para L4T o L4L, mínimo 2 secciones deben estar en nivel L4 (>= 3.6)
        if (finalLevel.level === 'L4T' || finalLevel.level === 'L4L') {
          const sectionsInL4 = [avgA, avgB, avgC].filter(avg => avg >= 3.6).length;
          if (sectionsInL4 < 2) {
            rawScore = 3.5; // Cap at L3 upper bound
            finalLevel = { level: 'L3', name: 'Practicante' };
            alerts.push('REGLA_2');
          }
        }

        // REGLA 3 (Alerta): Si max_sección - min_sección ≥ 2 niveles → activar alerta de desequilibrio
        // Niveles: L1 (1-1.5), L2 (1.6-2.5), L3 (2.6-3.5), L4T (3.6-4.4), L4L (4.5-5)
        // Simplified check: difference in raw averages >= 2.0 (approx 2 levels)
        const avgs = [avgA, avgB, avgC];
        const maxAvg = Math.max(...avgs);
        const minAvg = Math.min(...avgs);
        if (maxAvg - minAvg >= 2.0) {
          alerts.push('REGLA_3');
        }

        // REGLA 4 (Confirmación L4L): Solo si hay impacto organizacional (valor 5) en ≥ 3 preguntas distintas
        if (finalLevel.level === 'L4L') {
          let impactCount = 0;
          Object.keys(answers).forEach(key => {
            if (getScore(key) === 5) impactCount++;
          });

          if (impactCount < 3) {
            rawScore = 4.4; // Cap at L4T upper bound
            finalLevel = { level: 'L4T', name: 'Amplificador Técnico' };
            alerts.push('REGLA_4');
          }
        }

        // Determine Challenge Profile
        let challengeProfile = 'balanced';
        if (avgB < avgA && avgB < avgC) challengeProfile = 'technical_gap';
        else if (avgC < avgA && avgC < avgB) challengeProfile = 'knowledge_gap'; // Assuming C (Prompting) is knowledge/skill
        else if (avgA > 4 && avgB > 4 && avgC > 4) challengeProfile = 'leader';

        const result: AIQResult = {
          score: Number(rawScore.toFixed(2)),
          level: finalLevel.level,
          levelName: finalLevel.name,
          sectionScores: {
            A: { avg: Number(avgA.toFixed(2)), level: getLevelFromScore(avgA).level },
            B: { avg: Number(avgB.toFixed(2)), level: getLevelFromScore(avgB).level },
            C: { avg: Number(avgC.toFixed(2)), level: getLevelFromScore(avgC).level }
          },
          alerts,
          challengeProfile
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
        gradingStatus: 'idle',
        participant: null,
        participantToken: null,
        isAdmin: false,
      })
    }),
    {
      name: 'aiq_session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        answers: state.answers,
        userRole: state.userRole,
        currentQuestion: state.currentQuestion,
        currentSection: state.currentSection,
        aiqResult: state.aiqResult,
        isEnterprise: state.isEnterprise,
        aiScores: state.aiScores,
        gradingStatus: state.gradingStatus,
        participant: state.participant,
        participantToken: state.participantToken,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
