const shiprocketService = require('../services/shiprocketService');
const Delivery = require('../models/Delivery');
const Issue = require('../models/Issue');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const notificationService = require('../services/notificationService');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Shipment Controller (Shiprocket Integration)
 * =====================================================
 *
 * Endpoints:
 *   POST   /create          — Create shipment for a delivery
 *   POST   /assign-courier  — Assign courier & generate AWB
 *   GET    /track/:id       — Track a shipment
 *   POST   /cancel/:id      — Cancel a shipment
 *   POST   /check-service   — Check serviceability between pincodes
 *   POST   /webhook         — Shiprocket status webhook
 */

// ── Create Shipment ────────────────────────────────────

/**
 * Create a Shiprocket shipment for an existing library delivery.
 * POST /api/v1/shipments/create
 *
 * Body: { deliveryId } or full order details for ad-hoc shipment
 */
exports.createShipment = catchAsync(async (req, res, next) => {
  const { deliveryId } = req.body;

  let orderData;

  if (deliveryId) {
    // ── Linked to existing Delivery record ──
    const delivery = await Delivery.findById(deliveryId)
      .populate('userId')
      .populate('branchId')
      .populate({
        path: 'issueId',
        populate: { path: 'copyId', populate: { path: 'bookId', select: 'title' } }
      });

    if (!delivery) return next(new AppError('Delivery not found', 404));
    if (delivery.shiprocketOrderId) {
      return next(new AppError('Shipment already created for this delivery', 400));
    }

    const user = delivery.userId;
    const bookTitle = delivery.issueId?.copyId?.bookId?.title || 'Library Book';

    orderData = {
      order_id: `DLV-${delivery._id}`,
      billing_customer_name: user.profiles?.[0]?.name || 'Library User',
      billing_phone: user.phone,
      billing_email: user.email || '',
      billing_address: delivery.deliveryAddress,
      billing_city: user.deliveryAddress?.city || req.body.city || 'N/A',
      billing_pincode: user.deliveryAddress?.pincode || req.body.pincode,
      billing_state: user.deliveryAddress?.state || req.body.state || 'N/A',
      product_name: bookTitle,
      price: req.body.price || 0,
      payment_method: req.body.payment_method || 'Prepaid',
      pickup_location: req.body.pickup_location || 'Primary'
    };
  } else {
    // ── Ad-hoc shipment (direct order data from request body) ──
    const b = req.body;
    orderData = {
      order_id: b.order_id,
      billing_customer_name: b.name,
      billing_phone: b.phone,
      billing_email: b.email || '',
      billing_address: b.address,
      billing_city: b.city,
      billing_pincode: b.pincode,
      billing_state: b.state,
      product_name: b.product_name,
      price: b.price,
      payment_method: b.payment_method || 'COD',
      pickup_location: b.pickup_location || 'Primary'
    };
  }

  const shipment = await shiprocketService.createShipment(orderData);

  // If linked to a Delivery record, update it with Shiprocket IDs
  if (deliveryId && shipment) {
    await Delivery.findByIdAndUpdate(deliveryId, {
      providerName: 'SHIPROCKET',
      gigOrderId: String(shipment.order_id),
      shiprocketOrderId: shipment.order_id,
      shiprocketShipmentId: shipment.shipment_id,
      status: 'DISPATCHED'
    });
  }

  res.status(201).json({
    status: 'success',
    data: { shipment }
  });
});

// ── Assign Courier ─────────────────────────────────────

/**
 * Assign a courier & generate AWB for a shipment.
 * POST /api/v1/shipments/assign-courier
 *
 * Body: { shipmentId, courierId? }
 */
exports.assignCourier = catchAsync(async (req, res, next) => {
  const { shipmentId, courierId } = req.body;

  if (!shipmentId) return next(new AppError('shipmentId is required', 400));

  const result = await shiprocketService.assignCourier(shipmentId, courierId);

  // Update Delivery record if it exists
  const delivery = await Delivery.findOne({ shiprocketShipmentId: shipmentId });
  if (delivery && result) {
    delivery.awbCode = result.awb_code || result.awb_assign_status;
    delivery.courierName = result.courier_name || '';
    delivery.trackingUrl = `https://shiprocket.co/tracking/${result.awb_code}`;
    delivery.trackingId = result.awb_code;
    await delivery.save();
  }

  res.status(200).json({
    status: 'success',
    data: { courier: result }
  });
});

