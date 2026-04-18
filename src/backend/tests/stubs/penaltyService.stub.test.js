/**
 * Tests for penaltyService.stub.js
 * Verifies that the stub correctly validates data and rejects corrupt input
 */

const penaltyService = require('../../src/services/penaltyService.stub');

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'table').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

const VALID_ISSUE_ID = '507f1f77bcf86cd799439011';
const VALID_DUE_DATE = new Date('2026-02-01'); // past date for overdue testing

// ─────────────────────────────────────────────────────────────────
describe('penaltyService.stub - createPenalty', () => {

  test('accepts valid issueId and dueDate', async () => {
    const result = await penaltyService.createPenalty(VALID_ISSUE_ID, VALID_DUE_DATE);
    expect(result.stub).toBe(true);
    expect(result.issue_id).toBe(VALID_ISSUE_ID);
    expect(result.fine_status).toBe('NONE');
    expect(result.fine_amount).toBe(0);
    expect(result.overdue_days).toBe(0);
  });

  test('accepts ISO string date', async () => {
    const result = await penaltyService.createPenalty(VALID_ISSUE_ID, '2026-02-01');
    expect(result.stub).toBe(true);
  });

  test('accepts future due date (book just issued)', async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await penaltyService.createPenalty(VALID_ISSUE_ID, future);
    expect(result.stub).toBe(true);
  });

  test('rejects missing issueId', async () => {
    await expect(
      penaltyService.createPenalty(null, VALID_DUE_DATE)
    ).rejects.toThrow('issueId is required');
  });

  test('rejects invalid ObjectId for issueId', async () => {
    await expect(
      penaltyService.createPenalty('not-valid', VALID_DUE_DATE)
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });

  test('rejects missing dueDate', async () => {
    await expect(
      penaltyService.createPenalty(VALID_ISSUE_ID, null)
    ).rejects.toThrow('dueDate is required');
  });

  test('rejects invalid date string', async () => {
    await expect(
      penaltyService.createPenalty(VALID_ISSUE_ID, 'not-a-date')
    ).rejects.toThrow('not a valid date');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('penaltyService.stub - calculatePenalty', () => {

  test('accepts valid issueId and returns fine calculation', async () => {
    const result = await penaltyService.calculatePenalty(VALID_ISSUE_ID);
    expect(result.stub).toBe(true);
    expect(result.issue_id).toBe(VALID_ISSUE_ID);
    expect(typeof result.overdue_days).toBe('number');
    expect(typeof result.fine_amount).toBe('number');
    expect(result.fine_amount).toBeGreaterThanOrEqual(0);
    expect(['PENDING', 'NONE']).toContain(result.fine_status);
  });

  test('rejects missing issueId', async () => {
    await expect(
      penaltyService.calculatePenalty(undefined)
    ).rejects.toThrow('issueId is required');
  });

  test('rejects invalid ObjectId', async () => {
    await expect(
      penaltyService.calculatePenalty('bad-id')
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('penaltyService.stub - markPenaltyAsPaid', () => {

  test('accepts valid issueId and returnDate', async () => {
    const result = await penaltyService.markPenaltyAsPaid(VALID_ISSUE_ID, new Date());
    expect(result.stub).toBe(true);
    expect(result.issue_id).toBe(VALID_ISSUE_ID);
    expect(result.fine_status).toBe('PAID');
  });

  test('accepts ISO string returnDate', async () => {
    const result = await penaltyService.markPenaltyAsPaid(VALID_ISSUE_ID, '2026-03-03');
    expect(result.fine_status).toBe('PAID');
  });

  test('rejects missing issueId', async () => {
    await expect(
      penaltyService.markPenaltyAsPaid(null, new Date())
    ).rejects.toThrow('issueId is required');
  });

  test('rejects invalid ObjectId', async () => {
    await expect(
      penaltyService.markPenaltyAsPaid('bad-id', new Date())
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });

  test('rejects missing returnDate', async () => {
    await expect(
      penaltyService.markPenaltyAsPaid(VALID_ISSUE_ID, null)
    ).rejects.toThrow('returnDate is required');
  });

  test('rejects invalid returnDate', async () => {
    await expect(
      penaltyService.markPenaltyAsPaid(VALID_ISSUE_ID, 'yesterday')
    ).rejects.toThrow('not a valid date');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('penaltyService.stub - getPenaltiesByIssueIds', () => {

  test('returns empty array for empty input', async () => {
    const result = await penaltyService.getPenaltiesByIssueIds([]);
    expect(result).toEqual([]);
  });

  test('accepts valid array of ObjectIds', async () => {
    const result = await penaltyService.getPenaltiesByIssueIds([VALID_ISSUE_ID]);
    expect(Array.isArray(result)).toBe(true);
  });

  test('accepts valid status filter', async () => {
    const result = await penaltyService.getPenaltiesByIssueIds([VALID_ISSUE_ID], 'PENDING');
    expect(Array.isArray(result)).toBe(true);
  });

  test('rejects non-array input', async () => {
    await expect(
      penaltyService.getPenaltiesByIssueIds(VALID_ISSUE_ID)
    ).rejects.toThrow('issueIds must be an array');
  });

  test('rejects array with invalid ObjectId', async () => {
    await expect(
      penaltyService.getPenaltiesByIssueIds([VALID_ISSUE_ID, 'bad-id'])
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });

  test('rejects invalid fine_status filter', async () => {
    await expect(
      penaltyService.getPenaltiesByIssueIds([VALID_ISSUE_ID], 'FORGIVEN')
    ).rejects.toThrow('invalid fine_status');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('penaltyService.stub - getTotalPendingFinesByIssueIds', () => {

  test('returns 0 for empty issue list', async () => {
    const total = await penaltyService.getTotalPendingFinesByIssueIds([]);
    expect(total).toBe(0);
  });

  test('returns 0 for valid issue list (no MySQL)', async () => {
    const total = await penaltyService.getTotalPendingFinesByIssueIds([VALID_ISSUE_ID]);
    expect(total).toBe(0);
  });

  test('rejects non-array input', async () => {
    await expect(
      penaltyService.getTotalPendingFinesByIssueIds(VALID_ISSUE_ID)
    ).rejects.toThrow('issueIds must be an array');
  });

  test('rejects array with invalid ObjectId', async () => {
    await expect(
      penaltyService.getTotalPendingFinesByIssueIds(['bad-id'])
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('penaltyService.stub - processOverduePenalties', () => {

  test('returns stub result with 0 processed', async () => {
    const result = await penaltyService.processOverduePenalties();
    expect(result.stub).toBe(true);
    expect(result.processed).toBe(0);
    expect(Array.isArray(result.penalties)).toBe(true);
  });
});
