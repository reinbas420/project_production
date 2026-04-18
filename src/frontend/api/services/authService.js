import { secureStorage } from '../../utils/storage';
import api from '../axiosInstance';

/**
 * Auth Service
 * Handles user registration, login, and logout API calls.
 * On successful login, the JWT token is stored in SecureStore.
 */
const authService = {
    /**
     * Register a new user account.
     * @param {Object} userData - { useremail, userpassword, phone }
     */
    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        // Backend wraps in { status, data: { user, token } }
        return response.data.data;
    },

    /**
     * Add a child profile to an existing user account.
     * @param {string} parentId
     * @param {{ name: string, ageGroup: string, preferredGenres?: string[] }} profile
     */
    addChildProfile: async (parentId, profile) => {
        const response = await api.post(`/users/${parentId}/children`, profile);
        return response.data.data;
    },

    /**
     * Get current user from token.
     */
    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data.data;
    },

    /**
     * Login with email and password.
     * Stores the returned JWT in SecureStore for future requests.
     * @param {string} email
     * @param {string} password
     * @returns {{ user, token }} User data and JWT token
     */
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        // Backend wraps in { status, data: { user, token } }
        const { user, token } = response.data.data;

        // Persist token
        await secureStorage.setToken(token).catch(() => {});

        return { user, token };
    },

    /**
     * Logout: clear the stored JWT token.
     */
    logout: async () => {
        await secureStorage.removeToken();
    },
};

export default authService;
