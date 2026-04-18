const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createPaymentSchema = Joi.object({
  issueId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  paymentType: Joi.string().valid('ISSUE_FEE', 'PENALTY', 'DAMAGE', 'LOST_BOOK', 'OTHER').default('OTHER'),
  paymentMethod: Joi.string().valid('CASH', 'UPI', 'CARD', 'NET_BANKING', 'OTHER').default('CASH'),
  notes: Joi.string().max(500).optional()
});

const updatePaymentSchema = Joi.object({
  status: Joi.string().valid('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED').required(),
  notes: Joi.string().max(500).optional()
});

// All routes require authentication
router.use(protect);

router.post('/', validate(createPaymentSchema), paymentController.createPayment);
router.put('/:transactionId', validate(updatePaymentSchema), paymentController.updatePaymentStatus);
router.get('/:transactionId', paymentController.getPayment);
router.get('/users/:userId/payments', paymentController.getUserPayments);

module.exports = router;
