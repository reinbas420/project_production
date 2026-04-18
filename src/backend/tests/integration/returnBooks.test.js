/**
 * Integration tests for Return Books
 * Covers: PUT /api/v1/issues/:issueId/return
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

describe('Return Books', () => {
    let userToken, userId, profileId;
    let book, branch, org;

    // Helper to issue a book and return the issueId
    async function issueABook() {
        const res = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            });
        return res.body.data.issue._id;
    }

    beforeEach(async () => {
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;

        const userDoc = await User.findById(userId);
        profileId = userDoc.profiles[0].profileId;

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

        org = await createTestOrganization();
        branch = await createTestBranch(org._id.toString(), [78.4867, 17.3850]);
        book = await createTestBook();

        await BookCopy.create({
            bookId: book._id,
            branchId: branch._id,
            barcode: `RET-${Date.now()}-${Math.random()}`,
            status: 'AVAILABLE',
            condition: 'GOOD'
        });
    });

    /**
     * TC: Successful return
     */
    test('should return a book successfully', async () => {
        const issueId = await issueABook();

        const res = await request(app)
            .put(`/api/v1/issues/${issueId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.issue.status).toBe('RETURNED');
        expect(res.body.data.issue.returnDate).toBeDefined();
    });

    /**
     * TC: BookCopy changes back to AVAILABLE after return
     */
    test('should mark BookCopy as AVAILABLE after return', async () => {
        const issueId = await issueABook();

        // Confirm copy is ISSUED
        const issuedCopies = await BookCopy.find({ bookId: book._id, status: 'ISSUED' });
        expect(issuedCopies.length).toBe(1);

        await request(app)
            .put(`/api/v1/issues/${issueId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        // Now copy should be AVAILABLE
        const returnedCopies = await BookCopy.find({ bookId: book._id, status: 'AVAILABLE' });
        expect(returnedCopies.length).toBe(1);
    });

    /**
     * TC: Delivery status changes to DELIVERED after return
     */
    test('should update delivery status to DELIVERED', async () => {
        const issueId = await issueABook();

        await request(app)
            .put(`/api/v1/issues/${issueId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        const delivery = await Delivery.findOne({ issueId });
        expect(delivery.status).toBe('DELIVERED');
        expect(delivery.deliveredAt).toBeDefined();
    });

    /**
     * TC: Cannot return an already returned book
     */
    test('should fail if book is already returned', async () => {
        const issueId = await issueABook();

        // Return first time
        await request(app)
            .put(`/api/v1/issues/${issueId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        // Try returning again
        const res = await request(app)
            .put(`/api/v1/issues/${issueId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(400);

        expect(res.body.message).toMatch(/already returned/i);
    });

    /**
     * TC: Invalid issueId → 404
     */
    test('should return 404 for invalid issueId', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        await request(app)
            .put(`/api/v1/issues/${fakeId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(404);
    });

    /**
     * TC: Unauthenticated → 401
     */
    test('should reject unauthenticated return', async () => {
        const issueId = await issueABook();
        await request(app)
            .put(`/api/v1/issues/${issueId}/return`)
            .expect(401);
    });
});
