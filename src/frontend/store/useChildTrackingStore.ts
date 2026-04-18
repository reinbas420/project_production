/**
 * useChildTrackingStore
 *
 * Persists quiz results keyed by child profileId.
 * Reading progress is derived from the real issue count fetched live.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const TRACKING_KEY = '@child_tracking_v1';

export interface QuizResult {
  bookId: string;
  bookTitle: string;
  score: number;
  total: number;
  pct: number;       // 0-100
  date: string;      // ISO string
}

interface ChildTrackingStore {
  /** quizResults[profileId] = array of all quiz attempts */
  quizResults: Record<string, QuizResult[]>;
  /** Load persisted data from AsyncStorage (call once on app start) */
  hydrate: () => Promise<void>;
  /** Save a quiz result for the given child profile */
  recordQuizResult: (profileId: string, result: QuizResult) => Promise<void>;
  /** Return all quiz results for a child (empty array if none) */
  getQuizResults: (profileId: string) => QuizResult[];
  /** Count how many quizzes a child passed (pct >= 50) */
  getQuizzesPassed: (profileId: string) => number;
}

const useChildTrackingStore = create<ChildTrackingStore>((set, get) => ({
  quizResults: {},

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(TRACKING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { quizResults: Record<string, QuizResult[]> };
        set({ quizResults: parsed.quizResults ?? {} });
      }
    } catch (err) {
      console.warn('[ChildTracking] hydrate failed', err);
    }
  },

  recordQuizResult: async (profileId, result) => {
    const prev = get().quizResults;
    const existing = prev[profileId] ?? [];
    const updated = { ...prev, [profileId]: [result, ...existing] };
    set({ quizResults: updated });
    try {
      await AsyncStorage.setItem(TRACKING_KEY, JSON.stringify({ quizResults: updated }));
    } catch (err) {
      console.warn('[ChildTracking] persist failed', err);
    }
  },

  getQuizResults: (profileId) => {
    return get().quizResults[profileId] ?? [];
  },

  getQuizzesPassed: (profileId) => {
    return (get().quizResults[profileId] ?? []).filter(r => r.pct >= 50).length;
  },
}));

export default useChildTrackingStore;
