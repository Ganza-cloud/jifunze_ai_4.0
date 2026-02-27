import { create } from 'zustand';
import { Subject } from '@/lib/types';

interface StoreState {
    subjects: Subject[];
    activeSubjectId: string | null;
    isLoaded: boolean;
    isHistoryOpen: boolean;
    activeSessionId: string | null;
    isSidebarOpen: boolean;
    setSubjects: (subjects: Subject[]) => void;
    addSubject: (subject: Subject) => void;
    removeSubject: (id: string) => void;
    setActiveSubject: (id: string | null) => void;
    getSubject: (id: string) => Subject | undefined;
    toggleHistory: () => void;
    toggleSidebar: () => void;
    setActiveSessionId: (id: string | null) => void;
}

export const useStore = create<StoreState>((set, get) => ({
    subjects: [],
    activeSubjectId: null,
    isLoaded: false,
    isHistoryOpen: false,
    isSidebarOpen: false,
    activeSessionId: null,
    setSubjects: (subjects) => set({ subjects, isLoaded: true }),
    addSubject: (subject) =>
        set((state) => ({ subjects: [...state.subjects, subject] })),
    removeSubject: (id) =>
        set((state) => ({ subjects: state.subjects.filter((s) => s.id !== id) })),
    setActiveSubject: (id) => set({ activeSubjectId: id }),
    getSubject: (id) => get().subjects.find((s) => s.id === id),
    toggleHistory: () => set((state) => ({ isHistoryOpen: !state.isHistoryOpen })),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    setActiveSessionId: (id: string | null) => set({ activeSessionId: id }),
}));