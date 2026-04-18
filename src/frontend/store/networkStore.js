import { create } from 'zustand';

/**
 * Network Store
 * Tracks connectivity and global loading state.
 * Updated by Axios error interceptor (on timeout) and useNetworkStatus hook.
 * Drives the "You're offline!" banner in the UI.
 */
const useNetworkStore = create((set) => ({
    // ── State ──────────────────────────────────────────
    isOffline: false,
    isLoading: false,

    // ── Actions ────────────────────────────────────────

    /** Mark network as offline (called by Axios timeout interceptor). */
    setOffline: () => set({ isOffline: true }),

    /** Mark network as online (called when connectivity is restored). */
    setOnline: () => set({ isOffline: false }),

    /** Toggle the global loading indicator. */
    setLoading: (isLoading) => set({ isLoading }),
}));

export default useNetworkStore;
