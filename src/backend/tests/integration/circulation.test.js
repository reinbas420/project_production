/**
 * Integration tests for UC-10: Order/Issue Books and UC-12: Track Orders
 * Based on TestPlan.xls
 *
 * NOTE: These tests require MongoMemoryReplSet (transaction support).
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const BookCopy = require('../../src/models/BookCopy');
const Issue = require('../../src/models/Issue');
const Delivery = require('../../src/models/Delivery');
const User = require('../../src/models/User');

const {
    registerAndLogin,
    createTestBook,
    createTestBranch,
    createTestOrganization
} = require('../utils/testHelpers');

describe('UC-10 & UC-12: Circulation & Tracking', () => {
    let userToken, userId;
    let book, branch, org, profileId;

    beforeEach(async () => {
        // 1. Create User and get profileId
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;

        const userDoc = await User.findById(userId);
        profileId = userDoc.profiles[0].profileId;

        // 2. Set delivery address (Hyderabad — close to test branch)
        await request(app)
            .put(`/api/v1/users/${userId}/location`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                latitude: 17.3850,
                longitude: 78.4867,
                street: '123 Test St',
                city: 'Hyderabad',
                pincode: '500001'
            });

        // 3. Create Org, Branch, and Book
        org = await createTestOrganization();
        branch = await createTestBranch(org._id.toString(), [78.4867, 17.3850]);
        book = await createTestBook();

        // 4. Add an AVAILABLE copy
        await BookCopy.create({
            bookId: book._id,
            branchId: branch._id,
            barcode: `CIRC-${Date.now()}-${Math.random()}`,
            status: 'AVAILABLE',
            condition: 'GOOD'
        });
    });

    // ── UC-10: Issue Books ──────────────────────────────

    /**
     * TC-10.1: Successful book issue
     */
    test('TC-10.1 — should issue a book successfully', async () => {
        const res = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString(),
                type: 'PHYSICAL'
            })
            .expect(201);

        expect(res.body.status).toBe('success');
        expect(res.body.data.issue.status).toBe('ISSUED');
    });

    /**
     * TC-10.2: Branch outside delivery radius (Delhi vs Hyderabad ≈ 1500km)
     */
    test('TC-10.2 — should fail if branch is outside delivery radius', async () => {
        const distantBranch = await createTestBranch(org._id.toString(), [77.1025, 28.7041]);
        await BookCopy.create({
            bookId: book._id,
            branchId: distantBranch._id,
            barcode: `FAR-${Date.now()}`,
            status: 'AVAILABLE'
        });

        const res = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: distantBranch._id.toString(),
                profileId: profileId.toString(),
                type: 'PHYSICAL'
            })
            .expect(400);

        expect(res.body.message).toMatch(/beyond.*radius/i);
    });

    /**
     * TC-10.3: No available copies
     */
    test('TC-10.3 — should fail if no copies are available', async () => {
        await BookCopy.updateMany({ bookId: book._id }, { status: 'LOST' });

        const res = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(400);

        expect(res.body.message).toMatch(/no copies available/i);
    });

    /**
     * TC-10.4: Inactive branch
     */
    test('TC-10.4 — should fail if branch is inactive', async () => {
        branch.status = 'INACTIVE';
        await branch.save();

        const res = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            });

        // Service throws 404 for not-found-or-inactive
        expect([400, 404]).toContain(res.statusCode);
    });

    /**
     * TC-10.7: 14-day dueDate verification
     */
    test('TC-10.7 — should set dueDate to 14 days from issueDate', async () => {
        const res = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        const issueDate = new Date(res.body.data.issue.issueDate);
        const dueDate = new Date(res.body.data.issue.dueDate);
        const diffDays = Math.round((dueDate - issueDate) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(14);
    });

    /**
     * TC-10.9: Unauthenticated → 401
     */
    test('TC-10.9 — should reject unauthenticated issue request', async () => {
        await request(app)
            .post('/api/v1/issues')
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(401);
    });

    /**
     * TC-10.10: BookCopy status changes to ISSUED after issuing
     */
    test('TC-10.10 — should mark BookCopy status as ISSUED', async () => {
        await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        const copies = await BookCopy.find({ bookId: book._id, branchId: branch._id });
        expect(copies[0].status).toBe('ISSUED');
    });

    // ── UC-12: Track Orders ─────────────────────────────

    /**
     * TC-12.1: Get single issue with delivery details
     */
    test('TC-12.1 — should get issue with delivery details', async () => {
        const issueRes = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        const issueId = issueRes.body.data.issue._id;

        const res = await request(app)
            .get(`/api/v1/issues/${issueId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data).toHaveProperty('delivery');
        expect(res.body.data.delivery.status).toBe('SCHEDULED');
    });

    /**
     * TC-12.2: Get all user issues
     */
    test('TC-12.2 — should get all user issues', async () => {
        await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        const res = await request(app)
            .get(`/api/v1/issues/users/${userId}/issues`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.issues.length).toBeGreaterThan(0);
    });

    /**
     * TC-12.3: Filter issues by status
     */
    test('TC-12.3 — should filter user issues by status', async () => {
        await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        const res = await request(app)
            .get(`/api/v1/issues/users/${userId}/issues?status=ISSUED`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        // All returned issues should have status ISSUED
        res.body.data.issues.forEach(issue => {
            expect(issue.status).toBe('ISSUED');
        });
    });

    /**
     * TC-12.5: Invalid issueId → 404
     */
    test('TC-12.5 — should return 404 for invalid issueId', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        await request(app)
            .get(`/api/v1/issues/${fakeId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);
    });
});
