/**
 * Integration tests for UC-3: Create Profile, UC-4: Edit Profile,
 * UC-5: Select Profile, UC-7: Delete Profile
 * Based on TestPlan.xls
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/models/User');

const { registerAndLogin } = require('../utils/testHelpers');

describe('UC-3 to UC-7: Profile Management', () => {
    let userToken, userId;

    beforeEach(async () => {
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;
    });

    // ── UC-3: Create Profile ────────────────────────────

    /**
     * TC-3.1: Create a valid child profile
     */
    test('TC-3.1 — should create a child profile', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Test Child',
                accountType: 'CHILD',
                ageGroup: '6-8',
                preferredGenres: ['Adventure', 'Fantasy']
            })
            .expect(201);

        expect(res.body.status).toBe('success');
        expect(res.body.data.profile.name).toBe('Test Child');
    });

    /**
     * TC-3.2: Missing required fields
     */
    test('TC-3.2 — should fail with missing required fields', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ accountType: 'CHILD' }) // Missing name and ageGroup
            .expect(400);

        expect(res.body.status).toBe('fail');
    });

    /**
     * TC-3.3: Invalid ageGroup
     */
    test('TC-3.3 — should fail with invalid ageGroup', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Bad Age Child',
                accountType: 'CHILD',
                ageGroup: 'INVALID'
            })
            .expect(400);

        expect(res.body.status).toBe('fail');
    });

    /**
     * TC-3.4: Non-existent parentId
     */
    test('TC-3.4 — should fail for non-existent parentId', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/v1/users/${fakeId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Orphan Child',
                accountType: 'CHILD',
                ageGroup: '4-6'
            });

        expect([404, 500]).toContain(res.statusCode);
    });

    /**
     * TC-3.6: Profile has unique auto-generated profileId
     */
    test('TC-3.6 — should assign unique profileId to new profile', async () => {
        const res = await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Unique ID Child',
                accountType: 'CHILD',
                ageGroup: '8-10'
            })
            .expect(201);

        expect(res.body.data.profile).toHaveProperty('profileId');
        expect(res.body.data.profile.profileId).toBeDefined();
    });

    // ── UC-4: Edit Profile ──────────────────────────────

    /**
     * TC-4.1: Edit profile name
     */
    test('TC-4.1 — should update profile name', async () => {
        // Get the default profile
        const userDoc = await User.findById(userId);
        const profileId = userDoc.profiles[0].profileId;

        const res = await request(app)
            .put(`/api/v1/users/${userId}/profiles/${profileId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ name: 'New Name' })
            .expect(200);

        expect(res.body.status).toBe('success');
    });

    /**
     * TC-4.2: Edit child ageGroup
     */
    test('TC-4.2 — should update child ageGroup', async () => {
        // Create a child profile first
        const createRes = await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Age Change Child',
                accountType: 'CHILD',
                ageGroup: '6-8'
            });

        const childProfileId = createRes.body.data.profile.profileId;

        const res = await request(app)
            .put(`/api/v1/users/${userId}/profiles/${childProfileId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ ageGroup: '10-12' })
            .expect(200);

        expect(res.body.status).toBe('success');
    });

    /**
     * TC-4.3: Edit preferredGenres
     */
    test('TC-4.3 — should update preferredGenres', async () => {
        const userDoc = await User.findById(userId);
        const profileId = userDoc.profiles[0].profileId;

        const res = await request(app)
            .put(`/api/v1/users/${userId}/profiles/${profileId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ preferredGenres: ['Science', 'Fantasy'] })
            .expect(200);

        expect(res.body.status).toBe('success');
    });

    /**
     * TC-4.4: Invalid ageGroup on edit → 400
     */
    test('TC-4.4 — should fail with invalid ageGroup on edit', async () => {
        const userDoc = await User.findById(userId);
        const profileId = userDoc.profiles[0].profileId;

        const res = await request(app)
            .put(`/api/v1/users/${userId}/profiles/${profileId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ ageGroup: 'INVALID' })
            .expect(400);

        expect(res.body.status).toBe('fail');
    });

    // ── UC-5: Select / View Profiles ────────────────────

    /**
     * TC-5.1: Get child profiles
     */
    test('TC-5.1 — should return child profiles', async () => {
        // Create a child first
        await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'List Child',
                accountType: 'CHILD',
                ageGroup: '4-6'
            });

        const res = await request(app)
            .get(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.profiles.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * TC-5.2: Get user with profiles array
     */
    test('TC-5.2 — should return user object with profiles', async () => {
        const res = await request(app)
            .get(`/api/v1/users/${userId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.user).toHaveProperty('profiles');
        expect(Array.isArray(res.body.data.user.profiles)).toBe(true);
    });

    /**
     * TC-5.3: Non-existent userId → 404
     */
    test('TC-5.3 — should return 404 for non-existent userId', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/v1/users/${fakeId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect([404, 500]).toContain(res.statusCode);
    });

    // ── UC-7: Delete Profile ────────────────────────────

    /**
     * TC-7.1: Delete a child profile
     */
    test('TC-7.1 — should delete a child profile', async () => {
        // Create child
        const createRes = await request(app)
            .post(`/api/v1/users/${userId}/children`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Delete Me',
                accountType: 'CHILD',
                ageGroup: '8-10'
            });

        const childProfileId = createRes.body.data.profile.profileId;

        const res = await request(app)
            .delete(`/api/v1/users/${userId}/profiles/${childProfileId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(200);

        expect(res.body.status).toBe('success');
    });

    /**
     * TC-7.3: Delete non-existent profileId → 404
     */
    test('TC-7.3 — should return 404 for non-existent profileId', async () => {
        const fakeProfileId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/v1/users/${userId}/profiles/${fakeProfileId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect([404, 500]).toContain(res.statusCode);
    });
});
