'use strict';

/**
 * Delivery Service — PRODUCTION
 *
 * Places real pickup+drop orders with Porter (https://porter.in)
 * Hyderabad hyperlocal gig platform. Porter's REST API v1.
 *
 * Porter API reference: https://docs.porter.in/reference/
 *
 * Environment variables required:
 *   DELIVERY_API_URL    = https://api.porter.in/v1          (Porter base URL)
 *   DELIVERY_API_KEY    = <your Porter API key>
 *   DELIVERY_HMAC_SECRET= <Porter webhook signing secret>
 */

const axios    = require('axios');
const crypto   = require('crypto');
const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const AppError = require('../utils/AppError');
const config   = require('../config');

const PROVIDER = 'PORTER';

const porterClient = axios.create({
  baseURL: config.delivery.apiUrl,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key':    config.delivery.apiKey,
  },
  timeout: 10000,
});

// Porter webhook event → our status
const PORTER_STATUS_MAP = {
  order_placed:   'DISPATCHED',
  rider_assigned: 'OUT_FOR_DELIVERY',
  picked_up:      'OUT_FOR_DELIVERY',
  delivered:      'DELIVERED',
  failed:         'FAILED',
  cancelled:      'CANCELLED',
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a SCHEDULED delivery.
 * Librarian calls this once the book is packed.
 * Calls Porter's POST /v1/orders to request bike pickup from branch → user home.
 */
exports.dispatchDelivery = async (deliveryId) => {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }

  const delivery = await Delivery.findById(deliveryId)
    .populate('branchId')
    .populate('userId');

  if (!delivery) throw new AppError('Delivery not found', 404);

  if (delivery.status !== 'SCHEDULED') {
    throw new AppError(
      `Cannot dispatch a delivery with status: ${delivery.status}`,
      400
    );
  }

  const branch = delivery.branchId;
  const user   = delivery.userId;

  if (!branch.location?.coordinates?.length) {
    throw new AppError('Branch location coordinates are not configured', 400);
  }
  if (!user.deliveryAddress?.location?.coordinates?.length) {
    throw new AppError('User delivery address coordinates are not set', 400);
  }

  // GeoJSON stores [longitude, latitude]
  const [pickupLng, pickupLat] = branch.location.coordinates;
  const [dropLng,   dropLat]   = user.deliveryAddress.location.coordinates;

  /*
   * Porter API — Create Order
   * POST /v1/orders
   * Docs: https://docs.porter.in/reference/create-order
   */
  const porterPayload = {
    pickup_details: {
      address: {
        apartment_address: branch.address,
        city:              user.deliveryAddress.city || 'Hyderabad',
        state:             'Telangana',
        pincode:           String(user.deliveryAddress?.pincode || '500001'),
        country:           'India',
        lat:               pickupLat,
        lng:               pickupLng,
        contact_details: {
          name:  branch.librarian || 'Library Staff',
          phone_number: branch.BranchMailId
            ? branch.BranchMailId.split('@')[0]   // fallback — replace with actual phone
            : '9000000000',
        },
      },
    },
    drop_details: {
      address: {
        apartment_address: user.deliveryAddress.street || delivery.deliveryAddress,
        city:              user.deliveryAddress.city   || 'Hyderabad',
        state:             'Telangana',
        pincode:           String(user.deliveryAddress?.pincode || '500001'),
        country:           'India',
        lat:               dropLat,
        lng:               dropLng,
        contact_details: {
          name:  user.profiles?.[0]?.name || 'Customer',
          phone_number: user.phone,
        },
      },
    },
    // Porter vehicle types for Hyderabad: 2-Wheeler, 3-Wheeler, etc.
    vehicle_type: {
      id: 3, // 2-Wheeler (Bike) — suitable for books
    },
    invoice: {
      amount:   50,    // Delivery charge in INR (collected from user separately)
      currency: 'INR',
    },
    acknowledgement_code: delivery._id.toString(),  // our delivery ID for reconciliation
  };

  let gigOrderId, trackingUrl;
  try {
    const response = await porterClient.post('/orders', porterPayload);
    gigOrderId   = response.data?.order_id  || response.data?.data?.order_id;
    trackingUrl  = response.data?.tracking_link || response.data?.data?.tracking_link;

    if (!gigOrderId) {
      throw new AppError('Porter returned an order response without an order_id', 502);
    }
  } catch (err) {
    // Wrap Axios errors with clean messages — don't leak raw API responses
    if (err.isAxiosError) {
      const status  = err.response?.status;
      const message = err.response?.data?.message || err.message;
      throw new AppError(`Porter API error (${status}): ${message}`, 502);
    }
    throw err;
  }

  // Persist gig order details
  delivery.status       = 'DISPATCHED';
  delivery.providerName = PROVIDER;
  delivery.gigOrderId   = gigOrderId;
  delivery.trackingId   = gigOrderId;   // Porter uses order_id as tracking ref
  delivery.trackingUrl  = trackingUrl   || `https://porter.in/track/${gigOrderId}`;
  delivery.dispatchedAt = new Date();
  await delivery.save();

  return { delivery, gigOrderId, trackingUrl: delivery.trackingUrl };
};

/**
 * Update delivery status manually (librarian override / admin action).
 */
