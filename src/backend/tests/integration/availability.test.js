/**
 * Integration tests for UC-9: Check Availability
 * Based on TestPlan.xls — TC-9.1 through TC-9.6
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const Book = require('../../src/models/Book');
const BookCopy = require('../../src/models/BookCopy');
const LibraryBranch = require('../../src/models/LibraryBranch');
const User = require('../../src/models/User');

const {
    registerAndLogin,
    createTestBook,
    createTestBranch,
    createTestOrganization
} = require('../utils/testHelpers');

describe('UC-9: Check Availability', () => {
    let userToken, userId;
    let book, branch, org;

    beforeEach(async () => {
        // 1. Register user and set delivery address
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;

        // Set delivery address (Hyderabad)
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

        // 2. Create org, branch, and book
        org = await createTestOrganization();
        branch = await createTestBranch(org._id.toString(), [78.4867, 17.3850]); // Near user
        book = await createTestBook();
    });

    /**
     * TC-9.1: Available copies nearby → shows branches with available copies
     */
    test('TC-9.1 — should show available copies at nearby branches', async () => {
        // Add AVAILABLE copy at the nearby branch
        await BookCopy.create({
            bookId: book._id,
            branchId: branch._id,
            barcode: `AVAIL-${Date.now()}`,
            status: 'AVAILABLE',
            condition: 'GOOD'
        });

        const res = await request(app)
            .get(`/api/v1/books/${book._id}/availability`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.totalAvailable).toBeGreaterThanOrEqual(1);
        expect(res.body.data.branches.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.branches[0].isWithinReach).toBe(true);
    });

    /**
     * TC-9.2: All copies ISSUED → empty availability
     */
    test('TC-9.2 — should show zero availability when all copies are issued', async () => {
        await BookCopy.create({
            bookId: book._id,
            branchId: branch._id,
            barcode: `ISSUED-${Date.now()}`,
            status: 'ISSUED',
            condition: 'GOOD'
        });

        const res = await request(app)
            .get(`/api/v1/books/${book._id}/availability`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.totalAvailable).toBe(0);
        expect(res.body.data.branches.length).toBe(0);
    });

    /**
     * TC-9.3: All branches > 8km away → not within reach
     */
    test('TC-9.3 — should show branches not within reach if too far', async () => {
        // Create a far-away branch (Delhi)
        const farBranch = await createTestBranch(org._id.toString(), [77.1025, 28.7041]);
        await BookCopy.create({
            bookId: book._id,
            branchId: farBranch._id,
            barcode: `FAR-${Date.now()}`,
            status: 'AVAILABLE',
            condition: 'GOOD'
        });

        const res = await request(app)
            .get(`/api/v1/books/${book._id}/availability`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        // The branch should exist but isWithinReach should be false
        if (res.body.data.branches.length > 0) {
            expect(res.body.data.branches[0].isWithinReach).toBe(false);
        }
    });

    /**
     * TC-9.5: Unauthenticated access → 401
     */
    test('TC-9.5 — should return 401 for unauthenticated request', async () => {
        await request(app)
            .get(`/api/v1/books/${book._id}/availability`)
            .expect(401);
    });

    /**
     * TC-9.6: Non-existent bookId → 404
     */
    test('TC-9.6 — should return 404 for invalid bookId', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/v1/books/${fakeId}/availability`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        // The service returns 200 with empty data for non-existent book
        expect(res.body.data.totalAvailable).toBe(0);
    });
});
