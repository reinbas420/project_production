const express = require('express');
const penaltyController = require('../controllers/penaltyController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/users/:userId/penalties', penaltyController.getUserPenalties);
router.get('/users/:userId/fines/total', penaltyController.getTotalPendingFines);
router.get('/issue/:issueId', penaltyController.getPenaltyByIssue);
router.put('/:issueId/pay', penaltyController.payPenalty);

// Admin only - process overdue penalties
router.post(
  '/process-overdue',
  restrictTo('ADMIN'),
  penaltyController.processOverduePenalties
);

module.exports = router;
