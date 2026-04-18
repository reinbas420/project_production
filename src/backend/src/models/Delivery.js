const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LibraryBranch',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deliveryAddress: {
    type: String,
    required: true
  },
  scheduledAt: {
    type: Date,
    required: true
  },
  dispatchedAt: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  // Gig provider fields (Porter / Borzo / Shiprocket)
  providerName: {
    type: String,
    enum: ['PORTER', 'BORZO', 'SHIPROCKET', 'MOCK', null],
    default: null
  },
  gigOrderId: {
    type: String
  },
  trackingId: {
    type: String
  },
  trackingUrl: {
    type: String
  },
  // ── Shiprocket-specific fields ──────────────────────
  shiprocketOrderId: {
    type: Number
  },
  shiprocketShipmentId: {
    type: Number
  },
  awbCode: {
    type: String
  },
  courierName: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
deliverySchema.index({ issueId: 1 });
deliverySchema.index({ userId: 1, status: 1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ gigOrderId: 1 }, { sparse: true });
deliverySchema.index({ shiprocketShipmentId: 1 }, { sparse: true });
deliverySchema.index({ awbCode: 1 }, { sparse: true });

module.exports = mongoose.model('Delivery', deliverySchema);
