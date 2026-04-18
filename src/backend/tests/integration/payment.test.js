/**
 * Integration tests for UC-Add-3: Payment Management
 * Based on TestPlan.xls — TC-Add-3.1 through TC-Add-3.5
 *
 * Payment routes use stub services (in-memory, no MySQL).
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');

const {
    registerAndLogin,
    createTestBook,
    createTestBranch,
    createTestIssue
} = require('../utils/testHelpers');

const Issue = require('../../src/models/Issue');
const BookCopy = require('../../src/models/BookCopy');

// Suppress stub console output during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'table').mockImplementation(() => { });
});
afterAll(() => {
    jest.restoreAllMocks();
});

describe('UC-Add-3: Payment Management', () => {
    let userToken, userId;
    let issue;

    beforeEach(async () => {
        // Create fresh data before each test
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;

        const book = await createTestBook();
        const branch = await createTestBranch();
        const copy = await BookCopy.create({
            bookId: book._id,
            branchId: branch._id,
            barcode: `BAR-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            status: 'ISSUED',
            condition: 'GOOD'
        });
        issue = await createTestIssue(userId, copy._id);
    });

    /**
     * TC-Add-3.1: Create a payment record
     * POST /api/v1/payments
     * Expected: 201 Created; payment record stored
     */
    test('TC-Add-3.1 — should create a payment', async () => {
        const res = await request(app)
            .post('/api/v1/payments')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                issueId: issue._id.toString(),
                amount: 100,
                paymentType: 'ISSUE_FEE',
                paymentMethod: 'UPI'
            })
            .expect(201);

        expect(res.body.status).toBe('success');
        expect(res.body.data.payment).toHaveProperty('transactionId');
    });

    /**
     * TC-Add-3.2: Update payment status to SUCCESS
     * PUT /api/v1/payments/:transactionId
     * Expected: 200 OK; payment status updated to SUCCESS
     */
    test('TC-Add-3.2 — should update payment status to SUCCESS', async () => {
        // First create a payment to get a transactionId
        const createRes = await request(app)
            .post('/api/v1/payments')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                issueId: issue._id.toString(),
                amount: 100,
                paymentType: 'ISSUE_FEE',
                paymentMethod: 'UPI'
            });

        const txnId = createRes.body.data.payment.transactionId;

        const res = await request(app)
            .put(`/api/v1/payments/${txnId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ status: 'SUCCESS' })
            .expect(200);

        expect(res.body.status).toBe('success');
    });

    /**
     * TC-Add-3.3: Get payment by transactionId
     * GET /api/v1/payments/:transactionId
     * Expected: 200 OK; payment record returned
     */
    test('TC-Add-3.3 — should get payment by transactionId', async () => {
        // First create a payment
        const createRes = await request(app)
            .post('/api/v1/payments')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                issueId: issue._id.toString(),
                amount: 50,
                paymentType: 'ISSUE_FEE',
                paymentMethod: 'CASH'
            });

        const txnId = createRes.body.data.payment.transactionId;

        const res = await request(app)
            .get(`/api/v1/payments/${txnId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveProperty('payment');
    });

    /**
     * TC-Add-3.4: Get all payments for a user
     * GET /api/v1/payments/users/:userId/payments
     * Expected: 200 OK; list of user's payment records
     */
    test('TC-Add-3.4 — should get user payment history', async () => {
        const res = await request(app)
            .get(`/api/v1/payments/users/${userId}/payments`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data.payments)).toBe(true);
    });

    /**
     * TC-Add-3.5: POST payment without JWT token
     * POST /api/v1/payments
     * Expected: 401 Unauthorized
     */
    test('TC-Add-3.5 — should reject payment without auth token', async () => {
        const res = await request(app)
            .post('/api/v1/payments')
            .send({
                issueId: issue._id.toString(),
                amount: 50,
                paymentType: 'ISSUE_FEE',
                paymentMethod: 'CASH'
            })
            .expect(401);

        expect(res.body.status).toBe('fail');
    });
});
