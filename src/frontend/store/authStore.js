import { create } from 'zustand';
import { secureStorage } from '../utils/storage';

/**
 * Auth Store
 * Manages authentication state: user data, JWT session, and login status.
 * JWT token is persisted in SecureStore (encrypted) and hydrated on app launch.
 */
const useAuthStore = create((set, get) => ({
    // ── State ──────────────────────────────────────────
    user: null,
    isAuthenticated: false,
    isLoading: false,

    // ── Actions ────────────────────────────────────────

    /**
     * Hydrate session from SecureStore on app launch.
     * Called by useAppInit hook during startup sequence.
     */
    loadSession: async () => {
        set({ isLoading: true });
        try {
            const token = await secureStorage.getToken();
            if (token) {
                set({ isAuthenticated: true });
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        } finally {
            set({ isLoading: false });
        }
    },

    /**
     * Login: store JWT in SecureStore and update auth state.
     */
    login: async (userData, token) => {
        set({ isLoading: true });
        try {
            await secureStorage.setToken(token);
            set({ user: userData, isAuthenticated: true });
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    /**
     * Logout: clear SecureStore token and reset state.
     */
    logout: async () => {
        try {
            await secureStorage.removeToken();
        } catch (error) {
            console.error('Logout error:', error);
        }
        set({ user: null, isAuthenticated: false });
    },

    /**
     * Update user data without touching the token.
     */
    setUser: (userData) => set({ user: userData }),
}));

export default useAuthStore;
