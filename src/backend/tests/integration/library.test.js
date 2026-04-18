/**
 * Integration tests for UC-Add-2: Library Branch Management
 * Based on TestPlan.xls — TC-Add-2.1 through TC-Add-2.8
 */

const request = require('supertest');
const app = require('../../src/app');
const LibraryBranch = require('../../src/models/LibraryBranch');
const mongoose = require('mongoose');

const {
    registerAndLogin,
    createTestOrganization
} = require('../utils/testHelpers');

describe('UC-Add-2: Library Branch Management', () => {
    let adminToken, userToken, librarianToken;
    let org;

    beforeEach(async () => {
        const admin = await registerAndLogin('ADMIN');
        adminToken = admin.token;

        const user = await registerAndLogin('USER');
        userToken = user.token;

        const librarian = await registerAndLogin('LIBRARIAN');
        librarianToken = librarian.token;

        org = await createTestOrganization();
    });

    /**
     * TC-Add-2.1: Admin creates a new library branch with full data
     * POST /api/v1/libraries
     * Expected: 201 Created; branch saved with 2dsphere-indexed location
     */
    test('TC-Add-2.1 — should create a new library branch', async () => {
        const res = await request(app)
            .post('/api/v1/libraries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test Branch TC-2.1',
                address: '456 Library Ave, Hyderabad',
                location: {
                    type: 'Point',
                    coordinates: [78.4867, 17.3850]
                },
                organizationId: org._id.toString(),
                serviceRadiusKm: 8
            })
            .expect(201);

        expect(res.body.status).toBe('success');
        expect(res.body.data.library).toHaveProperty('name', 'Test Branch TC-2.1');
    });

    /**
     * TC-Add-2.2: Admin creates branch with missing required fields (address missing)
     * POST /api/v1/libraries
     * Expected: 400 Bad Request; validation error
     */
    test('TC-Add-2.2 — should reject branch creation with missing fields', async () => {
        const res = await request(app)
            .post('/api/v1/libraries')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Incomplete Branch'
                // missing address and location
            })
            .expect(400);

        expect(res.body.status).toBe('fail');
    });

    /**
     * TC-Add-2.3: Get all active libraries
     * GET /api/v1/libraries
     * Expected: 200 OK; list of active libraries
     */
    test('TC-Add-2.3 — should return list of active libraries', async () => {
        // Seed a branch so the list is non-empty
        await LibraryBranch.create({
            name: 'Active Branch',
            address: '123 Active St',
            status: 'ACTIVE'
        });

        const res = await request(app)
            .get('/api/v1/libraries')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data.libraries)).toBe(true);
        expect(res.body.data.libraries.length).toBeGreaterThan(0);
    });

    /**
     * TC-Add-2.4: Get nearby libraries within 8 km of test coordinates
     * GET /api/v1/libraries/nearby?lat=X&lng=Y&maxDistance=8
     * Expected: 200 OK; libraries within specified radius returned
     */
    test('TC-Add-2.4 — should return nearby libraries within radius', async () => {
        await LibraryBranch.create({
            name: 'Nearby Branch',
            address: '789 Close St, Hyderabad',
            location: {
                type: 'Point',
                coordinates: [78.4900, 17.3860]
            },
            status: 'ACTIVE'
        });

        // Ensure the 2dsphere index is built
        await LibraryBranch.ensureIndexes();

        const res = await request(app)
            .get('/api/v1/libraries/nearby')
            .query({ lat: 17.3850, lng: 78.4867, maxDistance: 8 })
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(Array.isArray(res.body.data.libraries)).toBe(true);
        expect(res.body.data.libraries.length).toBeGreaterThan(0);
    });

    /**
     * TC-Add-2.5: Get nearby libraries with remote coordinates (no matches)
     * GET /api/v1/libraries/nearby
     * Expected: 200 OK; empty list
     */
    test('TC-Add-2.5 — should return empty list for remote coordinates', async () => {
        // Create a branch in Hyderabad
        await LibraryBranch.create({
            name: 'Hyderabad Branch',
            address: '123 Hyd St',
            location: {
                type: 'Point',
                coordinates: [78.4867, 17.3850]
            },
            status: 'ACTIVE'
        });

        await LibraryBranch.ensureIndexes();

        const res = await request(app)
            .get('/api/v1/libraries/nearby')
            .query({ lat: -33.8688, lng: 151.2093, maxDistance: 1 }) // Sydney, Australia
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.libraries).toHaveLength(0);
    });

    /**
     * TC-Add-2.6: Admin updates a library with new fields
     * PUT /api/v1/libraries/:libraryId
     * Expected: 200 OK; branch details updated
     */
    test('TC-Add-2.6 — should update library details', async () => {
        const branchToUpdate = await LibraryBranch.create({
            name: 'Update Me Branch',
            address: '000 Old Address',
            status: 'ACTIVE'
        });

        const res = await request(app)
            .put(`/api/v1/libraries/${branchToUpdate._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Updated Branch Name', address: '111 New Address' })
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.library.name).toBe('Updated Branch Name');
        expect(res.body.data.library.address).toBe('111 New Address');
    });

    /**
     * TC-Add-2.7: Non-ADMIN (USER) attempts to create a branch
     * POST /api/v1/libraries
     * Expected: 403 Forbidden
     */
    test('TC-Add-2.7 — should forbid USER from creating a branch', async () => {
        const res = await request(app)
            .post('/api/v1/libraries')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                name: 'Unauthorized Branch',
                address: '999 Forbidden St',
                location: { type: 'Point', coordinates: [78.4867, 17.3850] }
            })
            .expect(403);

        expect(res.body.status).toBe('fail');
    });

    /**
     * TC-Add-2.7b: Non-ADMIN (LIBRARIAN) attempts to create a branch
     * POST /api/v1/libraries
     * Expected: 403 Forbidden
     */
    test('TC-Add-2.7b — should forbid LIBRARIAN from creating a branch', async () => {
        const res = await request(app)
            .post('/api/v1/libraries')
            .set('Authorization', `Bearer ${librarianToken}`)
            .send({
                name: 'Unauthorized Branch',
                address: '999 Forbidden St',
                location: { type: 'Point', coordinates: [78.4867, 17.3850] }
            })
            .expect(403);

        expect(res.body.status).toBe('fail');
    });

    /**
     * TC-Add-2.8: Get a library by its ID
     * GET /api/v1/libraries/:libraryId
     * Expected: 200 OK; library object returned
     */
    test('TC-Add-2.8 — should return a library by ID', async () => {
        const branchForGet = await LibraryBranch.create({
            name: 'Get By ID Branch',
            address: '222 Fetch St',
            status: 'ACTIVE'
        });

        const res = await request(app)
            .get(`/api/v1/libraries/${branchForGet._id}`)
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.library.name).toBe('Get By ID Branch');
    });
});
