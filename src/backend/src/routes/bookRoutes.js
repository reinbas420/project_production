const express = require('express');
const bookController = require('../controllers/bookController');
const { protect, restrictTo, requireActiveSubscription } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
// Only isbn is required — all other fields are auto-filled from Google Books /
// Open Library. Librarian-supplied values always override fetched metadata.
const createBookSchema = Joi.object({
  isbn: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
  title: Joi.string().optional(),
  author: Joi.string().optional(),
  genre: Joi.array().items(Joi.string()).min(1).optional(),
  language: Joi.string().optional(),
  ageRating: Joi.string().pattern(/^(\d+\s*-\s*\d+|\d+\+)$/).optional(),
  minAge: Joi.number().integer().min(0).max(99).optional(),
  collectionName: Joi.string().optional(),
  bookURL: Joi.string().uri().optional(),
  summary: Joi.string().max(1000).optional(),
  coverImage: Joi.string().optional(),
  pageCount: Joi.number().integer().optional(),
  publisher: Joi.string().optional(),
  generatedTags: Joi.array().items(Joi.string()).optional(),
  chatbotTags: Joi.array().items(Joi.string()).optional(),
  plot_embeddings: Joi.array().items(Joi.number()).optional(),
  plot_embeddings_dim: Joi.number().integer().min(1).optional(),
  embedding_provider: Joi.string().optional(),
  embedding_title: Joi.string().optional(),
  embedding_author: Joi.string().optional(),
  embedding_migrated_at: Joi.date().optional(),
});

const updateBookSchema = Joi.object({
  title: Joi.string(),
  author: Joi.string(),
  isbn: Joi.number().optional(),
  genre: Joi.array().items(Joi.string()).min(1).optional(),
  language: Joi.string(),
  ageRating: Joi.string().pattern(/^(\d+\s*-\s*\d+|\d+\+)$/).optional(),
  minAge: Joi.number().integer().min(0).max(99).optional(),
  collectionName: Joi.string(),
  bookURL: Joi.string().uri().optional(),
  summary: Joi.string().max(1000).optional(),
  coverImage: Joi.string(),
  generatedTags: Joi.array().items(Joi.string()).optional(),
  chatbotTags: Joi.array().items(Joi.string()).optional(),
  plot_embeddings: Joi.array().items(Joi.number()).optional(),
  plot_embeddings_dim: Joi.number().integer().min(1).optional(),
  embedding_provider: Joi.string().optional(),
  embedding_title: Joi.string().optional(),
  embedding_author: Joi.string().optional(),
  embedding_migrated_at: Joi.date().optional(),
});

// Public routes (anyone can browse books)
router.get('/', bookController.getAllBooks);
router.get('/branch/:branchId', bookController.getBranchBooks);
router.post('/chat', protect, requireActiveSubscription('aiRecommendations'), bookController.chatWithOwl);
router.post('/chat/stream', protect, requireActiveSubscription('aiRecommendations'), bookController.streamChatWithOwl);
router.get('/smart-recommendations', protect, requireActiveSubscription('aiRecommendations'), bookController.getSmartRecommendations);
router.get('/lookup', protect, restrictTo('LIBRARIAN', 'ADMIN'), bookController.lookupByISBN);
router.get('/:bookId', bookController.getBook);
router.get('/:bookId/availability', protect, bookController.checkAvailability);
router.get('/:bookId/reviews', bookController.getBookReviews);

// Protected routes (Librarian/Admin only)
router.post('/', protect, restrictTo('LIBRARIAN', 'ADMIN'), validate(createBookSchema), bookController.createBook);
router.put('/:bookId', protect, restrictTo('LIBRARIAN', 'ADMIN'), validate(updateBookSchema), bookController.updateBook);
router.delete('/:bookId', protect, restrictTo('ADMIN'), bookController.deleteBook);

module.exports = router;
