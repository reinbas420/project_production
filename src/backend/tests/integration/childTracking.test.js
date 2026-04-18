/**
 * Integration tests for Child Profile Tracking
 *
 * Covers:
 *   - Creating child profiles (POST /users/:parentId/children)
 *   - Listing child profiles  (GET  /users/:parentId/children)
 *   - Updating a child profile (PUT  /users/:userId/profiles/:profileId)
 *   - Deleting a child profile (DELETE /users/:userId/profiles/:profileId)
 *   - Reading history           (GET  /users/:userId/profiles/:profileId/history)
 *   - Per-profile issue tracking (GET /users/:id/issues?profileId=xxx)
 *
 * NOTE: Requires MongoMemoryReplSet (configured in tests/setup.js).
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');
const User = require('../../src/models/User');
const BookCopy = require('../../src/models/BookCopy');
const Issue = require('../../src/models/Issue');

const {
  registerAndLogin,
  createTestBook,
  createTestBranch,
  createTestOrganization,
} = require('../utils/testHelpers');

// ─────────────────────────────────────────────────────────────────
describe('Child Profile Tracking', () => {
  let token, userId;

  beforeEach(async () => {
    const user = await registerAndLogin('USER');
    token = user.token;
    userId = user.userId;
  });

  // ── CREATE ────────────────────────────────────────────────────

  describe('POST /api/v1/users/:parentId/children', () => {
    /**
     * TC-CT-1.1: Successfully create a CHILD profile
     */
    test('TC-CT-1.1 — should create a child profile', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Aarav',
          ageGroup: '6-8',
          preferredGenres: ['Fiction', 'Adventure'],
          preferredLanguages: ['English'],
        })
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.profile).toHaveProperty('profileId');
      expect(res.body.data.profile.name).toBe('Aarav');
      expect(res.body.data.profile.accountType).toBe('CHILD');
      expect(res.body.data.profile.ageGroup).toBe('6-8');
      expect(res.body.data.profile.preferredGenres).toEqual(
        expect.arrayContaining(['Fiction', 'Adventure']),
      );
    });

    /**
     * TC-CT-1.2: Profile with ageGroup "15+" should be created as PARENT type
     */
    test('TC-CT-1.2 — ageGroup 15+ creates a PARENT-type profile', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Priya',
          ageGroup: '15+',
        })
        .expect(201);

      expect(res.body.data.profile.accountType).toBe('PARENT');
    });

    /**
     * TC-CT-1.3: Missing required field (name) should fail validation
     */
    test('TC-CT-1.3 — should fail when name is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ageGroup: '6-8' })
        .expect(400);

      expect(res.body.status).toBe('fail');
    });

    /**
     * TC-CT-1.4: Missing required field (ageGroup) should fail validation
     */
    test('TC-CT-1.4 — should fail when ageGroup is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aarav' })
        .expect(400);

      expect(res.body.status).toBe('fail');
    });

    /**
     * TC-CT-1.5: Invalid ageGroup value should fail validation
     */
    test('TC-CT-1.5 — should fail for invalid ageGroup', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aarav', ageGroup: '99-100' })
        .expect(400);

      expect(res.body.status).toBe('fail');
    });

    /**
     * TC-CT-1.6: Unauthenticated request should be rejected
     */
    test('TC-CT-1.6 — should fail without auth token', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .send({ name: 'Aarav', ageGroup: '6-8' })
        .expect(401);

      expect(res.body.status).toBe('fail');
    });

    /**
     * TC-CT-1.7: Invalid parentId should return 404
     */
    test('TC-CT-1.7 — should fail for non-existent parentId', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/users/${fakeId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aarav', ageGroup: '6-8' })
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });

    /**
     * TC-CT-1.8: Should create multiple child profiles under one parent
     */
    test('TC-CT-1.8 — should allow multiple child profiles', async () => {
      await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Child One', ageGroup: '4-6' })
        .expect(201);

      await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Child Two', ageGroup: '8-10' })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.profiles.length).toBe(2);
    });
  });

  // ── LIST ──────────────────────────────────────────────────────

  describe('GET /api/v1/users/:parentId/children', () => {
    /**
     * TC-CT-2.1: Return only CHILD-type profiles (exclude PARENT default profile)
     */
    test('TC-CT-2.1 — should return only child profiles', async () => {
      // The registered user already has a PARENT profile from registration.
      // Add one child:
      await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aarav', ageGroup: '6-8' })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.profiles.length).toBe(1);
      expect(res.body.data.profiles[0].accountType).toBe('CHILD');
      expect(res.body.data.profiles[0].name).toBe('Aarav');
    });

    /**
     * TC-CT-2.2: Return empty array when no child profiles exist
     */
    test('TC-CT-2.2 — should return empty array when no children', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.profiles).toEqual([]);
    });

    /**
     * TC-CT-2.3: Non-existent parentId returns 404
     */
    test('TC-CT-2.3 — should fail for non-existent parentId', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/users/${fakeId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ── UPDATE ────────────────────────────────────────────────────

  describe('PUT /api/v1/users/:userId/profiles/:profileId', () => {
    let childProfileId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aarav', ageGroup: '6-8', preferredGenres: ['Fiction'] });

      childProfileId = createRes.body.data.profile.profileId;
    });

    /**
     * TC-CT-3.1: Update child name and ageGroup
     */
    test('TC-CT-3.1 — should update name and ageGroup', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${userId}/profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aarav Updated', ageGroup: '8-10' })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.profile.name).toBe('Aarav Updated');
      expect(res.body.data.profile.ageGroup).toBe('8-10');
    });

    /**
     * TC-CT-3.2: Update preferred genres
     */
    test('TC-CT-3.2 — should update preferredGenres', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${userId}/profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preferredGenres: ['Science', 'Adventure'] })
        .expect(200);

      expect(res.body.data.profile.preferredGenres).toEqual(
        expect.arrayContaining(['Science', 'Adventure']),
      );
    });

    /**
     * TC-CT-3.3: Update preferred languages
     */
    test('TC-CT-3.3 — should update preferredLanguages', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${userId}/profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ preferredLanguages: ['Hindi', 'Telugu'] })
        .expect(200);

      expect(res.body.data.profile.preferredLanguages).toEqual(
        expect.arrayContaining(['Hindi', 'Telugu']),
      );
    });

    /**
     * TC-CT-3.4: Reject update for non-existent profileId
     */
    test('TC-CT-3.4 — should fail for non-existent profileId', async () => {
      const fakeProfileId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/v1/users/${userId}/profiles/${fakeProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Ghost' })
        .expect(404);

      expect(res.body.message).toMatch(/not found/i);
    });

    /**
     * TC-CT-3.5: Reject invalid ageGroup value on update
     */
    test('TC-CT-3.5 — should fail for invalid ageGroup on update', async () => {
      await request(app)
        .put(`/api/v1/users/${userId}/profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ageGroup: '99-100' })
        .expect(400);
    });
  });

  // ── DELETE ────────────────────────────────────────────────────

  describe('DELETE /api/v1/users/:userId/profiles/:profileId', () => {
    let childProfileId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'To Delete', ageGroup: '4-6' });

      childProfileId = createRes.body.data.profile.profileId;
    });

    /**
     * TC-CT-4.1: Successfully delete a child profile
     */
    test('TC-CT-4.1 — should delete a child profile', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${userId}/profiles/${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.message).toMatch(/deleted/i);

      // Verify it's gone
      const listRes = await request(app)
        .get(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.data.profiles.length).toBe(0);
    });

    /**
     * TC-CT-4.2: Cannot delete the last PARENT profile
     */
    test('TC-CT-4.2 — should not delete the last parent profile', async () => {
      // Get the parent profileId from the user document
      const userDoc = await User.findById(userId);
      const parentProfile = userDoc.profiles.find(
        (p) => p.accountType === 'PARENT',
      );

      const res = await request(app)
        .delete(`/api/v1/users/${userId}/profiles/${parentProfile.profileId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.message).toMatch(/cannot delete.*last.*parent/i);
    });

    /**
     * TC-CT-4.3: Deleting non-existent profile returns 404
     */
    test('TC-CT-4.3 — should fail for non-existent profileId', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .delete(`/api/v1/users/${userId}/profiles/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ── READING HISTORY ───────────────────────────────────────────

  describe('GET /api/v1/users/:userId/profiles/:profileId/history', () => {
    let childProfileId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Reader', ageGroup: '8-10' });

      childProfileId = createRes.body.data.profile.profileId;
    });

    /**
     * TC-CT-5.1: Empty reading history for a new child
     */
    test('TC-CT-5.1 — should return empty history for new child', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${userId}/profiles/${childProfileId}/history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.history).toEqual([]);
    });

    /**
     * TC-CT-5.2: Non-existent profileId returns 404
     */
    test('TC-CT-5.2 — should fail for non-existent profileId', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/users/${userId}/profiles/${fakeId}/history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    /**
     * TC-CT-5.3: Non-existent userId returns 404
     */
    test('TC-CT-5.3 — should fail for non-existent userId', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/users/${fakeUserId}/profiles/${childProfileId}/history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ── PER-PROFILE ISSUE TRACKING ───────────────────────────────

  describe('GET /api/v1/users/:id/issues?profileId=xxx', () => {
    let childProfileId, parentProfileId;
    let book, branch, org;

    beforeEach(async () => {
      // Create a child profile
      const createRes = await request(app)
        .post(`/api/v1/users/${userId}/children`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Issue Child', ageGroup: '6-8' });
      childProfileId = createRes.body.data.profile.profileId;

      // Get parent profileId
      const userDoc = await User.findById(userId);
      parentProfileId = userDoc.profiles.find(
        (p) => p.accountType === 'PARENT',
      ).profileId;

      // Setup org, branch, book, copy + delivery address
      org = await createTestOrganization();
      branch = await createTestBranch(org._id.toString(), [78.4867, 17.3850]);
      book = await createTestBook();

      await BookCopy.create({
        bookId: book._id,
        branchId: branch._id,
        barcode: `CT-${Date.now()}-${Math.random()}`,
        status: 'AVAILABLE',
        condition: 'GOOD',
      });

      // Set delivery address near the branch
      await request(app)
        .put(`/api/v1/users/${userId}/location`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          latitude: 17.385,
          longitude: 78.4867,
          street: '123 Test St',
          city: 'Hyderabad',
          pincode: '500001',
        });
    });

    /**
     * TC-CT-6.1: Issue a book for the child profile and verify it appears
     */
    test('TC-CT-6.1 — should track issue against child profileId', async () => {
      // Issue a book for the child
      const issueRes = await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookId: book._id.toString(),
          branchId: branch._id.toString(),
          profileId: childProfileId.toString(),
          type: 'PHYSICAL',
        })
        .expect(201);

      expect(issueRes.body.data.issue.profileId).toBe(childProfileId.toString());

      // Fetch issues filtered by the child profileId
      const res = await request(app)
        .get(`/api/v1/users/${userId}/issues?profileId=${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.results).toBe(1);
      expect(res.body.data.issues[0].profileId).toBe(childProfileId.toString());
    });

    /**
     * TC-CT-6.2: Parent issues should NOT appear in child's filtered list
     */
    test('TC-CT-6.2 — child filter excludes parent issues', async () => {
      // Issue a book under the parent profile
      await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookId: book._id.toString(),
          branchId: branch._id.toString(),
          profileId: parentProfileId.toString(),
          type: 'PHYSICAL',
        })
        .expect(201);

      // Fetch child-filtered issues — should be empty
      const res = await request(app)
        .get(`/api/v1/users/${userId}/issues?profileId=${childProfileId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.results).toBe(0);
      expect(res.body.data.issues).toEqual([]);
    });

    /**
     * TC-CT-6.3: Unfiltered issues returns all profiles' issues
     */
    test('TC-CT-6.3 — unfiltered returns all issues across profiles', async () => {
      // Issue under child profile
      await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookId: book._id.toString(),
          branchId: branch._id.toString(),
          profileId: childProfileId.toString(),
          type: 'PHYSICAL',
        })
        .expect(201);

      // Need another available copy for the second issue
      await BookCopy.create({
        bookId: book._id,
        branchId: branch._id,
        barcode: `CT2-${Date.now()}-${Math.random()}`,
        status: 'AVAILABLE',
        condition: 'GOOD',
      });

      // Issue under parent profile
      await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookId: book._id.toString(),
          branchId: branch._id.toString(),
          profileId: parentProfileId.toString(),
          type: 'PHYSICAL',
        })
        .expect(201);

      // Unfiltered — both issues should appear
      const res = await request(app)
        .get(`/api/v1/users/${userId}/issues`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.results).toBe(2);
    });

    /**
     * TC-CT-6.4: Filter by status=ISSUED
     */
    test('TC-CT-6.4 — filter issues by status', async () => {
      await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookId: book._id.toString(),
          branchId: branch._id.toString(),
          profileId: childProfileId.toString(),
          type: 'PHYSICAL',
        })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/users/${userId}/issues?profileId=${childProfileId}&status=ISSUED`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.results).toBe(1);
      expect(res.body.data.issues[0].status).toBe('ISSUED');
    });

    /**
     * TC-CT-6.5: Filter by status=RETURNED returns empty for active issue
     */
    test('TC-CT-6.5 — RETURNED filter returns nothing for active issue', async () => {
      await request(app)
        .post('/api/v1/issues')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookId: book._id.toString(),
          branchId: branch._id.toString(),
          profileId: childProfileId.toString(),
          type: 'PHYSICAL',
        })
        .expect(201);

      const res = await request(app)
        .get(`/api/v1/users/${userId}/issues?profileId=${childProfileId}&status=RETURNED`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.results).toBe(0);
    });
  });
});
