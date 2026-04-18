import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Secure Storage  (expo-secure-store)
// For sensitive data: JWT tokens, parent PIN
// Data is encrypted at the device level.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOKEN_KEY = 'auth_jwt_token';
const PARENT_PIN_KEY = 'parent_pin';

export const secureStorage = {
    // ── JWT Token ──────────────────────────────────────
    getToken: async () => {
        try {
            return await SecureStore.getItemAsync(TOKEN_KEY);
        } catch (error) {
            console.error('SecureStore getToken error:', error);
            return null;
        }
    },

    setToken: async (token) => {
        try {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
        } catch (error) {
            console.error('SecureStore setToken error:', error);
            throw error;
        }
    },

    removeToken: async () => {
        try {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
        } catch (error) {
            console.error('SecureStore removeToken error:', error);
        }
    },

    // ── Parent PIN ─────────────────────────────────────
    getParentPin: async () => {
        try {
            return await SecureStore.getItemAsync(PARENT_PIN_KEY);
        } catch (error) {
            console.error('SecureStore getParentPin error:', error);
            return null;
        }
    },

    setParentPin: async (pin) => {
        try {
            await SecureStore.setItemAsync(PARENT_PIN_KEY, pin);
        } catch (error) {
            console.error('SecureStore setParentPin error:', error);
            throw error;
        }
    },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cache Storage  (@react-native-async-storage/async-storage)
// For non-sensitive, heavy data: book catalogs, dashboard JSON
// Enables instant app launch with cached content.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BOOKS_CACHE_KEY = '@cached_books';
const DASHBOARD_CACHE_KEY = '@cached_dashboard';

export const cacheStorage = {
    // ── Book Catalog Cache ─────────────────────────────
    getCachedBooks: async () => {
        try {
            const json = await AsyncStorage.getItem(BOOKS_CACHE_KEY);
            return json ? JSON.parse(json) : [];
        } catch (error) {
            console.error('AsyncStorage getCachedBooks error:', error);
            return [];
        }
    },

    setCachedBooks: async (books) => {
        try {
            await AsyncStorage.setItem(BOOKS_CACHE_KEY, JSON.stringify(books));
        } catch (error) {
            console.error('AsyncStorage setCachedBooks error:', error);
        }
    },

    // ── Dashboard Cache ────────────────────────────────
    getCachedDashboard: async () => {
        try {
            const json = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
            return json ? JSON.parse(json) : null;
        } catch (error) {
            console.error('AsyncStorage getCachedDashboard error:', error);
            return null;
        }
    },

    setCachedDashboard: async (data) => {
        try {
            await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('AsyncStorage setCachedDashboard error:', error);
        }
    },

    // ── Clear All Cache ────────────────────────────────
    clearCache: async () => {
        try {
            await AsyncStorage.multiRemove([BOOKS_CACHE_KEY, DASHBOARD_CACHE_KEY]);
        } catch (error) {
            console.error('AsyncStorage clearCache error:', error);
        }
    },
};
