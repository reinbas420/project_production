const express = require('express');
const Joi = require('joi');
const cartController = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const addToCartSchema = Joi.object({
  book_id: Joi.string().required(),
  library_id: Joi.string().required(),
  force_replace: Joi.boolean().default(false),
});

const updateQuantitySchema = Joi.object({
  book_id: Joi.string().required(),
  operation: Joi.string().valid('increment', 'decrement').required(),
});

router.use(protect);

// Get current cart
router.get('/', cartController.getCart);

// Add item to cart with single-library enforcement
router.post('/items', validate(addToCartSchema), cartController.addToCart);

// Increase/decrease item quantity in cart
router.patch('/items/quantity', validate(updateQuantitySchema), cartController.updateCartItemQuantity);

// Clear entire cart
router.delete('/', cartController.clearCart);

module.exports = router;
