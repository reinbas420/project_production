import api from '../axiosInstance';

/**
 * Payment Service
 * Handles payment operations linked to issues.
 * Maps to the Payments entity in DB V1.
 */
const paymentService = {
    /**
     * Get all payments for a specific issue.
     * @param {string} issueId
     */
    getPayments: async (issueId) => {
        const response = await api.get('/payments', { params: { issueId } });
        return response.data;
    },

    /**
     * Make a payment for an issue.
     * @param {Object} data - { issueId, paymentAmount, paymentType }
     * paymentType: ISSUE_FEE | OTHER
     */
    makePayment: async (data) => {
        const response = await api.post('/payments', data);
        return response.data;
    },
};

export default paymentService;
