const notificationService = require('../services/notificationService');
const catchAsync = require('../utils/catchAsync');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Notification Controller
 * =====================================================
 */

/**
 * Register device FCM token
 * POST /api/v1/notifications/register-token
 */
exports.registerToken = catchAsync(async (req, res) => {
  const { token, platform } = req.body;
  const result = await notificationService.registerDeviceToken(
    req.user._id,
    token,
    platform
  );

  res.status(200).json({ status: 'success', data: result });
});

/**
 * Remove device FCM token (on logout)
 * DELETE /api/v1/notifications/remove-token
 */
exports.removeToken = catchAsync(async (req, res) => {
  const { token } = req.body;
  const result = await notificationService.removeDeviceToken(req.user._id, token);

  res.status(200).json({ status: 'success', data: result });
});

/**
 * Get user notifications (paginated)
 * GET /api/v1/notifications
 */
exports.getNotifications = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await notificationService.getUserNotifications(
    req.user._id,
    page,
    limit
  );

  res.status(200).json({ status: 'success', data: result });
});

/**
 * Mark single notification as read
 * PUT /api/v1/notifications/:id/read
 */
exports.markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(
    req.params.id,
    req.user._id
  );

  res.status(200).json({ status: 'success', data: { notification } });
});

/**
 * Mark all notifications as read
 * PUT /api/v1/notifications/read-all
 */
exports.markAllAsRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);

  res.status(200).json({ status: 'success', data: result });
});

/**
 * Send test notification (admin only — useful for debugging)
 * POST /api/v1/notifications/test
 */
exports.sendTestNotification = catchAsync(async (req, res) => {
  const { userId, title, body } = req.body;
  const targetUserId = userId || req.user._id;

  const result = await notificationService.sendToUser(
    targetUserId,
    title || '🔔 Test Notification',
    body || 'This is a test notification from the platform.'
  );

  res.status(200).json({ status: 'success', data: result });
});
