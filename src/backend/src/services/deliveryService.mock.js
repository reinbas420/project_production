'use strict';

/**
 * Delivery Service — MOCK (Development / Demo mode)
 *
 * Fully simulates the Porter hyperlocal gig API contract without making any
 * real HTTP calls. Unlike a stub (which just returns canned values), this mock:
 *
 *  - Maintains in-memory state for every Porter "order" it creates
 *  - Responds with realistic Porter-shaped payloads
 *  - Exposes advanceStatus() so tests / demo scripts can drive the lifecycle
 *  - Fires simulated webhook payloads via processWebhookUpdate() so the full
 *    webhook pipeline (HMAC verification excluded in mock mode) is exercised
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Status lifecycle                                           │
 * │  SCHEDULED → DISPATCHED → OUT_FOR_DELIVERY → DELIVERED     │
 * │                       ↘                  ↘ FAILED          │
 * │                         CANCELLED                          │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Switch to real service:
 *   In deliveryController.js change the require to './deliveryService'
 */

const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const AppError = require('../utils/AppError');

const PROVIDER = 'PORTER';

// In-memory registry: gigOrderId → mock order state
// Persists for the lifetime of the Node process (survives across requests)
const _mockOrders = new Map();

// Porter event names (mirrors real Porter webhook events)
const STATUS_PROGRESSION = [
  'order_placed',    // → DISPATCHED
  'rider_assigned',  // → OUT_FOR_DELIVERY
  'picked_up',       // → OUT_FOR_DELIVERY (rider has the package)
  'delivered',       // → DELIVERED
];

