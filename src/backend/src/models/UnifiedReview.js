const mongoose = require('mongoose');

const reviewEntrySchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const unifiedReviewSchema = new mongoose.Schema(
  {
    isbn: {
      type: String,
      required: true,
      trim: true,
      index: true,
      unique: true,
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
    },
    reviews: {
      type: [reviewEntrySchema],
      default: [],
    },
    comments: {
      type: [reviewEntrySchema],
      default: [],
    },
    lastImportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('UnifiedReview', unifiedReviewSchema);
