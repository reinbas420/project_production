const mongoose = require('mongoose');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Notification Model (persisted notification history)
 * =====================================================
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: [
        'DUE_REMINDER',
        'DELIVERY_UPDATE',
        'PENALTY_ALERT',
        'RESERVATION_AVAILABLE',
        'GENERAL'
      ],
      default: 'GENERAL'
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Compound index for efficient "unread count" queries
notificationSchema.index({ userId: 1, read: 1 });

// Auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
