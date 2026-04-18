/**
 * PENALTY SERVICE STUB
 * ---------------------------------------------------------
 * Prototype mode - no MySQL. Validates incoming data and
 * logs what WOULD be written to the penalties table.
 * Swap this file with penaltyService.js when MySQL is ready.
 * ---------------------------------------------------------
 */

const mongoose = require('mongoose');
const { calculateFine } = require('../utils/fineCalculator');

const VALID_FINE_STATUSES = ['NONE', 'PENDING', 'PAID', 'WAIVED'];

/**
 * Validates that a value is a valid MongoDB ObjectId string
 */
function validateObjectId(value, fieldName) {
  if (!value || typeof value !== 'string') {
    throw new Error(`STUB VALIDATION: ${fieldName} is required and must be a string`);
  }
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`STUB VALIDATION: ${fieldName} "${value}" is not a valid MongoDB ObjectId`);
  }
}

/**
 * Validates a date value (Date object or ISO string)
 */
function validateDate(value, fieldName) {
  if (!value) {
    throw new Error(`STUB VALIDATION: ${fieldName} is required`);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`STUB VALIDATION: ${fieldName} "${value}" is not a valid date`);
  }
}

// ─────────────────────────────────────────────
// STUB: createPenalty
// ─────────────────────────────────────────────
exports.createPenalty = async (issueId, dueDate) => {
  validateObjectId(issueId, 'issueId');
  validateDate(dueDate, 'dueDate');

  console.log('\n[PENALTY STUB] ✅ Validation passed. Would INSERT into penalties:');
  console.table({
    issue_id: issueId,
    due_date: new Date(dueDate).toISOString().split('T')[0],
    fine_status: 'NONE',
    fine_amount: 0.00,
    overdue_days: 0
  });

  return {
    stub: true,
    issue_id: issueId,
    due_date: dueDate,
    fine_status: 'NONE',
    fine_amount: 0,
    overdue_days: 0,
    message: 'STUB: Penalty record would be created in MySQL'
  };
};

// ─────────────────────────────────────────────
// STUB: calculatePenalty
// ─────────────────────────────────────────────
exports.calculatePenalty = async (issueId) => {
  validateObjectId(issueId, 'issueId');

  // Simulate fetching a penalty and calculating fine
  const mockDueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
  const { overdueDays, fineAmount } = calculateFine(mockDueDate);

  console.log('\n[PENALTY STUB] ✅ Validation passed. Fine calculated:');
  console.table({
    issue_id: issueId,
    overdue_days: overdueDays,
    fine_amount: fineAmount,
    fine_status: fineAmount > 0 ? 'PENDING' : 'NONE'
  });
  console.log('[PENALTY STUB] Would UPDATE penalties SET overdue_days, fine_amount, fine_status WHERE issue_id =', issueId);

  return {
    stub: true,
    issue_id: issueId,
    overdue_days: overdueDays,
    fine_amount: fineAmount,
    fine_status: fineAmount > 0 ? 'PENDING' : 'NONE',
    message: 'STUB: Penalty fine calculation would be saved to MySQL'
  };
};

// ─────────────────────────────────────────────
// STUB: markPenaltyAsPaid
// ─────────────────────────────────────────────
exports.markPenaltyAsPaid = async (issueId, returnDate) => {
  validateObjectId(issueId, 'issueId');
  validateDate(returnDate, 'returnDate');

  console.log('\n[PENALTY STUB] ✅ Validation passed. Would UPDATE penalties:');
  console.table({
    issue_id: issueId,
    fine_status: 'PAID',
    return_date: new Date(returnDate).toISOString().split('T')[0],
    paid_at: new Date().toISOString()
  });

  return {
    stub: true,
    issue_id: issueId,
    fine_status: 'PAID',
    return_date: returnDate,
    message: 'STUB: Penalty marked as paid in MySQL'
  };
};

// ─────────────────────────────────────────────
// STUB: getPenaltyByIssueId
// ─────────────────────────────────────────────
exports.getPenaltyByIssueId = async (issueId) => {
  validateObjectId(issueId, 'issueId');
  console.log(`\n[PENALTY STUB] Would SELECT * FROM penalties WHERE issue_id = "${issueId}"`);
  return null; // No record in stub mode
};

// ─────────────────────────────────────────────
// STUB: getPenaltiesByIssueIds
// ─────────────────────────────────────────────
exports.getPenaltiesByIssueIds = async (issueIds, status = null) => {
  if (!Array.isArray(issueIds)) {
    throw new Error('STUB VALIDATION: issueIds must be an array');
  }
  issueIds.forEach((id, i) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`STUB VALIDATION: issueIds[${i}] = "${id}" is not a valid MongoDB ObjectId`);
    }
  });
  if (status && !VALID_FINE_STATUSES.includes(status)) {
    throw new Error(`STUB VALIDATION: invalid fine_status "${status}". Must be one of: ${VALID_FINE_STATUSES.join(', ')}`);
  }

  console.log(`\n[PENALTY STUB] Would SELECT * FROM penalties WHERE issue_id IN (${issueIds.join(', ')})`);
  if (status) console.log(`[PENALTY STUB] AND fine_status = "${status}"`);
  return [];
};

// ─────────────────────────────────────────────
// STUB: getTotalPendingFinesByIssueIds
// ─────────────────────────────────────────────
exports.getTotalPendingFinesByIssueIds = async (issueIds) => {
  if (!Array.isArray(issueIds)) {
    throw new Error('STUB VALIDATION: issueIds must be an array');
  }
  issueIds.forEach((id, i) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`STUB VALIDATION: issueIds[${i}] = "${id}" is not a valid MongoDB ObjectId`);
    }
  });

  console.log(`\n[PENALTY STUB] Would SELECT SUM(fine_amount) FROM penalties WHERE issue_id IN (${issueIds.join(', ')}) AND fine_status = 'PENDING'`);
  return 0;
};

// ─────────────────────────────────────────────
// STUB: processOverduePenalties
// ─────────────────────────────────────────────
exports.processOverduePenalties = async () => {
  console.log('\n[PENALTY STUB] Would run daily overdue processing cron job.');
  console.log('[PENALTY STUB] In production: queries MongoDB for OVERDUE issues, inserts/updates penalties in MySQL.');
  return {
    stub: true,
    processed: 0,
    penalties: [],
    message: 'STUB: No MySQL - overdue processing skipped'
  };
};
