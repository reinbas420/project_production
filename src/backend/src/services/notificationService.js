const admin = require('firebase-admin');
const Notification = require('../models/Notification');
const User = require('../models/User');
const config = require('../config');
const AppError = require('../utils/AppError');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Push Notification Service (Firebase Cloud Messaging)
 * =====================================================
 *
 * Handles all push notifications for:
 *   - Due date reminders
 *   - Delivery updates
 *   - Penalty alerts
 *   - Reservation availability
 */

// ── Firebase Admin SDK Initialization ──────────────────
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return;

  // Don't attempt init when project ID is missing — avoids a silent broken state
  if (!config.firebase.projectId) {
    console.warn('⚠️  Firebase not configured — push notifications disabled');
    console.warn('   Set FIREBASE_PROJECT_ID & service account to enable FCM');
    return;
  }

  try {
    if (config.firebase.serviceAccountPath) {
      const serviceAccount = require(config.firebase.serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.firebase.projectId
      });
    } else {
      // Use application default credentials (for cloud deployments)
      admin.initializeApp({
        projectId: config.firebase.projectId
      });
    }
    firebaseInitialized = true;
    console.log('🔥 Firebase Admin SDK initialized');
  } catch (error) {
    console.warn('⚠️  Firebase init failed — push notifications disabled');
    console.warn('   Error:', error.message);
  }
};

// ── Token Management ───────────────────────────────────

/**
 * Register / update a user's FCM device token
 */
exports.registerDeviceToken = async (userId, token, platform = 'android') => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  // Avoid duplicate tokens
  const existing = user.fcmTokens || [];
  const alreadyRegistered = existing.find((t) => t.token === token);

  if (alreadyRegistered) {
    alreadyRegistered.platform = platform;
    alreadyRegistered.updatedAt = new Date();
  } else {
    existing.push({ token, platform, updatedAt: new Date() });
  }

  user.fcmTokens = existing;
  await user.save();

  return { message: 'Device token registered successfully' };
};

/**
 * Remove an FCM token (e.g. on logout)
 */
exports.removeDeviceToken = async (userId, token) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  user.fcmTokens = (user.fcmTokens || []).filter((t) => t.token !== token);
  await user.save();

  return { message: 'Device token removed successfully' };
};

// ── Core Send Functions ────────────────────────────────

/**
 * Send push notification to a single user
 */
exports.sendToUser = async (userId, title, body, data = {}) => {
  const user = await User.findById(userId);
  if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
    // Still persist the notification in DB even if user has no tokens
    await _persistNotification(userId, title, body, data);
    return { sent: false, reason: 'No device tokens registered' };
  }

  const tokens = user.fcmTokens.map((t) => t.token);
  const result = await _sendMulticast(tokens, title, body, data);

  // Persist to DB
  await _persistNotification(userId, title, body, data);

  // Clean up invalid tokens
  if (result.failedTokens.length > 0) {
    user.fcmTokens = user.fcmTokens.filter(
      (t) => !result.failedTokens.includes(t.token)
    );
    await user.save();
  }

  return result;
};

/**
 * Send push notification to multiple users
 */
exports.sendToUsers = async (userIds, title, body, data = {}) => {
  const results = [];
  for (const userId of userIds) {
    try {
      const result = await exports.sendToUser(userId, title, body, data);
      results.push({ userId, ...result });
    } catch (error) {
      results.push({ userId, sent: false, error: error.message });
    }
  }
  return results;
};

// ── Notification Templates ─────────────────────────────

/**
 * Due-date reminder (sent 1 day before due)
 */
exports.sendDueReminder = async (userId, bookTitle, dueDate) => {
  const title = '📚 Book Due Tomorrow!';
  const body = `"${bookTitle}" is due on ${new Date(dueDate).toLocaleDateString()}. Please return it on time to avoid penalties.`;
  return exports.sendToUser(userId, title, body, {
    type: 'DUE_REMINDER',
    dueDate: dueDate.toString()
  });
};

/**
 * Delivery status update
 */
exports.sendDeliveryUpdate = async (userId, bookTitle, status) => {
  const statusMessages = {
    DISPATCHED: `Your book "${bookTitle}" has been dispatched! 🚚`,
    OUT_FOR_DELIVERY: `"${bookTitle}" is out for delivery — keep an eye on the door! 📦`,
    DELIVERED: `"${bookTitle}" has been delivered. Happy reading! 📖`,
    PICKED_UP: `"${bookTitle}" has been picked up for return. 🔄`
  };

  const title = '🚚 Delivery Update';
  const body = statusMessages[status] || `Delivery status for "${bookTitle}": ${status}`;

  return exports.sendToUser(userId, title, body, {
    type: 'DELIVERY_UPDATE',
    deliveryStatus: status
  });
};

/**
 * Penalty / overdue alert
 */
exports.sendPenaltyAlert = async (userId, bookTitle, fineAmount, overdueDays) => {
  const title = '⚠️ Overdue Fine Alert';
  const body = `"${bookTitle}" is ${overdueDays} day(s) overdue. Current fine: ₹${fineAmount}. Return ASAP to stop accumulating fines.`;

  return exports.sendToUser(userId, title, body, {
    type: 'PENALTY_ALERT',
    fineAmount: String(fineAmount),
    overdueDays: String(overdueDays)
  });
};

/**
 * Reservation available
 */
exports.sendReservationAvailable = async (userId, bookTitle) => {
  const title = '🎉 Your Reserved Book is Available!';
  const body = `Great news! "${bookTitle}" is now available for you. Borrow it before someone else does!`;

  return exports.sendToUser(userId, title, body, {
    type: 'RESERVATION_AVAILABLE'
  });
};

// ── User Notification History ──────────────────────────

/**
 * Get notifications for a user
 */
exports.getUserNotifications = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments({ userId });

  return { notifications, total, page, limit };
};

/**
 * Mark notification as read
 */
exports.markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );

  if (!notification) throw new AppError('Notification not found', 404);
  return notification;
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (userId) => {
  await Notification.updateMany({ userId, read: false }, { read: true });
  return { message: 'All notifications marked as read' };
};

// ── Internal Helpers ───────────────────────────────────

async function _sendMulticast(tokens, title, body, data) {
  if (!firebaseInitialized) {
    console.log(`📨 [FCM Stub] → "${title}" — ${body}`);
    return { sent: false, reason: 'Firebase not initialized', failedTokens: [] };
  }

  try {
    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) failedTokens.push(tokens[idx]);
    });

    return {
      sent: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens
    };
  } catch (error) {
    console.error('❌ FCM send error:', error.message);
    return { sent: false, error: error.message, failedTokens: [] };
  }
}

async function _persistNotification(userId, title, body, data) {
  try {
    await Notification.create({
      userId,
      title,
      body,
      data,
      type: data.type || 'GENERAL',
      read: false
    });
  } catch (error) {
    console.error('❌ Failed to persist notification:', error.message);
  }
}

// Initialize Firebase when module loads
initializeFirebase();
