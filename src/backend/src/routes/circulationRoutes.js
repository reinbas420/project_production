const express = require('express');
const circulationController = require('../controllers/circulationController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const issueBookSchema = Joi.object({
  profileId: Joi.string().required(),
  bookId: Joi.string().required(),
  branchId: Joi.string().required(),
  type: Joi.string().valid('PHYSICAL', 'DIGITAL').default('PHYSICAL')
});

// All routes require authentication
router.use(protect);

// Issue and return books
router.post('/', validate(issueBookSchema), circulationController.issueBook);
router.get('/', restrictTo('LIBRARIAN', 'ADMIN'), circulationController.getAllIssues);
router.put('/:issueId/return', circulationController.returnBook);
router.get('/:issueId', circulationController.getIssue);

// Get user issues
router.get('/users/:userId/issues', circulationController.getUserIssues);

// Book history (Librarian/Admin only)
router.get(
  '/books/:bookId/history',
  restrictTo('LIBRARIAN', 'ADMIN'),
  circulationController.getBookHistory
);

module.exports = router;