// ── Track Shipment ─────────────────────────────────────

/**
 * Track a shipment by delivery ID or shipment ID.
 * GET /api/v1/shipments/track/:id
 */
exports.trackShipment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // First check if `id` is a Delivery document _id
  const delivery = await Delivery.findById(id).catch(() => null);

  let trackingData;
  if (delivery?.shiprocketShipmentId) {
    trackingData = await shiprocketService.trackShipment(delivery.shiprocketShipmentId);
  } else if (delivery?.awbCode) {
    trackingData = await shiprocketService.trackByAwb(delivery.awbCode);
  } else {
    // Treat `id` as a Shiprocket shipment ID directly
    trackingData = await shiprocketService.trackShipment(id);
  }

  res.status(200).json({
    status: 'success',
    data: { tracking: trackingData }
  });
});

// ── Cancel Shipment ────────────────────────────────────

/**
 * Cancel a shipment (before dispatch).
 * POST /api/v1/shipments/cancel/:id
 */
exports.cancelShipment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const delivery = await Delivery.findById(id).catch(() => null);
  const shiprocketOrderId = delivery?.shiprocketOrderId || id;

  const result = await shiprocketService.cancelShipment(shiprocketOrderId);

  // Update delivery status
  if (delivery) {
    delivery.status = 'CANCELLED';
    await delivery.save();
  }

  res.status(200).json({
    status: 'success',
    data: { cancellation: result }
  });
});

// ── Check Serviceability ───────────────────────────────

/**
 * Check courier availability between two pin codes.
 * POST /api/v1/shipments/check-service
 *
 * Body: { pickupPincode, deliveryPincode, weight? }
 */
exports.checkServiceability = catchAsync(async (req, res, next) => {
  const { pickupPincode, deliveryPincode, weight } = req.body;

  if (!pickupPincode || !deliveryPincode) {
    return next(new AppError('pickupPincode and deliveryPincode are required', 400));
  }

  const result = await shiprocketService.checkServiceability(
    pickupPincode,
    deliveryPincode,
    weight
  );

  res.status(200).json({
    status: 'success',
    data: { serviceability: result }
  });
});

// ── Shiprocket Webhook ─────────────────────────────────

/**
 * Receive status updates from Shiprocket webhook.
 * POST /api/v1/shipments/webhook
 *
 * Shiprocket sends: { awb, current_status, shipment_id, order_id, ... }
 */
exports.shiprocketWebhook = catchAsync(async (req, res) => {
  const { awb, current_status, shipment_id, order_id, scans } = req.body;

  console.log(`📨 Shiprocket webhook — AWB: ${awb}, Status: ${current_status}`);

  // Map Shiprocket status to our Delivery status
  const statusMap = {
    '6':  'DISPATCHED',        // Shipped
    '17': 'OUT_FOR_DELIVERY',  // Out for delivery
    '7':  'DELIVERED',         // Delivered
    '8':  'CANCELLED',         // Cancelled
    '9':  'FAILED',            // RTO Initiated
    '18': 'FAILED'             // RTO Delivered
  };

  const deliveryStatus = statusMap[String(current_status)] || 'DISPATCHED';

  // Find & update the Delivery record
  const delivery = await Delivery.findOne({
    $or: [
      { shiprocketShipmentId: shipment_id },
      { awbCode: awb },
      { gigOrderId: String(order_id) }
    ]
  });

  if (delivery) {
    delivery.status = deliveryStatus;
    if (deliveryStatus === 'DELIVERED') delivery.deliveredAt = new Date();
    if (deliveryStatus === 'DISPATCHED' && !delivery.dispatchedAt) delivery.dispatchedAt = new Date();
    await delivery.save();

    // Send push notification to user
    const statusLabels = {
      DISPATCHED: 'DISPATCHED',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
      FAILED: 'FAILED'
    };

    try {
      const issue = await Issue.findById(delivery.issueId).populate({
        path: 'copyId',
        populate: { path: 'bookId', select: 'title' }
      });

      const bookTitle = issue?.copyId?.bookId?.title || 'your book';
      await notificationService.sendDeliveryUpdate(
        delivery.userId,
        bookTitle,
        statusLabels[deliveryStatus] || deliveryStatus
      );
    } catch (err) {
      console.warn('⚠️  Webhook notification failed:', err.message);
    }
  }

  // Always respond 200 to acknowledge the webhook
  res.status(200).json({ status: 'ok' });
});
