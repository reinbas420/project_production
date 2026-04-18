/**
 * Integration tests for Apply Fines / Overdue Detection
 * Tests the fine calculation logic and overdue issue detection.
 *
 * Since fines are calculated via a CRON job (getOverdueIssues) and the
 * fineCalculator utility, we test:
 *   1. The fineCalculator directly (unit-style within integration context)
 *   2. The overdue detection service
 *   3. Returning an overdue book auto-detects overdue status
 */

const request = require('supertest');
const app = require('../../src/app');
const Issue = require('../../src/models/Issue');
const BookCopy = require('../../src/models/BookCopy');
const User = require('../../src/models/User');
const { calculateFine, calculateDueDate, isOverdue } = require('../../src/utils/fineCalculator');
const circulationService = require('../../src/services/circulationService');

const {
    registerAndLogin,
    createTestBook,
    createTestBranch,
    createTestOrganization,
    createTestIssue
} = require('../utils/testHelpers');

describe('Apply Fines & Overdue Detection', () => {

    // ── Fine Calculator (unit tests in integration context) ─────
    describe('fineCalculator utility', () => {
        test('should return 0 fine for on-time return', () => {
            const dueDate = new Date('2025-06-15');
            const returnDate = new Date('2025-06-14'); // 1 day early

            const result = calculateFine(dueDate, returnDate);
            expect(result.overdueDays).toBe(0);
            expect(result.fineAmount).toBe(0);
        });

        test('should calculate fine for overdue return', () => {
            const dueDate = new Date('2025-06-01');
            const returnDate = new Date('2025-06-20'); // 19 days late

            const result = calculateFine(dueDate, returnDate);
            expect(result.overdueDays).toBeGreaterThan(0);
            expect(result.fineAmount).toBeGreaterThan(0);
        });

        test('should return 0 fine when returned on due date', () => {
            const dueDate = new Date('2025-06-15');
            const returnDate = new Date('2025-06-15');

            const result = calculateFine(dueDate, returnDate);
            expect(result.fineAmount).toBe(0);
        });

        test('should calculate due date as 14 days from issue date', () => {
            const issueDate = new Date('2025-06-01');
            const dueDate = calculateDueDate(issueDate);
            const diffDays = Math.round((dueDate - issueDate) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(14);
        });

        test('isOverdue — should return true for past due dates', () => {
            const pastDate = new Date('2020-01-01');
            expect(isOverdue(pastDate)).toBe(true);
        });

        test('isOverdue — should return false for future due dates', () => {
            const futureDate = new Date('2099-12-31');
            expect(isOverdue(futureDate)).toBe(false);
        });
    });

    // ── Overdue Detection Service ───────────────────────
    describe('Overdue Detection (circulationService)', () => {
        let userId, book, branch, org;

        beforeEach(async () => {
            const user = await registerAndLogin('USER');
            userId = user.userId;

            org = await createTestOrganization();
            branch = await createTestBranch(org._id.toString());
            book = await createTestBook();
        });

        test('should detect overdue issues', async () => {
            const copy = await BookCopy.create({
                bookId: book._id,
                branchId: branch._id,
                barcode: `OD-${Date.now()}`,
                status: 'ISSUED',
                condition: 'GOOD'
            });

            // Create an issue with a past due date
            await Issue.create({
                userId,
                copyId: copy._id,
                profileId: (await User.findById(userId)).profiles[0].profileId,
                issueDate: new Date('2025-01-01'),
                dueDate: new Date('2025-01-15'), // Way past due
                status: 'ISSUED'
            });

            const overdueIssues = await circulationService.getOverdueIssues();
            expect(overdueIssues.length).toBeGreaterThanOrEqual(1);
            expect(overdueIssues[0].status).toBe('OVERDUE');
        });

        test('should NOT mark current issues as overdue', async () => {
            const copy = await BookCopy.create({
                bookId: book._id,
                branchId: branch._id,
                barcode: `CURR-${Date.now()}`,
                status: 'ISSUED',
                condition: 'GOOD'
            });

            // Create an issue with a future due date
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 10);

            await Issue.create({
                userId,
                copyId: copy._id,
                profileId: (await User.findById(userId)).profiles[0].profileId,
                issueDate: new Date(),
                dueDate: futureDate,
                status: 'ISSUED'
            });

            const overdueIssues = await circulationService.getOverdueIssues();
            // No issues should be marked overdue (only ones with past dueDates)
            const allCurrent = overdueIssues.every(i =>
                i.dueDate < new Date()
            );
            expect(allCurrent).toBe(true);
        });
    });
});
