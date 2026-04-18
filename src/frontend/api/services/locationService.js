import api from "../axiosInstance";

/**
 * Location Service
 * Handles delivery address / location updates and eligibility checks.
 */
const locationService = {
  /**
   * Add a new delivery address (GeoJSON Point).
   * @param {string} userId
   * @param {Object} data - { latitude, longitude, street, city, state, pincode, label }
   *   Coordinates are sent as-is; the backend stores them as [longitude, latitude].
   */
  updateDeliveryLocation: async (userId, data) => {
    const response = await api.put(`/users/${userId}/location`, data);
    return response.data;
  },

  /**
   * Get all saved delivery addresses for a user.
   * @param {string} userId
   * @returns {{ addresses: Array }}
   */
  getDeliveryAddresses: async (userId) => {
    const response = await api.get(`/users/${userId}/addresses`);
    return response.data;
  },

  /**
   * Delete a saved delivery address.
   * @param {string} userId
   * @param {string} addressId - the subdocument _id
   */
  deleteDeliveryAddress: async (userId, addressId) => {
    const response = await api.delete(
      `/users/${userId}/addresses/${addressId}`,
    );
    return response.data;
  },

  /**
   * Set a delivery address as the default.
   * @param {string} userId
   * @param {string} addressId
   */
  setDefaultAddress: async (userId, addressId) => {
    const response = await api.put(
      `/users/${userId}/addresses/${addressId}/default`,
    );
    return response.data;
  },

  /**
   * Check whether the user is within delivery range of a library branch.
   * @param {string} userId
   * @param {string} branchId
   * @returns {{ eligible: boolean }}
   */
  checkDeliveryEligibility: async (userId, branchId) => {
    const response = await api.get(`/users/${userId}/delivery-eligibility`, {
      params: { branchId },
    });
    return response.data;
  },

  /**
   * Get all library branches (for displaying on the map).
   * Uses the public /libraries endpoint.
   */
  getAllLibraries: async () => {
    const response = await api.get("/libraries");
    return response.data;
  },

  /**
   * Search locations using OSM Nominatim (free geocoding).
   * @param {string} query - search text
   * @returns {Array<{ display_name, lat, lon }>}
   */
  searchNominatim: async (query) => {
    if (!query || query.length < 3) return [];
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
        {
          headers: {
            "User-Agent": "HyperLocalCloudLibrary/1.0",
          },
        },
      );
      return await response.json();
    } catch {
      return [];
    }
  },
};

export default locationService;
