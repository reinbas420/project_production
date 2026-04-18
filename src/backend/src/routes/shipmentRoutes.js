const express = require('express');
const shipmentController = require('../controllers/shipmentController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Shipment Routes (Shiprocket Integration)
 * =====================================================
 */

const router = express.Router();

// ── Webhook (no auth — called by Shiprocket servers) ───
router.post('/webhook', shipmentController.shiprocketWebhook);

// ── All other routes require authentication ────────────
router.use(protect);

// ── Serviceability Check (any authenticated user) ──────
const serviceCheckSchema = Joi.object({
  pickupPincode: Joi.string().pattern(/^\d{6}$/).required(),
  deliveryPincode: Joi.string().pattern(/^\d{6}$/).required(),
  weight: Joi.number().min(0.1).max(50).optional()
});

router.post(
  '/check-service',
  validate(serviceCheckSchema),
  shipmentController.checkServiceability
);

// ── Track shipment (any authenticated user can track their own) ──
router.get('/track/:id', shipmentController.trackShipment);

// ── Admin / Librarian only routes ──────────────────────
router.use(restrictTo('ADMIN', 'LIBRARIAN'));

// Create shipment
const createShipmentSchema = Joi.object({
  // Either deliveryId for linked shipment...
  deliveryId: Joi.string().optional(),
  // ...or full ad-hoc order details
  order_id: Joi.string().when('deliveryId', { is: Joi.exist(), otherwise: Joi.required() }),
  name: Joi.string().when('deliveryId', { is: Joi.exist(), otherwise: Joi.required() }),
  phone: Joi.string().when('deliveryId', { is: Joi.exist(), otherwise: Joi.required() }),
  email: Joi.string().email().optional(),
  address: Joi.string().when('deliveryId', { is: Joi.exist(), otherwise: Joi.required() }),
  city: Joi.string().optional(),
  pincode: Joi.string().pattern(/^\d{6}$/).when('deliveryId', { is: Joi.exist(), otherwise: Joi.required() }),
  state: Joi.string().optional(),
  product_name: Joi.string().optional(),
  price: Joi.number().min(0).optional(),
  payment_method: Joi.string().valid('COD', 'Prepaid').optional(),
  pickup_location: Joi.string().optional()
}).or('deliveryId', 'order_id'); // At least one must be present

router.post(
  '/create',
  validate(createShipmentSchema),
  shipmentController.createShipment
);

// Assign courier
const assignCourierSchema = Joi.object({
  shipmentId: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  courierId: Joi.alternatives().try(Joi.string(), Joi.number()).optional()
});

router.post(
  '/assign-courier',
  validate(assignCourierSchema),
  shipmentController.assignCourier
);

// Cancel shipment
router.post('/cancel/:id', shipmentController.cancelShipment);

module.exports = router;
