const mongoose = require('mongoose');

function parseAgeRatingMin(ageRating) {
  if (!ageRating) return null;
  const value = String(ageRating).trim();
  const rangeMatch = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  const plusMatch = value.match(/^(\d+)\+$/);
  if (plusMatch) return parseInt(plusMatch[1], 10);
  return null;
}

function ageRangeFromMin(minAge) {
  const num = Number(minAge);
  if (!Number.isFinite(num) || num < 0) return '0-99';
  if (num <= 3) return '0-3';
  if (num <= 6) return '4-6';
  if (num <= 8) return '6-8';
  if (num <= 10) return '8-10';
  if (num <= 12) return '10-12';
  if (num <= 15) return '12-15';
  return `${Math.floor(num)}-99`;
}

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  isbn: {
    type: Number,
    unique: true,
    required: true,
    sparse: true
  },
  genre: {
    type: [{
      type: String,
      trim: true
    }],
    default: [],
  },
  language: {
    type: String,
    default: 'English'
  },
  ageRating: {
    type: String,
    default: '0-99',
    trim: true,
  },
  minAge: {
    type: Number,
    min: 0,
    default: 0
  },
  collectionName: {
    type: String,
    trim: true
  },
  bookURL: {
    type: String,
    trim: true
  },
  summary: {
    type: String,
    required: true,
    maxlength: 1000
  },
  coverImage: {
    type: String
  },
  pageCount: {
    type: Number,
    min: 1
  },
  publishedDate: {
    type: String,
    trim: true
  },
  generatedTags: {
    type: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    default: []
  },
  chatbotTags: {
    type: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    default: []
  },
  plot_embeddings: {
    type: [Number],
    default: undefined,
  },
  plot_embeddings_dim: {
    type: Number,
    default: undefined,
  },
  embedding_provider: {
    type: String,
    trim: true,
    lowercase: true,
    default: undefined,
  },
  embedding_title: {
    type: String,
    trim: true,
    default: undefined,
  },
  embedding_author: {
    type: String,
    trim: true,
    default: undefined,
  },
  embedding_migrated_at: {
    type: Date,
    default: undefined,
  }
}, {
  timestamps: true
});

bookSchema.pre('validate', function deriveAgeFields(next) {
  if (this.ageRating && (this.minAge === undefined || this.minAge === null)) {
    const parsed = parseAgeRatingMin(this.ageRating);
    if (parsed !== null) {
      this.minAge = parsed;
    }
  }

  if ((!this.ageRating || !String(this.ageRating).trim()) && this.minAge !== undefined && this.minAge !== null) {
    this.ageRating = ageRangeFromMin(this.minAge);
  }

  if (Array.isArray(this.plot_embeddings) && this.plot_embeddings.length > 0) {
    this.plot_embeddings_dim = this.plot_embeddings.length;
  }

  next();
});

// Indexes for search
bookSchema.index({ title: 'text', author: 'text' }, { language_override: 'textSearchLang' });
bookSchema.index({ genre: 1 });
bookSchema.index({ ageRating: 1 });
bookSchema.index({ minAge: 1 });
bookSchema.index({ generatedTags: 1 });
bookSchema.index({ chatbotTags: 1 });
bookSchema.index({ plot_embeddings_dim: 1 });
bookSchema.index({ embedding_provider: 1 });

module.exports = mongoose.model('Book', bookSchema);
