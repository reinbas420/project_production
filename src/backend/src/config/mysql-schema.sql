-- MySQL Database Schema for Library Transactions
-- Aligned with MongoDB Design Document - Version 1
-- MySQL stores ONLY: Payments, Penalties, and Transaction Logs
-- All other entities (Users, Books, Issues, etc.) are in MongoDB

-- Create database
CREATE DATABASE IF NOT EXISTS library_transactions;
USE library_transactions;

-- ============================================================================
-- CORE TRANSACTION TABLES
-- ============================================================================

-- 1. Payments Table
-- Matches MongoDB spec: Section 4.1
-- Stores all payment transactions related to book issues
CREATE TABLE IF NOT EXISTS payments (
    transaction_id VARCHAR(255) PRIMARY KEY COMMENT 'Unique transaction identifier',
    issue_id VARCHAR(255) NOT NULL COMMENT 'References Issues collection in MongoDB',
    payment_amount DECIMAL(10, 2) NOT NULL CHECK (payment_amount >= 0),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_type ENUM(
        'ISSUE_FEE',    -- Fee paid when borrowing a book
        'PENALTY',      -- Payment for overdue fines
        'DAMAGE',       -- Fee for damaged book
        'LOST_BOOK',    -- Fee for lost book
        'OTHER'         -- Miscellaneous payments
    ) NOT NULL DEFAULT 'OTHER',
    payment_method ENUM('CASH', 'UPI', 'CARD', 'NET_BANKING', 'OTHER') DEFAULT 'CASH',
    payment_status ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED') DEFAULT 'PENDING',
    notes TEXT NULL COMMENT 'Additional payment notes or remarks',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_issue_id (issue_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_payment_status (payment_status),
    INDEX idx_payment_type (payment_type)
) ENGINE=InnoDB COMMENT='Payment transactions - matches MongoDB spec Section 4.1';

-- 2. Penalties Table
-- Matches MongoDB spec: Section 4.2
-- Stores fine information for overdue books
-- Denormalizes dueDate and returnDate from MongoDB for fast query performance
CREATE TABLE IF NOT EXISTS penalties (
    penalty_id INT AUTO_INCREMENT PRIMARY KEY,
    issue_id VARCHAR(255) NOT NULL UNIQUE COMMENT 'References Issues collection in MongoDB',
    due_date DATE NOT NULL COMMENT 'Denormalized from MongoDB Issues for performance',
    return_date DATE NULL COMMENT 'Denormalized from MongoDB Issues for performance',
    overdue_days INT DEFAULT 0 CHECK (overdue_days >= 0),
    fine_amount DECIMAL(10, 2) DEFAULT 0.00 CHECK (fine_amount >= 0),
    fine_status ENUM('NONE', 'PENDING', 'PAID', 'WAIVED') DEFAULT 'NONE',
    waiver_reason VARCHAR(255) NULL COMMENT 'Reason if fine was waived',
    waived_by VARCHAR(255) NULL COMMENT 'Admin/Librarian who waived the fine',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_issue_id (issue_id),
    INDEX idx_fine_status (fine_status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB COMMENT='Penalty tracking - matches MongoDB spec Section 4.2';

-- 3. Transaction Logs Table
-- Audit trail for all financial transactions
-- Provides immutable record of all payment and penalty activities
CREATE TABLE IF NOT EXISTS transaction_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(255) NULL COMMENT 'Payment transaction_id if applicable',
    user_id VARCHAR(255) NOT NULL COMMENT 'References Users collection in MongoDB',
    action VARCHAR(100) NOT NULL COMMENT 'Action performed (e.g., PAYMENT_CREATED, PENALTY_PAID)',
    details TEXT NULL COMMENT 'Human-readable description of the action',
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_action (action)
) ENGINE=InnoDB COMMENT='Audit trail for all transactions';

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Pending Penalties
-- Shows all penalties that are still unpaid
CREATE OR REPLACE VIEW v_pending_penalties AS
SELECT 
    penalty_id,
    issue_id,
    due_date,
    return_date,
    overdue_days,
    fine_amount,
    fine_status,
    DATEDIFF(COALESCE(return_date, CURDATE()), due_date) AS days_overdue
FROM penalties
WHERE fine_status = 'PENDING'
ORDER BY due_date ASC;

-- View: Payment Summary by Issue
-- Aggregates all payments related to each issue
CREATE OR REPLACE VIEW v_issue_payment_summary AS
SELECT 
    issue_id,
    COUNT(*) AS total_payments,
    SUM(CASE WHEN payment_status = 'SUCCESS' THEN payment_amount ELSE 0 END) AS total_paid,
    SUM(CASE WHEN payment_status = 'PENDING' THEN payment_amount ELSE 0 END) AS total_pending,
    SUM(CASE WHEN payment_status = 'FAILED' THEN payment_amount ELSE 0 END) AS total_failed,
    MAX(payment_date) AS last_payment_date
FROM payments
GROUP BY issue_id;

-- View: Complete Financial Record per Issue
-- Joins payments and penalties for a complete financial picture
CREATE OR REPLACE VIEW v_issue_financial_details AS
SELECT 
    p.issue_id,
    SUM(CASE WHEN p.payment_status = 'SUCCESS' THEN p.payment_amount ELSE 0 END) AS total_payments,
    COALESCE(pen.fine_amount, 0) AS penalty_amount,
    COALESCE(pen.fine_status, 'NONE') AS penalty_status,
    pen.due_date,
    pen.return_date,
    pen.overdue_days
FROM payments p
LEFT JOIN penalties pen ON p.issue_id = pen.issue_id
GROUP BY p.issue_id, pen.fine_amount, pen.fine_status, pen.due_date, pen.return_date, pen.overdue_days;
