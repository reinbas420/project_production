/**
 * Integration tests for Issue History (Librarian view)
 * Covers: GET /api/v1/issues/books/:bookId/history
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const BookCopy = require('../../src/models/BookCopy');
const User = require('../../src/models/User');

const {
    registerAndLogin,
    createTestBook,
    createTestBranch,
    createTestOrganization
} = require('../utils/testHelpers');

describe('Issue History (Librarian)', () => {
    let librarianToken, userToken, userId, profileId;
    let book, branch, org;

    beforeEach(async () => {
        // Librarian
        const librarian = await registerAndLogin('LIBRARIAN');
        librarianToken = librarian.token;

        // Regular user who will issue books
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;

        const userDoc = await User.findById(userId);
        profileId = userDoc.profiles[0].profileId;

        // Set delivery address
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

        // Add 2 copies so we can issue more than once
        await BookCopy.create([
            {
                bookId: book._id,
                branchId: branch._id,
                barcode: `HIST-A-${Date.now()}`,
                status: 'AVAILABLE',
                condition: 'GOOD'
            },
            {
                bookId: book._id,
                branchId: branch._id,
                barcode: `HIST-B-${Date.now()}`,
                status: 'AVAILABLE',
                condition: 'GOOD'
            }
        ]);
    });

    /**
     * TC: Librarian can view issue history for a book
     */
    test('should return issue history for a book', async () => {
        // Issue the book
        await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        // Librarian checks history
        const res = await request(app)
            .get(`/api/v1/issues/books/${book._id}/history`)
            .set('Authorization', `Bearer ${librarianToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.history.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.history[0]).toHaveProperty('issueDate');
        expect(res.body.data.history[0]).toHaveProperty('status');
    });

    /**
     * TC: Empty history for a book with no issues
     */
    test('should return empty history for a book with no issues', async () => {
        const newBook = await createTestBook();

        const res = await request(app)
            .get(`/api/v1/issues/books/${newBook._id}/history`)
            .set('Authorization', `Bearer ${librarianToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.history.length).toBe(0);
    });

    /**
     * TC: Regular USER is forbidden
     */
    test('should forbid USER from viewing book history', async () => {
        await request(app)
            .get(`/api/v1/issues/books/${book._id}/history`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(403);
    });

    /**
     * TC: Unauthenticated → 401
     */
    test('should reject unauthenticated request', async () => {
        await request(app)
            .get(`/api/v1/issues/books/${book._id}/history`)
            .expect(401);
    });

    /**
     * TC: Shows both issued and returned records
     */
    test('should show both ISSUED and RETURNED records in history', async () => {
        // Issue a book
        const issueRes = await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        // Return it
        await request(app)
            .put(`/api/v1/issues/${issueRes.body.data.issue._id}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        // Issue again (second copy)
        await request(app)
            .post('/api/v1/issues')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                bookId: book._id.toString(),
                branchId: branch._id.toString(),
                profileId: profileId.toString()
            })
            .expect(201);

        // Check history — should have 2 records
        const res = await request(app)
            .get(`/api/v1/issues/books/${book._id}/history`)
            .set('Authorization', `Bearer ${librarianToken}`)
            .expect(200);

        expect(res.body.data.history.length).toBe(2);

        const statuses = res.body.data.history.map(h => h.status);
        expect(statuses).toContain('RETURNED');
        expect(statuses).toContain('ISSUED');
    });
});
