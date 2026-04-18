const mongoose = require('mongoose');

const bookCopySchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LibraryBranch',
    required: true
  },
  barcode: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED'],
    default: 'AVAILABLE'
  },
  condition: {
    type: String,
    enum: ['GOOD', 'FAIR', 'POOR'],
    default: 'GOOD'
  },
  shelf: {
    type: String,
    trim: true,
    default: 'UNASSIGNED'
  },
  rack: {
    type: String,
    trim: true,
    default: 'UNASSIGNED'
  },
  lastIssuedAt: {
    type: Date
  },
  lastReturnedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
bookCopySchema.index({ bookId: 1, branchId: 1 });
bookCopySchema.index({ branchId: 1, shelf: 1, rack: 1 });
bookCopySchema.index({ status: 1 });
// Note: barcode index is automatically created by unique: true

module.exports = mongoose.model('BookCopy', bookCopySchema);
