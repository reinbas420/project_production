const { shiprocketClient, invalidateToken } = require('../config/shiprocket');
const AppError = require('../utils/AppError');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Shiprocket Shipping Service
 * =====================================================
 *
 * Full lifecycle management for Shiprocket shipments:
 *   1. createShipment  — create an ad-hoc order + shipment
 *   2. assignCourier   — request courier assignment (AWB)
 *   3. generateLabel   — get shipping label PDF
 *   4. trackShipment   — real-time shipment tracking
 *   5. cancelShipment  — cancel before dispatch
 *
 * Designed to work with the library Delivery model.
 */

// ── 1. Create Shipment ─────────────────────────────────

/**
 * Create an ad-hoc order on Shiprocket.
 *
 * @param {Object} orderData - Shipment details
 * @param {string} orderData.order_id         - Unique order/delivery ID
 * @param {string} orderData.billing_customer_name
 * @param {string} orderData.billing_phone
 * @param {string} orderData.billing_address
 * @param {string} orderData.billing_city
 * @param {string} orderData.billing_pincode
 * @param {string} orderData.billing_state
 * @param {string} orderData.product_name     - Book title
 * @param {number} orderData.price            - Declared value (₹)
 * @param {string} [orderData.payment_method] - 'COD' or 'Prepaid'
 * @returns {Object} Shiprocket response with shipment_id, order_id, etc.
 */
exports.createShipment = async (orderData) => {
  const client = await shiprocketClient();

  const payload = {
    order_id: orderData.order_id,
    order_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    pickup_location: orderData.pickup_location || 'Primary',

    // Billing / delivery address
    billing_customer_name: orderData.billing_customer_name,
    billing_last_name: orderData.billing_last_name || '',
    billing_phone: orderData.billing_phone,
    billing_email: orderData.billing_email || '',
    billing_address: orderData.billing_address,
    billing_city: orderData.billing_city,
    billing_pincode: orderData.billing_pincode,
    billing_state: orderData.billing_state,
    billing_country: orderData.billing_country || 'India',

    // Shipping = Billing (same address for library deliveries)
    shipping_is_billing: true,

    // Item details (book)
    order_items: [
      {
        name: orderData.product_name || 'Library Book',
        sku: orderData.sku || `BOOK-${orderData.order_id}`,
        units: orderData.units || 1,
        selling_price: orderData.price || 0,
        hsn: orderData.hsn || '4901' // HSN code for printed books
      }
    ],

    payment_method: orderData.payment_method || 'Prepaid',
    sub_total: orderData.price || 0,

    // Package dimensions (standard book package)
    length: orderData.length || 25,
    breadth: orderData.breadth || 18,
    height: orderData.height || 5,
    weight: orderData.weight || 0.5 // kg
  };

  try {
    const response = await client.post('/orders/create/adhoc', payload);
    console.log(`📦 Shiprocket shipment created — order_id: ${orderData.order_id}`);
    return response.data;
  } catch (error) {
    _handleApiError(error, 'createShipment');
  }
};

// ── 2. Assign Courier (generates AWB) ──────────────────

/**
 * Request Shiprocket to assign a courier & generate AWB number.
 *
 * @param {string|number} shipmentId - Shiprocket shipment_id
 * @param {string|number} [courierId] - Specific courier ID (optional — auto-assign if omitted)
 * @returns {Object} { awb_code, courier_name, courier_company_id, ... }
 */
exports.assignCourier = async (shipmentId, courierId) => {
  const client = await shiprocketClient();

  const payload = { shipment_id: shipmentId };
  if (courierId) payload.courier_id = courierId;

  try {
    const response = await client.post('/courier/assign/awb', payload);
    console.log(`🔖 AWB assigned for shipment ${shipmentId}`);
    return response.data?.response?.data || response.data;
  } catch (error) {
    _handleApiError(error, 'assignCourier');
  }
};

// ── 3. Generate Label ──────────────────────────────────

/**
 * Get a shipping label (PDF URL) for a shipment.
 *
 * @param {string|number} shipmentId - Shiprocket shipment_id
 * @returns {Object} { label_url, ... }
 */
exports.generateLabel = async (shipmentId) => {
  const client = await shiprocketClient();

  try {
    const response = await client.post('/courier/generate/label', {
      shipment_id: [shipmentId]
    });
    return response.data;
  } catch (error) {
    _handleApiError(error, 'generateLabel');
  }
};

// ── 4. Track Shipment ──────────────────────────────────

/**
 * Get real-time tracking info for a shipment.
 *
 * @param {string|number} shipmentId - Shiprocket shipment_id
 * @returns {Object} Tracking activities and current status
 */
exports.trackShipment = async (shipmentId) => {
  const client = await shiprocketClient();

  try {
    const response = await client.get(`/courier/track/shipment/${shipmentId}`);
    return response.data;
  } catch (error) {
    _handleApiError(error, 'trackShipment');
  }
};

/**
 * Track by AWB number.
 *
 * @param {string} awbCode - AWB number
 * @returns {Object} Tracking data
 */
exports.trackByAwb = async (awbCode) => {
  const client = await shiprocketClient();

  try {
    const response = await client.get(`/courier/track/awb/${awbCode}`);
    return response.data;
  } catch (error) {
    _handleApiError(error, 'trackByAwb');
  }
};

// ── 5. Cancel Shipment ─────────────────────────────────

/**
 * Cancel a Shiprocket order (before dispatch).
 *
 * @param {string|number[]} orderIds - Array of Shiprocket order IDs
 * @returns {Object} Cancellation confirmation
 */
exports.cancelShipment = async (orderIds) => {
  const client = await shiprocketClient();

  try {
    const response = await client.post('/orders/cancel', {
      ids: Array.isArray(orderIds) ? orderIds : [orderIds]
    });
    console.log(`❌ Shiprocket order(s) cancelled: ${orderIds}`);
    return response.data;
  } catch (error) {
    _handleApiError(error, 'cancelShipment');
  }
};

// ── 6. Check Serviceability ────────────────────────────

/**
 * Check if delivery is available between two pin codes.
 *
 * @param {string} pickupPincode
 * @param {string} deliveryPincode
 * @param {number} [weight=0.5] - Package weight in kg
 * @returns {Object} Available courier list with rates
 */
exports.checkServiceability = async (pickupPincode, deliveryPincode, weight = 0.5) => {
  const client = await shiprocketClient();

  try {
    const response = await client.get('/courier/serviceability/', {
      params: {
        pickup_postcode: pickupPincode,
        delivery_postcode: deliveryPincode,
        weight,
        cod: 0 // Prepaid
      }
    });
    return response.data;
  } catch (error) {
    _handleApiError(error, 'checkServiceability');
  }
};

// ── Internal Error Handler ─────────────────────────────

function _handleApiError(error, operation) {
  // If 401, invalidate cached token so next call re-authenticates
  if (error.response?.status === 401) {
    invalidateToken();
  }

  const status = error.response?.status || 500;
  const msg =
    error.response?.data?.message ||
    error.response?.data?.errors ||
    error.message;

  console.error(`❌ Shiprocket ${operation} failed:`, msg);
  throw new AppError(
    `Shiprocket ${operation} failed: ${typeof msg === 'object' ? JSON.stringify(msg) : msg}`,
    status
  );
}
