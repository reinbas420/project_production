const { getPool } = require('../config/mysql');
const { calculateFine } = require('../utils/fineCalculator');
const circulationService = require('./circulationService');
const AppError = require('../utils/AppError');

/**
 * Create penalty record for overdue book
 */
exports.createPenalty = async (issueId, dueDate) => {
  const pool = getPool();
  
  const query = `
    INSERT INTO penalties (issue_id, due_date, fine_status)
    VALUES (?, ?, 'NONE')
    ON DUPLICATE KEY UPDATE issue_id = issue_id
  `;
  
  await pool.execute(query, [issueId, dueDate]);
  
  return await this.getPenaltyByIssueId(issueId);
};

/**
 * Calculate and update penalty for overdue book
 */
exports.calculatePenalty = async (issueId) => {
  const pool = getPool();
  
  // Get penalty record
  const penalty = await this.getPenaltyByIssueId(issueId);
  
  if (!penalty) {
    throw new AppError('Penalty record not found', 404);
  }
  
  // Calculate fine
  const { overdueDays, fineAmount } = calculateFine(penalty.due_date);
  
  // Update penalty record
  const query = `
    UPDATE penalties 
    SET overdue_days = ?,
        fine_amount = ?,
        fine_status = CASE 
          WHEN ? > 0 THEN 'PENDING'
          ELSE 'NONE'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE issue_id = ?
  `;
  
  await pool.execute(query, [overdueDays, fineAmount, fineAmount, issueId]);
  
  return await this.getPenaltyByIssueId(issueId);
};

/**
 * Mark penalty as paid
 */
exports.markPenaltyAsPaid = async (issueId, returnDate) => {
  const pool = getPool();
  
  const query = `
    UPDATE penalties 
    SET fine_status = 'PAID',
        return_date = ?,
        paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE issue_id = ? AND fine_status = 'PENDING'
  `;
  
  const [result] = await pool.execute(query, [returnDate, issueId]);
  
  if (result.affectedRows === 0) {
    throw new AppError('Penalty record not found or already paid', 404);
  }
  
  return await this.getPenaltyByIssueId(issueId);
};

/**
 * Get penalty by issue ID
 */
exports.getPenaltyByIssueId = async (issueId) => {
  const pool = getPool();
  const query = 'SELECT * FROM penalties WHERE issue_id = ?';
  
  const [rows] = await pool.execute(query, [issueId]);
  
  if (rows.length === 0) {
    return null;
  }
  
  return rows[0];
};

/**
 * Get penalties by issue IDs
 * Since penalties table no longer has user_id,
 * caller must provide issue IDs from MongoDB Issues collection
 */
exports.getPenaltiesByIssueIds = async (issueIds, status = null) => {
  if (!issueIds || issueIds.length === 0) {
    return [];
  }
  
  const pool = getPool();
  const placeholders = issueIds.map(() => '?').join(',');
  
  let query = `SELECT * FROM penalties WHERE issue_id IN (${placeholders})`;
  const params = [...issueIds];
  
  if (status) {
    query += ' AND fine_status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const [rows] = await pool.execute(query, params);
  return rows;
};

/**
 * Process overdue penalties (Cron Job)
 * This should run daily
 */
exports.processOverduePenalties = async () => {
  // Get all overdue issues
  const overdueIssues = await circulationService.getOverdueIssues();
  
  const processedPenalties = [];
  
  for (const issue of overdueIssues) {
    try {
      // Create penalty record if doesn't exist
      let penalty = await this.getPenaltyByIssueId(issue._id.toString());
      
      if (!penalty) {
        penalty = await this.createPenalty(
          issue._id.toString(),
          issue.dueDate
        );
      }
      
      // Calculate and update fine
      const updatedPenalty = await this.calculatePenalty(issue._id.toString());
      processedPenalties.push(updatedPenalty);
      
    } catch (error) {
      console.error(`Error processing penalty for issue ${issue._id}:`, error.message);
    }
  }
  
  return {
    processed: processedPenalties.length,
    penalties: processedPenalties
  };
};

/**
 * Get total pending fines by issue IDs
 * Since penalties table no longer has user_id,
 * caller must provide issue IDs from MongoDB Issues collection
 */
exports.getTotalPendingFinesByIssueIds = async (issueIds) => {
  if (!issueIds || issueIds.length === 0) {
    return 0;
  }
  
  const pool = getPool();
  const placeholders = issueIds.map(() => '?').join(',');
  
  const query = `
    SELECT SUM(fine_amount) as total_pending
    FROM penalties 
    WHERE issue_id IN (${placeholders}) AND fine_status = 'PENDING'
  `;
  
  const [rows] = await pool.execute(query, issueIds);
  
  return rows[0].total_pending || 0;
};
