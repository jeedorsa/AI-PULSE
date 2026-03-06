import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { questions } from '../data/questions';

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

interface AssessmentState {
  userRole: 'csuite' | 'manager' | 'colaborador' | 'independiente' | null;
  currentQuestion: number;
  answers: Record<string, any>;
  currentSection: 'A' | 'B' | 'C' | 'D' | 'GAPS';
  aiqResult: AIQResult | null;
  startTime: number | null;
  isEnterprise: boolean;
  
  setRole: (role: 'csuite' | 'manager' | 'colaborador' | 'independiente') => void;
  setEnterprise: (isEnterprise: boolean) => void;
  answerQuestion: (questionId: string, value: any) => void;
  nextQuestion: () => void;
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

      setRole: (role) => set({ userRole: role, startTime: Date.now() }),
      setEnterprise: (isEnterprise) => set({ isEnterprise }),

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

      calculateAIQ: () => {
        const { answers } = get();
        
        const getScore = (id: string) => {
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
        isEnterprise: false
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
        isEnterprise: state.isEnterprise
      }),
    }
  )
);
