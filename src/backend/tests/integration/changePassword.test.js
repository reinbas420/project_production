/**
 * Integration tests for UC-Add-5: Change Password
 * Based on TestPlan.xls — TC-Add-5.1 through TC-Add-5.3
 */

const request = require('supertest');
const app = require('../../src/app');

const {
    registerAndLogin,
    cleanupUser
} = require('../utils/testHelpers');

describe('UC-Add-5: Change Password', () => {
    let userToken, userId, userEmail;
    const originalPassword = 'password123';
    const newPassword = 'newpassword456';

    // Track user IDs for cleanup
    const userIdsToClean = [];

    beforeAll(async () => {
        const user = await registerAndLogin('USER');
        userToken = user.token;
        userId = user.userId;
        userEmail = user.email;
        userIdsToClean.push(userId);
    });

    afterAll(async () => {
        for (const uid of userIdsToClean) {
            await cleanupUser(uid);
        }
    });

    /**
     * TC-Add-5.1: Change password successfully, then login with new password
     * PUT /api/v1/auth/change-password
     * Expected: 200 OK; password updated, login with new password succeeds
     */
    test('TC-Add-5.1 — should change password and login with new password', async () => {
        // Step 1: Change the password
        const changeRes = await request(app)
            .put('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                oldPassword: originalPassword,
                newPassword: newPassword
            })
            .expect(200);

        expect(changeRes.body.status).toBe('success');

        // Step 2: Login with the new password
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: userEmail,
                password: newPassword
            })
            .expect(200);

        expect(loginRes.body.status).toBe('success');
        expect(loginRes.body.data).toHaveProperty('token');

        // Update token for subsequent tests
        userToken = loginRes.body.data.token;
    });

    /**
     * TC-Add-5.2: Submit with incorrect old password
     * PUT /api/v1/auth/change-password
     * Expected: 401 Unauthorized; wrong old password
     */
    test('TC-Add-5.2 — should reject wrong old password', async () => {
        const res = await request(app)
            .put('/api/v1/auth/change-password')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                oldPassword: 'totally-wrong-password',
                newPassword: 'anotherpassword789'
            });

        // Could be 401 (incorrect password) or 400 depending on implementation
        expect([400, 401]).toContain(res.statusCode);
    });

    /**
     * TC-Add-5.3: Attempt password change without JWT token
     * PUT /api/v1/auth/change-password
     * Expected: 401 Unauthorized
     */
    test('TC-Add-5.3 — should reject password change without auth token', async () => {
        const res = await request(app)
            .put('/api/v1/auth/change-password')
            .send({
                oldPassword: newPassword,
                newPassword: 'yetanotherpassword'
            })
            .expect(401);

        expect(res.body.status).toBe('fail');
    });
});