exports.updateDeliveryStatus = async (deliveryId, status, extra = {}) => {
  const VALID_STATUSES = [
    'SCHEDULED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED',
  ];

  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new AppError(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      400
    );
  }

  const update = { status };
  if (status === 'DELIVERED') {
    update.deliveredAt = extra.deliveredAt || new Date();
  }

  const delivery = await Delivery.findByIdAndUpdate(deliveryId, update, { new: true });
  if (!delivery) throw new AppError('Delivery not found', 404);

  return delivery;
};

/**
 * Cancel a dispatch on Porter's side.
 * Porter allows cancellation before the rider has picked up the package.
 * Only callable when status is DISPATCHED or OUT_FOR_DELIVERY.
 */
exports.cancelDelivery = async (deliveryId, reason = '') => {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new AppError('Delivery not found', 404);

  const cancellable = ['SCHEDULED', 'DISPATCHED', 'OUT_FOR_DELIVERY'];
  if (!cancellable.includes(delivery.status)) {
    throw new AppError(
      `Cannot cancel a delivery in status: ${delivery.status}`,
      400
    );
  }

  // If already dispatched to Porter, cancel with them first
  if (delivery.gigOrderId) {
    try {
      await porterClient.post(`/orders/${delivery.gigOrderId}/cancel`, {
        cancellation_reason: reason || 'Cancelled by library',
      });
    } catch (err) {
      if (err.isAxiosError) {
        const status  = err.response?.status;
        const message = err.response?.data?.message || err.message;
        throw new AppError(`Porter cancellation failed (${status}): ${message}`, 502);
      }
      throw err;
    }
  }

  delivery.status = 'CANCELLED';
  await delivery.save();

  return delivery;
};

/**
 * Get real-time status from Porter for a dispatched order.
 * Useful to sync status if a webhook was missed.
 */
exports.syncDeliveryStatus = async (deliveryId) => {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new AppError('Delivery not found', 404);

  if (!delivery.gigOrderId) {
    throw new AppError('This delivery has not been dispatched yet', 400);
  }

  let porterStatus;
  try {
    const response = await porterClient.get(`/orders/${delivery.gigOrderId}`);
    porterStatus = response.data?.status || response.data?.data?.status;
  } catch (err) {
    if (err.isAxiosError) {
      const status  = err.response?.status;
      const message = err.response?.data?.message || err.message;
      throw new AppError(`Porter API error (${status}): ${message}`, 502);
    }
    throw err;
  }

  const mappedStatus = PORTER_STATUS_MAP[porterStatus];
  if (mappedStatus && mappedStatus !== delivery.status) {
    delivery.status = mappedStatus;
    if (mappedStatus === 'DELIVERED') delivery.deliveredAt = new Date();
    await delivery.save();
  }

  return { delivery, porterStatus, mappedStatus };
};

/**
 * Process a webhook event pushed by Porter.
 * The raw request body (Buffer) and signature header are passed in.
 * Throws 401 if HMAC verification fails.
 */
exports.processWebhookUpdate = async (rawBody, signature, payload) => {
  // ── HMAC Signature Verification ──────────────────────────────────────────
  const secret = config.delivery.hmacSecret;
  if (!secret) {
    throw new AppError('Webhook HMAC secret is not configured', 500);
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer      = Buffer.from(signature,  'hex');
  const expectedBuffer = Buffer.from(expected,   'hex');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new AppError('Webhook signature verification failed', 401);
  }
  // ─────────────────────────────────────────────────────────────────────────

  const { order_id, status } = payload;

  if (!order_id) throw new AppError('Webhook payload missing order_id', 400);
  if (!status)   throw new AppError('Webhook payload missing status', 400);

  const mappedStatus = PORTER_STATUS_MAP[status];
  if (!mappedStatus) {
    return { ignored: true, reason: `unknown Porter status: ${status}` };
  }

  const update = { status: mappedStatus };
  if (mappedStatus === 'DELIVERED') update.deliveredAt = new Date();

  const delivery = await Delivery.findOneAndUpdate(
    { gigOrderId: order_id },
    update,
    { new: true }
  );

  if (!delivery) {
    return { ignored: true, reason: `no delivery for order_id: ${order_id}` };
  }

  return { delivery, mappedStatus };
};

/**
 * Get a single delivery by its MongoDB ID.
 */
exports.getDeliveryById = async (deliveryId) => {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }

  const delivery = await Delivery.findById(deliveryId)
    .populate('branchId', 'name address location librarian')
    .populate('userId',   'email phone deliveryAddress profiles');

  if (!delivery) throw new AppError('Delivery not found', 404);
  return delivery;
};

/**
 * Get delivery record linked to a book issue.
 */
exports.getDeliveryByIssueId = async (issueId) => {
  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    throw new AppError('Invalid issue ID', 400);
  }

  const delivery = await Delivery.findOne({ issueId })
    .populate('branchId', 'name address')
    .populate('userId',   'email phone');

  if (!delivery) throw new AppError('No delivery record found for this issue', 404);
  return delivery;
};

/**
 * Get all deliveries for a user, with optional status filter.
 */
exports.getUserDeliveries = async (userId, filters = {}) => {
  const query = { userId };
  if (filters.status) query.status = filters.status;

  return Delivery.find(query)
    .populate('branchId', 'name address')
    .sort('-createdAt');
};
