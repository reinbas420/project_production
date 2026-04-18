import axios from 'axios';
import useNetworkStore from '../store/networkStore';

/**
 * Axios Instance
 *
 * Central HTTP client with:
 *  - 5-second timeout (catches slow networks before UI freezes)
 *  - Request interceptor: auto-attaches JWT from useAppStore
 *  - Response error interceptor: offline detection → Zustand update
 *
 * All API service modules import this instance instead of raw axios.
 */

// Base URL is configurable — point this to your Node.js backend
// Backend runs on port 5000 with /api/v1 prefix
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 120000, // 2 minutes — accommodate LangChain generative delays
    headers: {
        'Content-Type': 'application/json',
    },
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REQUEST INTERCEPTOR
// Reads the JWT from useAppStore and attaches it to every
// outgoing request. No need to pass tokens manually.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
axiosInstance.interceptors.request.use(
    (config) => {
        try {
            // Lazy import to avoid require cycles
            const { default: useAppStore } = require('../store/useAppStore');
            const token = useAppStore.getState().token;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Interceptor: failed to read token', error);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESPONSE ERROR INTERCEPTOR
// Handles two critical scenarios:
//  1. Timeout / Network error → set isOffline in Zustand
//  2. 401 Unauthorized → auto-logout (token expired)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
axiosInstance.interceptors.response.use(
    (response) => {
        // Successful response → make sure we're marked as online
        const { isOffline } = useNetworkStore.getState();
        if (isOffline) {
            useNetworkStore.getState().setOnline();
        }
        return response;
    },
    (error) => {
        // Timeout or no response (network down)
        if (error.code === 'ECONNABORTED' || !error.response) {
            console.warn('Network error detected — switching to offline mode');
            useNetworkStore.getState().setOffline();
        }

        // Token expired / unauthorized
        if (error.response && error.response.status === 401) {
            console.warn('401 Unauthorized — logging out');

            // Lazy requires to avoid circular dependencies
            const { default: useAppStore } = require('../store/useAppStore');
            const { router } = require('expo-router');

            useAppStore.getState().clearAuth();
            router.replace('/(auth)/welcome');
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
