import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type QuizType = 'mcq' | 'exam';

export interface PracticeQuestion {
    question: string;
    options?: string[]; // for MCQ
    correctIndex?: number; // for MCQ
    explanation?: string; // for MCQ
    solutionStepByStep?: string; // for Exam mode
}

export interface PracticeSession {
    id: string; // unique ID for the session, e.g. timestamp
    subjectId: string;
    subtopicName: string;
    quizType: QuizType;
    questions: PracticeQuestion[];
    currentQuestionIndex: number;
    score: number;
    completed: boolean;
    date: string;
}

interface PracticeStore {
    activeSession: PracticeSession | null;
    pastPractices: PracticeSession[];

    // Actions
    startSession: (session: Omit<PracticeSession, 'id' | 'date' | 'completed'>) => void;
    updateSessionData: (updates: Partial<PracticeSession>) => void;
    endSession: () => void;
    clearActiveSession: () => void;
    deletePastPractice: (id: string) => void;
}

export const usePracticeStore = create<PracticeStore>()(
    persist(
        (set, get) => ({
            activeSession: null,
            pastPractices: [],

            startSession: (sessionData) => {
                const newSession: PracticeSession = {
                    ...sessionData,
                    id: Date.now().toString(),
                    date: new Date().toISOString(),
                    completed: false,
                };
                set({ activeSession: newSession });
            },

            updateSessionData: (updates) => {
                const { activeSession } = get();
                if (activeSession) {
                    set({ activeSession: { ...activeSession, ...updates } });
                }
            },

            endSession: () => {
                const { activeSession, pastPractices } = get();
                if (activeSession) {
                    const completedSession = { ...activeSession, completed: true };
                    set({
                        activeSession: null,
                        pastPractices: [completedSession, ...pastPractices],
                    });
                }
            },

            clearActiveSession: () => set({ activeSession: null }),

            deletePastPractice: (id) => {
                const { pastPractices } = get();
                set({ pastPractices: pastPractices.filter(p => p.id !== id) });
            }
        }),
        {
            name: 'practice-storage', // key in localStorage
            storage: createJSONStorage(() => localStorage),
        }
    )
);
