'use strict';

/**
 * Delivery Service — STUB (Prototype Mode)
 *
 * Simulates placing orders with Porter (hyperlocal gig delivery, Hyderabad).
 * All gig-API calls are logged to console instead of actually being made.
 *
 * TODO (production): replace the [STUB] blocks with real HTTP calls to
 *   POST https://api.porter.in/v1/orders  (or Borzo equivalent)
 *   and add HMAC signature verification in processWebhookUpdate().
 */

const mongoose = require('mongoose');
const Delivery = require('../models/Delivery');
const AppError = require('../utils/AppError');

const PROVIDER = 'PORTER';

// Porter status → our internal status
const PORTER_STATUS_MAP = {
  order_placed:   'DISPATCHED',
  rider_assigned: 'OUT_FOR_DELIVERY',
  picked_up:      'OUT_FOR_DELIVERY',
  delivered:      'DELIVERED',
  failed:         'FAILED',
  cancelled:      'CANCELLED',
};

/**
 * Dispatch a SCHEDULED delivery.
 * Simulates calling Porter API to create a pickup order from the library
 * branch and drop books at the user's home address.
 *
 * Called by a librarian once the book is packed and ready.
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
      `Cannot dispatch a delivery that is already in status: ${delivery.status}`,
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

  // ── STUB: log what we would POST to Porter ─────────────────────────────────
  const porterPayload = {
    pickup: {
      address:      branch.address,
      lat:          pickupLat,
      lng:          pickupLng,
      contact_name: branch.librarian || 'Library Staff',
    },
    drop: {
      address: delivery.deliveryAddress,
      lat:     dropLat,
      lng:     dropLng,
    },
    vehicle_type:  { id: 3 },
    weight_kg:     0.5,
    instructions:  'Handle with care — books',
  };

  console.log('\n[DELIVERY STUB] Would POST to Porter API:');
  console.log('  URL: https://api.porter.in/v1/orders');
  console.log('  Pickup:');
  console.table(porterPayload.pickup);
  console.log('  Drop:');
  console.table(porterPayload.drop);
  // ── END STUB ───────────────────────────────────────────────────────────────

  // Mock Porter response
  const gigOrderId  = `PORTER-ORD-${Date.now()}`;
  const trackingId  = `TRK-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  const trackingUrl = `https://track.porter.in/track/${trackingId}`;

  delivery.status       = 'DISPATCHED';
  delivery.providerName = PROVIDER;
  delivery.gigOrderId   = gigOrderId;
  delivery.trackingId   = trackingId;
  delivery.trackingUrl  = trackingUrl;
  delivery.dispatchedAt = new Date();
  await delivery.save();

  return { delivery, gigOrderId, trackingId, trackingUrl };
};

/**
 * Update delivery status manually (librarian action or admin override).
 */
exports.updateDeliveryStatus = async (deliveryId, status, extra = {}) => {
  const VALID_STATUSES = ['SCHEDULED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'];

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

  console.log(`[DELIVERY STUB] Status updated → ${status} for delivery ${deliveryId}`);
  return delivery;
};

/**
 * Process a webhook payload from Porter / Borzo.
 * In production: verify the provider's HMAC signature from request headers
 * BEFORE calling this function.
 */
exports.processWebhookUpdate = async (payload) => {
  const { order_id, status } = payload;

  if (!order_id) throw new AppError('Webhook payload missing order_id', 400);
  if (!status)   throw new AppError('Webhook payload missing status', 400);

  const mappedStatus = PORTER_STATUS_MAP[status];
  if (!mappedStatus) {
    console.log(`[DELIVERY STUB] Webhook: unknown Porter status '${status}', skipping`);
    return { ignored: true, reason: `unknown status: ${status}` };
  }

  const update = { status: mappedStatus };
  if (mappedStatus === 'DELIVERED') update.deliveredAt = new Date();

  const delivery = await Delivery.findOneAndUpdate(
    { gigOrderId: order_id },
    update,
    { new: true }
  );

  if (!delivery) {
    console.log(`[DELIVERY STUB] Webhook: no delivery found for gigOrderId ${order_id}`);
    return { ignored: true, reason: `no delivery for order_id: ${order_id}` };
  }

  console.log(`[DELIVERY STUB] Webhook processed: ${order_id} → ${mappedStatus}`);
  return { delivery, mappedStatus };
};

/**
 * Get a single delivery by its ID.
 */
exports.getDeliveryById = async (deliveryId) => {
  if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
    throw new AppError('Invalid delivery ID', 400);
  }

  const delivery = await Delivery.findById(deliveryId)
    .populate('branchId', 'name address location')
    .populate('userId',   'email phone deliveryAddress');

  if (!delivery) throw new AppError('Delivery not found', 404);
  return delivery;
};

/**
 * Get delivery record for a specific book issue.
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
