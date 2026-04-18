const mongoose = require('mongoose');

/**
 * Stores pre-generated quiz questions for a book.
 *
 * Design rules:
 *   - At most MAX_POOL_SIZE (60) questions per book in total.
 *   - Questions are generated in batches of BATCH_SIZE (30) via a background call.
 *   - Each question tracks which users have already answered it so we can
 *     serve fresh, unseen questions per user.
 */

const MAX_POOL_SIZE = 60;
const BATCH_SIZE    = 10;
const QUIZ_SIZE     = 5;

const questionSchema = new mongoose.Schema(
  {
    question:      { type: String, required: true },
    options:       { type: [String], required: true },
    correctAnswer: { type: String, required: true },
    // Array of userIds who have already answered this question
    usedBy:        { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { _id: true }
);

const bookQuizPoolSchema = new mongoose.Schema(
  {
    bookId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Book',
      required: true,
      unique:   true,
    },
    questions:      { type: [questionSchema], default: [] },
    // Tracks whether a background generation is currently in progress
    // so we don't fire two simultaneous Gemini calls for the same book.
    generating:     { type: Boolean, default: false },
  },
  { timestamps: true }
);

bookQuizPoolSchema.index({ bookId: 1 });

// Expose constants so service layer can import them without magic numbers.
bookQuizPoolSchema.statics.MAX_POOL_SIZE = MAX_POOL_SIZE;
bookQuizPoolSchema.statics.BATCH_SIZE    = BATCH_SIZE;
bookQuizPoolSchema.statics.QUIZ_SIZE     = QUIZ_SIZE;

module.exports = mongoose.model('BookQuizPool', bookQuizPoolSchema);
