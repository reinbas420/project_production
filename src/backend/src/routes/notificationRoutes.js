const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Notification Routes
 * =====================================================
 */

const router = express.Router();

// All notification routes require authentication
router.use(protect);

// ── Token Management ───────────────────────────────────

const tokenSchema = Joi.object({
  token: Joi.string().required(),
  platform: Joi.string().valid('android', 'ios', 'web').default('android')
});

router.post(
  '/register-token',
  validate(tokenSchema),
  notificationController.registerToken
);

router.delete('/remove-token', notificationController.removeToken);

// ── Notification History ───────────────────────────────

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);  // must come before /:id
router.put('/:id/read', notificationController.markAsRead);

// ── Admin: Test Notification ───────────────────────────

router.post(
  '/test',
  restrictTo('ADMIN'),
  notificationController.sendTestNotification
);

module.exports = router;
