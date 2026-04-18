import api from '../axiosInstance';

/**
 * Profile Service
 * Handles CRUD operations for user profiles (Child / Parent).
 */
const profileService = {
    /**
     * Fetch all profiles for the logged-in user.
     */
    getProfiles: async () => {
        const response = await api.get('/profiles');
        return response.data;
    },

    /**
     * Create a new profile.
     * @param {Object} data - { name, accountType, ageGroup, preferredGenres, preferredLanguages, userprofileURL }
     */
    createProfile: async (data) => {
        const response = await api.post('/profiles', data);
        return response.data;
    },

    /**
     * Update an existing profile.
     * @param {string} profileId
     * @param {Object} data - Fields to update
     */
    updateProfile: async (profileId, data) => {
        const response = await api.put(`/profiles/${profileId}`, data);
        return response.data;
    },

    /**
     * Delete a profile.
     * @param {string} profileId
     */
    deleteProfile: async (profileId) => {
        const response = await api.delete(`/profiles/${profileId}`);
        return response.data;
    },
};

export default profileService;
