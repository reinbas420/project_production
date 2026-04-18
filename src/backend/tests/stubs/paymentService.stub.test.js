/**
 * Tests for paymentService.stub.js
 * Verifies that the stub correctly validates data and rejects corrupt input
 */

const paymentService = require('../../src/services/paymentService.stub');

// Suppress console.log / console.table output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'table').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

// A valid MongoDB ObjectId for reuse
const VALID_ISSUE_ID = '507f1f77bcf86cd799439011';
const VALID_USER_ID  = '507f1f77bcf86cd799439022';

// ─────────────────────────────────────────────────────────────────
describe('paymentService.stub - createPayment', () => {

  test('accepts valid minimal payment data', async () => {
    const result = await paymentService.createPayment({
      issueId: VALID_ISSUE_ID,
      amount: 50
    });
    expect(result.stub).toBe(true);
    expect(result.transactionId).toMatch(/^TXN_/);
    expect(result.issueId).toBe(VALID_ISSUE_ID);
    expect(result.amount).toBe(50);
    expect(result.status).toBe('PENDING');
    expect(result.paymentType).toBe('OTHER');       // default
    expect(result.paymentMethod).toBe('CASH');      // default
  });

  test('accepts all valid payment types', async () => {
    const types = ['ISSUE_FEE', 'PENALTY', 'DAMAGE', 'LOST_BOOK', 'OTHER'];
    for (const paymentType of types) {
      const result = await paymentService.createPayment({
        issueId: VALID_ISSUE_ID,
        amount: 10,
        paymentType
      });
      expect(result.paymentType).toBe(paymentType);
    }
  });

  test('accepts all valid payment methods', async () => {
    const methods = ['CASH', 'UPI', 'CARD', 'NET_BANKING', 'OTHER'];
    for (const paymentMethod of methods) {
      const result = await paymentService.createPayment({
        issueId: VALID_ISSUE_ID,
        amount: 10,
        paymentMethod
      });
      expect(result.paymentMethod).toBe(paymentMethod);
    }
  });

  test('accepts amount of 0 (free/waived)', async () => {
    const result = await paymentService.createPayment({
      issueId: VALID_ISSUE_ID,
      amount: 0
    });
    expect(result.amount).toBe(0);
  });

  test('rejects missing issueId', async () => {
    await expect(
      paymentService.createPayment({ amount: 50 })
    ).rejects.toThrow('issueId is required');
  });

  test('rejects non-ObjectId issueId', async () => {
    await expect(
      paymentService.createPayment({ issueId: 'not-an-objectid', amount: 50 })
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });

  test('rejects numeric string as issueId', async () => {
    await expect(
      paymentService.createPayment({ issueId: '12345', amount: 50 })
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });

  test('rejects missing amount', async () => {
    await expect(
      paymentService.createPayment({ issueId: VALID_ISSUE_ID })
    ).rejects.toThrow('amount is required');
  });

  test('rejects negative amount', async () => {
    await expect(
      paymentService.createPayment({ issueId: VALID_ISSUE_ID, amount: -10 })
    ).rejects.toThrow('amount must be >= 0');
  });

  test('rejects string amount', async () => {
    await expect(
      paymentService.createPayment({ issueId: VALID_ISSUE_ID, amount: 'fifty' })
    ).rejects.toThrow('amount must be a number');
  });

  test('rejects invalid paymentType', async () => {
    await expect(
      paymentService.createPayment({ issueId: VALID_ISSUE_ID, amount: 10, paymentType: 'BRIBE' })
    ).rejects.toThrow('invalid paymentType');
  });

  test('rejects invalid paymentMethod', async () => {
    await expect(
      paymentService.createPayment({ issueId: VALID_ISSUE_ID, amount: 10, paymentMethod: 'CRYPTO' })
    ).rejects.toThrow('invalid paymentMethod');
  });

  test('each call produces a unique transactionId', async () => {
    const r1 = await paymentService.createPayment({ issueId: VALID_ISSUE_ID, amount: 10 });
    const r2 = await paymentService.createPayment({ issueId: VALID_ISSUE_ID, amount: 10 });
    expect(r1.transactionId).not.toBe(r2.transactionId);
  });
});

// ─────────────────────────────────────────────────────────────────
describe('paymentService.stub - updatePaymentStatus', () => {

  test('accepts valid status update', async () => {
    const result = await paymentService.updatePaymentStatus('TXN_123_abc', { status: 'SUCCESS' });
    expect(result.stub).toBe(true);
    expect(result.payment_status).toBe('SUCCESS');
  });

  test('accepts all valid statuses', async () => {
    const statuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
    for (const status of statuses) {
      const result = await paymentService.updatePaymentStatus('TXN_123_abc', { status });
      expect(result.payment_status).toBe(status);
    }
  });

  test('rejects missing transactionId', async () => {
    await expect(
      paymentService.updatePaymentStatus(null, { status: 'SUCCESS' })
    ).rejects.toThrow('transactionId is required');
  });

  test('rejects invalid status', async () => {
    await expect(
      paymentService.updatePaymentStatus('TXN_123', { status: 'APPROVED' })
    ).rejects.toThrow('invalid status');
  });

  test('rejects missing status', async () => {
    await expect(
      paymentService.updatePaymentStatus('TXN_123', {})
    ).rejects.toThrow('invalid status');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('paymentService.stub - getPaymentsByIssueIds', () => {

  test('returns empty array for empty input', async () => {
    const result = await paymentService.getPaymentsByIssueIds([]);
    expect(result).toEqual([]);
  });

  test('accepts array of valid ObjectIds', async () => {
    const result = await paymentService.getPaymentsByIssueIds([VALID_ISSUE_ID]);
    expect(Array.isArray(result)).toBe(true);
  });

  test('rejects non-array input', async () => {
    await expect(
      paymentService.getPaymentsByIssueIds(VALID_ISSUE_ID)
    ).rejects.toThrow('issueIds must be an array');
  });

  test('rejects array containing invalid ObjectId', async () => {
    await expect(
      paymentService.getPaymentsByIssueIds([VALID_ISSUE_ID, 'bad-id'])
    ).rejects.toThrow('not a valid MongoDB ObjectId');
  });
});

// ─────────────────────────────────────────────────────────────────
describe('paymentService.stub - logTransaction', () => {

  test('accepts valid log data', async () => {
    await expect(
      paymentService.logTransaction({
        transactionId: 'TXN_123',
        userId: VALID_USER_ID,
        action: 'PAYMENT_INITIATED',
        details: { amount: 50 },
        ipAddress: '127.0.0.1'
      })
    ).resolves.not.toThrow();
  });

  test('accepts details as plain string', async () => {
    await expect(
      paymentService.logTransaction({
        userId: VALID_USER_ID,
        action: 'PAYMENT_INITIATED',
        details: 'some details string'
      })
    ).resolves.not.toThrow();
  });

  test('rejects missing userId', async () => {
    await expect(
      paymentService.logTransaction({ action: 'PAYMENT_INITIATED' })
    ).rejects.toThrow('userId is required');
  });

  test('rejects missing action', async () => {
    await expect(
      paymentService.logTransaction({ userId: VALID_USER_ID })
    ).rejects.toThrow('action is required');
  });
});
