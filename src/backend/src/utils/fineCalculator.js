const config = require('../config');

/**
 * Calculate fine for overdue book
 * @param {Date} dueDate 
 * @param {Date} returnDate 
 * @returns {Object} { overdueDays, fineAmount }
 */
function calculateFine(dueDate, returnDate = new Date()) {
  const due = new Date(dueDate);
  const returned = new Date(returnDate);
  
  // Calculate days difference
  const timeDiff = returned - due;
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  // Apply grace period
  const overdueDays = Math.max(0, daysDiff - config.business.gracePeriodDays);
  
  // Calculate fine
  const fineAmount = overdueDays * config.business.lateFeePerDay;
  
  return {
    overdueDays,
    fineAmount: Math.max(0, fineAmount)
  };
}

/**
 * Calculate due date from issue date
 * @param {Date} issueDate 
 * @returns {Date}
 */
function calculateDueDate(issueDate = new Date()) {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + config.business.defaultBorrowPeriodDays);
  return dueDate;
}

/**
 * Check if book is overdue
 * @param {Date} dueDate 
 * @returns {Boolean}
 */
function isOverdue(dueDate) {
  return new Date() > new Date(dueDate);
}

module.exports = {
  calculateFine,
  calculateDueDate,
  isOverdue
};
