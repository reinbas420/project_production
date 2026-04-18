import api from '../axiosInstance';

/**
 * Penalty Service
 * Handles overdue fine lookup and payment.
 * Maps to the Penalties entity in DB V1.
 */
const penaltyService = {
    /**
     * Get penalty details for an issue (if overdue).
     * @param {string} issueId
     */
    getPenalty: async (issueId) => {
        const response = await api.get(`/penalties/${issueId}`);
        return response.data;
    },

    /**
     * Pay the penalty for an overdue issue.
     * @param {string} issueId
     */
    payPenalty: async (issueId) => {
        const response = await api.post(`/penalties/${issueId}/pay`);
        return response.data;
    },
};

export default penaltyService;
