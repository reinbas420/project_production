/**
 * PAYMENT SERVICE STUB
 * ---------------------------------------------------------
 * Prototype mode - no MySQL. Validates incoming data and
 * logs what WOULD be written to the payments table.
 * Swap this file with paymentService.js when MySQL is ready.
 * ---------------------------------------------------------
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

// Valid enum values mirroring the MySQL schema
const VALID_PAYMENT_TYPES = ['ISSUE_FEE', 'PENALTY', 'DAMAGE', 'LOST_BOOK', 'OTHER'];
const VALID_PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'NET_BANKING', 'OTHER'];
const VALID_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];

/**
 * Validates that issueId is a valid MongoDB ObjectId string
 */
function validateIssueId(issueId) {
  if (!issueId || typeof issueId !== 'string') {
    throw new Error('STUB VALIDATION: issueId is required and must be a string');
  }
  if (!mongoose.Types.ObjectId.isValid(issueId)) {
    throw new Error(`STUB VALIDATION: issueId "${issueId}" is not a valid MongoDB ObjectId`);
  }
}

/**
 * Validates payment amount is a positive number
 */
function validateAmount(amount) {
  if (amount === undefined || amount === null) {
    throw new Error('STUB VALIDATION: amount is required');
  }
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error(`STUB VALIDATION: amount must be a number, got "${typeof amount}"`);
  }
  if (amount < 0) {
    throw new Error(`STUB VALIDATION: amount must be >= 0, got ${amount}`);
  }
}

// ─────────────────────────────────────────────
// STUB: createPayment
// ─────────────────────────────────────────────
exports.createPayment = async (paymentData) => {
  const {
    issueId,
    amount,
    paymentType = 'OTHER',
    paymentMethod = 'CASH',
    notes = null
  } = paymentData;

  // --- Validate ---
  validateIssueId(issueId);
  validateAmount(amount);

  if (!VALID_PAYMENT_TYPES.includes(paymentType)) {
    throw new Error(`STUB VALIDATION: invalid paymentType "${paymentType}". Must be one of: ${VALID_PAYMENT_TYPES.join(', ')}`);
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error(`STUB VALIDATION: invalid paymentMethod "${paymentMethod}". Must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`);
  }

  const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // --- Log what WOULD be inserted ---
  console.log('\n[PAYMENT STUB] ✅ Validation passed. Would INSERT into payments:');
  console.table({
    transaction_id: transactionId,
    issue_id: issueId,
    payment_amount: amount,
    payment_type: paymentType,
    payment_method: paymentMethod,
    payment_status: 'PENDING',
    notes: notes || '(none)'
  });

  return {
    stub: true,
    transactionId,
    issueId,
    amount,
    paymentType,
    paymentMethod,
    status: 'PENDING',
    message: 'STUB: Payment record would be created in MySQL'
  };
};

// ─────────────────────────────────────────────
// STUB: updatePaymentStatus
// ─────────────────────────────────────────────
exports.updatePaymentStatus = async (transactionId, paymentDetails) => {
  const { status, notes = null } = paymentDetails;

  if (!transactionId || typeof transactionId !== 'string') {
    throw new Error('STUB VALIDATION: transactionId is required');
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`STUB VALIDATION: invalid status "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  console.log('\n[PAYMENT STUB] ✅ Validation passed. Would UPDATE payments SET:');
  console.table({
    transaction_id: transactionId,
    payment_status: status,
    notes: notes || '(unchanged)'
  });

  return {
    stub: true,
    transactionId,
    payment_status: status,
    message: 'STUB: Payment status would be updated in MySQL'
  };
};

// ─────────────────────────────────────────────
// STUB: getPaymentByTransactionId
// ─────────────────────────────────────────────
exports.getPaymentByTransactionId = async (transactionId) => {
  console.log(`\n[PAYMENT STUB] Would SELECT * FROM payments WHERE transaction_id = "${transactionId}"`);
  return {
    stub: true,
    transaction_id: transactionId,
    message: 'STUB: Would query MySQL for this transaction'
  };
};

// ─────────────────────────────────────────────
// STUB: getPaymentsByIssueIds
// ─────────────────────────────────────────────
exports.getPaymentsByIssueIds = async (issueIds) => {
  if (!Array.isArray(issueIds)) {
    throw new Error('STUB VALIDATION: issueIds must be an array');
  }
  // Validate each ID
  issueIds.forEach((id, i) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`STUB VALIDATION: issueIds[${i}] = "${id}" is not a valid MongoDB ObjectId`);
    }
  });

  console.log(`\n[PAYMENT STUB] Would SELECT * FROM payments WHERE issue_id IN (${issueIds.join(', ')})`);
  return [];
};

// ─────────────────────────────────────────────
// STUB: getPaymentByIssueId
// ─────────────────────────────────────────────
exports.getPaymentByIssueId = async (issueId) => {
  validateIssueId(issueId);
  console.log(`\n[PAYMENT STUB] Would SELECT * FROM payments WHERE issue_id = "${issueId}"`);
  return null;
};

// ─────────────────────────────────────────────
// STUB: logTransaction
// ─────────────────────────────────────────────
exports.logTransaction = async (logData) => {
  const { transactionId, userId, action, details, ipAddress, userAgent = null } = logData;

  // Validate required fields
  if (!userId || typeof userId !== 'string') {
    throw new Error('STUB VALIDATION: userId is required for transaction log');
  }
  if (!action || typeof action !== 'string') {
    throw new Error('STUB VALIDATION: action is required for transaction log');
  }

  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

  console.log('\n[PAYMENT STUB] ✅ Validation passed. Would INSERT into transaction_logs:');
  console.table({
    transaction_id: transactionId || '(none)',
    user_id: userId,
    action,
    details: detailsStr?.substring(0, 80) + (detailsStr?.length > 80 ? '...' : ''),
    ip_address: ipAddress || '(none)',
    user_agent: userAgent || '(none)'
  });
};
