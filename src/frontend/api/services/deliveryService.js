import api from '../axiosInstance';

/**
 * Delivery Service
 * Handles home delivery tracking for issued books.
 * Maps to the Deliveries entity in DB V1.
 */
const deliveryService = {
    /**
     * Get delivery status for an issue.
     * @param {string} issueId
     */
    getDeliveryStatus: async (issueId) => {
        const response = await api.get('/deliveries', { params: { issueId } });
        return response.data;
    },

    /**
     * Schedule a home delivery for an issue.
     * @param {Object} data - { issueId, branchId, deliveryAddress, scheduledAt }
     */
    scheduleDelivery: async (data) => {
        const response = await api.post('/deliveries', data);
        return response.data;
    },
};

export default deliveryService;
