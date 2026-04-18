const express = require('express');
const deliveryController = require('../controllers/deliveryController');
const { protect, restrictTo } = require('../middleware/auth');

const config = require('../config');

const router = express.Router();

// ─── Webhook — no auth, raw body captured for HMAC verification
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body;
    try { req.body = JSON.parse(req.rawBody.toString('utf8')); }
    catch { req.body = {}; }
    next();
  },
  deliveryController.handleWebhook
);

// ─── All routes below require a valid JWT
router.use(protect);

// ─── Mock control endpoints (non-production only)
if (config.nodeEnv !== 'production') {
  router.patch(
    '/mock/:gigOrderId/advance',
    restrictTo('LIBRARIAN', 'ADMIN'),
    deliveryController.advanceMockStatus
  );
  router.get(
    '/mock/orders',
    restrictTo('LIBRARIAN', 'ADMIN'),
    deliveryController.getMockOrders
  );
}

// ─── User: view own deliveries
router.get('/my',               deliveryController.getMyDeliveries);
router.get('/issue/:issueId',   deliveryController.getDeliveryByIssue);
router.get('/:deliveryId',      deliveryController.getDelivery);

// ─── Librarian / Admin: operational actions
router.patch(
  '/:deliveryId/dispatch',
  restrictTo('LIBRARIAN', 'ADMIN'),
  deliveryController.dispatchDelivery
);
router.patch(
  '/:deliveryId/status',
  restrictTo('LIBRARIAN', 'ADMIN'),
  deliveryController.updateDeliveryStatus
);
router.patch(
  '/:deliveryId/cancel',
  restrictTo('LIBRARIAN', 'ADMIN'),
  deliveryController.cancelDelivery
);
router.get(
  '/:deliveryId/sync',
  restrictTo('LIBRARIAN', 'ADMIN'),
  deliveryController.syncDeliveryStatus
);

module.exports = router;
