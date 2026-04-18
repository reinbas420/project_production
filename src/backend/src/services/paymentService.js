const { getPool } = require('../config/mysql');
const AppError = require('../utils/AppError');
const crypto = require('crypto');

/**
 * Create payment record
 */
exports.createPayment = async (paymentData) => {
  const { issueId, amount, paymentType = 'OTHER', paymentMethod = 'CASH', notes = null } = paymentData;
  
  const transactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  const pool = getPool();
  const query = `
    INSERT INTO payments (transaction_id, issue_id, payment_amount, payment_type, payment_method, payment_status, notes)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
  `;
  
  const [result] = await pool.execute(query, [
    transactionId, 
    issueId, 
    amount, 
    paymentType, 
    paymentMethod,
    notes
  ]);
  
  return {
    transactionId,
    issueId,
    amount,
    paymentType,
    paymentMethod,
    status: 'PENDING'
  };
};

/**
 * Update payment status
 */
exports.updatePaymentStatus = async (transactionId, paymentDetails) => {
  const { status, notes = null } = paymentDetails;
  
  const pool = getPool();
  const query = `
    UPDATE payments 
    SET payment_status = ?,
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE transaction_id = ?
  `;
  
  const [result] = await pool.execute(query, [
    status,
    notes,
    transactionId
  ]);
  
  if (result.affectedRows === 0) {
    throw new AppError('Payment record not found', 404);
  }
  
  return await this.getPaymentByTransactionId(transactionId);
};

/**
 * Get payment by transaction ID
 */
exports.getPaymentByTransactionId = async (transactionId) => {
  const pool = getPool();
  const query = 'SELECT * FROM payments WHERE transaction_id = ?';
  
  const [rows] = await pool.execute(query, [transactionId]);
  
  if (rows.length === 0) {
    throw new AppError('Payment not found', 404);
  }
  
  return rows[0];
};

/**
 * Get payments by issue IDs
 * Since payments table no longer has user_id, 
 * caller must provide issue IDs from MongoDB Issues collection
 */
exports.getPaymentsByIssueIds = async (issueIds) => {
  if (!issueIds || issueIds.length === 0) {
    return [];
  }
  
  const pool = getPool();
  const placeholders = issueIds.map(() => '?').join(',');
  const query = `
    SELECT * FROM payments 
    WHERE issue_id IN (${placeholders})
    ORDER BY created_at DESC
  `;
  
  const [rows] = await pool.execute(query, issueIds);
  return rows;
};

/**
 * Get payment by issue ID
 */
exports.getPaymentByIssueId = async (issueId) => {
  const pool = getPool();
  const query = 'SELECT * FROM payments WHERE issue_id = ?';
  
  const [rows] = await pool.execute(query, [issueId]);
  
  if (rows.length === 0) {
    return null;
  }
  
  return rows[0];
};

/**
 * Create transaction log
 */
exports.logTransaction = async (logData) => {
  const { transactionId, userId, action, details, ipAddress, userAgent = null } = logData;
  
  const pool = getPool();
  const query = `
    INSERT INTO transaction_logs (transaction_id, user_id, action, details, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  // Details can be a string or object - ensure it's a string for TEXT column
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
  
  await pool.execute(query, [
    transactionId,
    userId,
    action,
    detailsStr,
    ipAddress,
    userAgent
  ]);
};
