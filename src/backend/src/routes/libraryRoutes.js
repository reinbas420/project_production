const express = require('express');
const libraryController = require('../controllers/libraryController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createLibrarySchema = Joi.object({
  organizationId: Joi.string().optional(),
  name: Joi.string().required(),
  address: Joi.string().required(),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required()
  }).optional(),
  librarian: Joi.string().optional(),
  serviceRadiusKm: Joi.number().positive().default(8)
});

const updateLibrarySchema = Joi.object({
  name: Joi.string(),
  address: Joi.string(),
  location: Joi.object({
    type: Joi.string().valid('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2)
  }),
  librarian: Joi.string(),
  serviceRadiusKm: Joi.number().positive(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE')
});

// Public routes
router.get('/', libraryController.getAllLibraries);
router.get('/nearby', libraryController.getNearbyLibraries);
router.get('/:libraryId', libraryController.getLibrary);

// Admin only routes
router.post('/', protect, restrictTo('ADMIN'), validate(createLibrarySchema), libraryController.createLibrary);
router.put('/:libraryId', protect, restrictTo('ADMIN'), validate(updateLibrarySchema), libraryController.updateLibrary);

module.exports = router;