const PORTER_STATUS_MAP = {
  order_placed:   'DISPATCHED',
  rider_assigned: 'OUT_FOR_DELIVERY',
  picked_up:      'OUT_FOR_DELIVERY',
  delivered:      'DELIVERED',
  failed:         'FAILED',
  cancelled:      'CANCELLED',
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function _generateOrderId() {
  return `PORTER-MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
}

function _buildMockPorterResponse(gigOrderId, payload) {
  return {
    order_id:      gigOrderId,
    tracking_link: `https://porter.in/track/${gigOrderId}`,
    status:        'order_placed',
    estimated_minutes: Math.floor(Math.random() * 30) + 20,  // 20–50 min ETA
    pickup: payload.pickup_details,
    drop:   payload.drop_details,
    vehicle_type: payload.vehicle_type,
    created_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core delivery operations (same interface as real deliveryService.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dispatch a SCHEDULED delivery.
 * Simulates POST /v1/orders to Porter and persists the result.
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

  const [pickupLng, pickupLat] = branch.location.coordinates;
  const [dropLng,   dropLat]   = user.deliveryAddress.location.coordinates;

  // Build the same payload structure as the real service would send to Porter
  const porterPayload = {
    pickup_details: {
      address: {
        apartment_address: branch.address,
        city:    user.deliveryAddress.city || 'Hyderabad',
        state:   'Telangana',
        pincode: String(user.deliveryAddress?.pincode || '500001'),
        country: 'India',
        lat: pickupLat,
        lng: pickupLng,
        contact_details: {
          name:         branch.librarian || 'Library Staff',
          phone_number: '9000000000',
        },
      },
    },
    drop_details: {
      address: {
        apartment_address: user.deliveryAddress.street || delivery.deliveryAddress,
        city:    user.deliveryAddress.city || 'Hyderabad',
        state:   'Telangana',
        pincode: String(user.deliveryAddress?.pincode || '500001'),
        country: 'India',
        lat: dropLat,
        lng: dropLng,
        contact_details: {
          name:         user.profiles?.[0]?.name || 'Customer',
          phone_number: user.phone,
        },
      },
    },
    vehicle_type: { id: 3 }, // 2-Wheeler
    invoice: { amount: 50, currency: 'INR' },
    acknowledgement_code: delivery._id.toString(),
  };

  // Mock Porter's POST /v1/orders response
  const gigOrderId    = _generateOrderId();
  const porterResponse = _buildMockPorterResponse(gigOrderId, porterPayload);

  // Register in in-memory state tracker
  _mockOrders.set(gigOrderId, {
    gigOrderId,
    deliveryId:     delivery._id.toString(),
    currentEvent:   'order_placed',
    eventIndex:     0,
    porterResponse,
    history:        [{ event: 'order_placed', at: new Date() }],
  });

  // Persist to DB
  delivery.status       = 'DISPATCHED';
  delivery.providerName = PROVIDER;
  delivery.gigOrderId   = gigOrderId;
  delivery.trackingId   = gigOrderId;
  delivery.trackingUrl  = porterResponse.tracking_link;
  delivery.dispatchedAt = new Date();
  await delivery.save();

  return {
    delivery,
    gigOrderId,
    trackingUrl:       porterResponse.tracking_link,
    estimatedMinutes:  porterResponse.estimated_minutes,
    _mockPorterResponse: porterResponse,   // visible in API response for dev/testing
  };
};

/**
 * Simulate Porter pushing a webhook event for the next status in the lifecycle.
 * Advances the in-memory order state and updates the DB.
 *
 * Called via PATCH /api/v1/delivery/mock/:gigOrderId/advance
 * Available in NODE_ENV !== 'production' only.
 */
exports.advanceStatus = async (gigOrderId) => {
  const order = _mockOrders.get(gigOrderId);
  if (!order) {
    throw new AppError(
      `No mock order found for gigOrderId: ${gigOrderId}. Was dispatchDelivery called?`,
      404
    );
  }

  const nextIndex = order.eventIndex + 1;
  if (nextIndex >= STATUS_PROGRESSION.length) {
    throw new AppError('Delivery is already at the final status (DELIVERED)', 400);
  }

  const nextEvent  = STATUS_PROGRESSION[nextIndex];
  const nextStatus = PORTER_STATUS_MAP[nextEvent];

  // Update in-memory state
  order.eventIndex  = nextIndex;
  order.currentEvent = nextEvent;
  order.history.push({ event: nextEvent, at: new Date() });

  // Simulate the exact webhook payload Porter would send
  const webhookPayload = {
    order_id: gigOrderId,
    status:   nextEvent,
    timestamp: new Date().toISOString(),
  };

  // Apply to DB (same logic as real webhook handler, but no HMAC needed in mock)
  const update = { status: nextStatus };
  if (nextStatus === 'DELIVERED') update.deliveredAt = new Date();

  const delivery = await Delivery.findOneAndUpdate(
    { gigOrderId },
    update,
    { new: true }
  );

  return {
    gigOrderId,
    porterEvent:   nextEvent,
    newStatus:     nextStatus,
    delivery,
    simulatedWebhookPayload: webhookPayload,
    remainingSteps: STATUS_PROGRESSION.length - 1 - nextIndex,
  };
};

/**
 * Simulate cancellation — mirrors real cancelDelivery() interface.
 */
exports.cancelDelivery = async (deliveryId, reason = '') => {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }

  const delivery = await Delivery.findById(deliveryId);
  if (!delivery) throw new AppError('Delivery not found', 404);

  const cancellable = ['SCHEDULED', 'DISPATCHED', 'OUT_FOR_DELIVERY'];
  if (!cancellable.includes(delivery.status)) {
    throw new AppError(`Cannot cancel a delivery in status: ${delivery.status}`, 400);
  }

  // Update mock order state
  if (delivery.gigOrderId && _mockOrders.has(delivery.gigOrderId)) {
    const order = _mockOrders.get(delivery.gigOrderId);
    order.currentEvent = 'cancelled';
    order.history.push({ event: 'cancelled', reason, at: new Date() });
  }

  delivery.status = 'CANCELLED';
  await delivery.save();
  return delivery;
};

/**
 * Simulate GET /v1/orders/:gigOrderId — returns the current mock order state.
 * Mirrors the real syncDeliveryStatus() interface.
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

  const order = _mockOrders.get(delivery.gigOrderId);
  const porterStatus = order ? order.currentEvent : null;

  return {
    delivery,
    porterStatus,
    mappedStatus:  porterStatus ? PORTER_STATUS_MAP[porterStatus] : null,
    _mockOrderHistory: order?.history || [],
  };
};

/**
 * Process a webhook payload (mock mode — HMAC verification skipped).
 * Accepts Porter-shaped payload and updates delivery status in DB.
 */
exports.processWebhookUpdate = async (_rawBody, _signature, payload) => {
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
 * Update delivery status manually.
 */
exports.updateDeliveryStatus = async (deliveryId, status, extra = {}) => {
  const VALID_STATUSES = [
    'SCHEDULED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED',
  ];

  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new AppError(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
  }

  const update = { status };
  if (status === 'DELIVERED') update.deliveredAt = extra.deliveredAt || new Date();

  const delivery = await Delivery.findByIdAndUpdate(deliveryId, update, { new: true });
  if (!delivery) throw new AppError('Delivery not found', 404);
  return delivery;
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
 * Get all deliveries for a user.
 */
exports.getUserDeliveries = async (userId, filters = {}) => {
  const query = { userId };
  if (filters.status) query.status = filters.status;

  return Delivery.find(query)
    .populate('branchId', 'name address')
    .sort('-createdAt');
};

/**
 * Expose in-memory order registry (for tests / debugging).
 */
exports._getMockOrders = () => Object.fromEntries(_mockOrders);
exports._clearMockOrders = () => _mockOrders.clear();
