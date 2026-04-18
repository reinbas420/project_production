// Use real MySQL-backed service when MYSQL_READY=true, otherwise use in-memory stub
const paymentService = process.env.MYSQL_READY === 'true'
  ? require('../services/paymentService')
  : require('../services/paymentService.stub');
const Issue = require('../models/Issue');
const catchAsync = require('../utils/catchAsync');

/**
 * Create payment
 * POST /payments
 */
exports.createPayment = catchAsync(async (req, res) => {
  const paymentData = {
    issueId: req.body.issueId,
    amount: req.body.amount,
    paymentType: req.body.paymentType || 'OTHER',
    paymentMethod: req.body.paymentMethod || 'CASH',
    notes: req.body.notes
  };
  
  const payment = await paymentService.createPayment(paymentData);
  
  // Log transaction
  await paymentService.logTransaction({
    transactionId: payment.transactionId,
    userId: req.user._id.toString(),
    action: 'PAYMENT_INITIATED',
    details: JSON.stringify(paymentData),
    ipAddress: req.ip
  });
  
  res.status(201).json({
    status: 'success',
    data: { payment }
  });
});

/**
 * Update payment status
 * PUT /payments/:transactionId
 */
exports.updatePaymentStatus = catchAsync(async (req, res) => {
  const { transactionId } = req.params;
  const paymentDetails = req.body;
  
  const payment = await paymentService.updatePaymentStatus(transactionId, paymentDetails);
  
  // Log transaction
  await paymentService.logTransaction({
    transactionId,
    userId: req.user._id.toString(),
    action: `PAYMENT_${paymentDetails.status}`,
    details: JSON.stringify(paymentDetails),
    ipAddress: req.ip
  });
  
  res.status(200).json({
    status: 'success',
    data: { payment }
  });
});

/**
 * Get user payments
 * GET /users/:userId/payments
 */
exports.getUserPayments = catchAsync(async (req, res) => {
  // First, get all issues for this user from MongoDB
  const issues = await Issue.find({ userId: req.params.userId }).select('_id');
  const issueIds = issues.map(issue => issue._id.toString());
  
  // Then get payments for those issues from MySQL
  const payments = await paymentService.getPaymentsByIssueIds(issueIds);
  
  res.status(200).json({
    status: 'success',
    results: payments.length,
    data: { payments }
  });
});

/**
 * Get payment details
 * GET /payments/:transactionId
 */
exports.getPayment = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentByTransactionId(req.params.transactionId);
  
  res.status(200).json({
    status: 'success',
    data: { payment }
  });
});
