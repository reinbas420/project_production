// Use real MySQL-backed service when MYSQL_READY=true, otherwise use in-memory stub
const penaltyService = process.env.MYSQL_READY === 'true'
  ? require('../services/penaltyService')
  : require('../services/penaltyService.stub');
const Issue = require('../models/Issue');
const catchAsync = require('../utils/catchAsync');

/**
 * Get user penalties
 * GET /users/:userId/penalties
 */
exports.getUserPenalties = catchAsync(async (req, res) => {
  const { status } = req.query;
  
  // First, get all issues for this user from MongoDB
  const issues = await Issue.find({ userId: req.params.userId }).select('_id');
  const issueIds = issues.map(issue => issue._id.toString());
  
  // Then get penalties for those issues from MySQL
  const penalties = await penaltyService.getPenaltiesByIssueIds(issueIds, status);
  
  res.status(200).json({
    status: 'success',
    results: penalties.length,
    data: { penalties }
  });
});

/**
 * Get penalty by issue ID
 * GET /penalties/issue/:issueId
 */
exports.getPenaltyByIssue = catchAsync(async (req, res) => {
  const penalty = await penaltyService.getPenaltyByIssueId(req.params.issueId);
  
  res.status(200).json({
    status: 'success',
    data: { penalty }
  });
});

/**
 * Mark penalty as paid
 * PUT /penalties/:issueId/pay
 */
exports.payPenalty = catchAsync(async (req, res) => {
  const penalty = await penaltyService.markPenaltyAsPaid(
    req.params.issueId,
    new Date()
  );
  
  res.status(200).json({
    status: 'success',
    data: { penalty }
  });
});

/**
 * Get user total pending fines
 * GET /users/:userId/fines/total
 */
exports.getTotalPendingFines = catchAsync(async (req, res) => {
  // First, get all issues for this user from MongoDB
  const issues = await Issue.find({ userId: req.params.userId }).select('_id');
  const issueIds = issues.map(issue => issue._id.toString());
  
  // Then get total pending fines for those issues from MySQL
  const total = await penaltyService.getTotalPendingFinesByIssueIds(issueIds);
  
  res.status(200).json({
    status: 'success',
    data: { totalPendingFines: total }
  });
});

/**
 * Process overdue penalties (Admin/Cron only)
 * POST /penalties/process-overdue
 */
exports.processOverduePenalties = catchAsync(async (req, res) => {
  const result = await penaltyService.processOverduePenalties();
  
  res.status(200).json({
    status: 'success',
    data: result
  });
});
