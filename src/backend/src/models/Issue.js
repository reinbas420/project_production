const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  copyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookCopy',
    required: true
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  returnDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ISSUED', 'RETURNED', 'OVERDUE'],
    default: 'ISSUED'
  },
  type: {
    type: String,
    enum: ['PHYSICAL', 'DIGITAL'],
    default: 'PHYSICAL'
  }
}, {
  timestamps: true
});

// Indexes for queries
issueSchema.index({ userId: 1, status: 1 });
issueSchema.index({ profileId: 1 });
issueSchema.index({ copyId: 1 });
issueSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Issue', issueSchema);
