/**
 * Shared test helpers for integration tests.
 * Provides reusable functions to register users, create test data, etc.
 */

const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');

const Book = require('../../src/models/Book');
const LibraryBranch = require('../../src/models/LibraryBranch');
const Organization = require('../../src/models/Organization');
const Issue = require('../../src/models/Issue');
const BookCopy = require('../../src/models/BookCopy');
const User = require('../../src/models/User');
const Auth = require('../../src/models/Auth');

/**
 * Register a user and return { token, userId, email }.
 * @param {'USER'|'LIBRARIAN'|'ADMIN'} role
 */
async function registerAndLogin(role = 'USER') {
  const unique = Date.now() + Math.random().toString(36).slice(2, 6);
  const email = `testuser_${unique}@example.com`;
  const password = 'password123';

  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password,
      phone: '9876543210',
      name: `Test ${role}`,
      role,
      preferredGenres: ['Fiction']
    });

  return {
    token: res.body.data.token,
    userId: res.body.data.user.id,
    email,
    password
  };
}

/**
 * Create a test Book document directly in MongoDB.
 * Returns the created book document.
 */
async function createTestBook() {
  return Book.create({
    title: `Test Book ${Date.now()}`,
    author: 'Test Author',
    isbn: Math.floor(Math.random() * 9000000000000) + 1000000000000,
    genre: ['Fiction'],
    language: 'English',
    ageRating: '6-12',
    summary: 'A test book for integration testing.'
  });
}

/**
 * Create a test Organization.
 */
async function createTestOrganization() {
  return Organization.create({
    name: `Test Org ${Date.now()}`,
    status: 'ACTIVE'
  });
}

/**
 * Create a test LibraryBranch with geospatial coordinates.
 * @param {string} [orgId] - Optional organization ID
 * @param {number[]} [coordinates] - [lng, lat], defaults to Hyderabad
 */
async function createTestBranch(orgId, coordinates = [78.4867, 17.3850]) {
  const data = {
    name: `Test Branch ${Date.now()}`,
    address: '123 Test Street, Hyderabad',
    location: {
      type: 'Point',
      coordinates
    },
    status: 'ACTIVE',
    serviceRadiusKm: 8
  };
  if (orgId) data.organizationId = orgId;
  return LibraryBranch.create(data);
}

/**
 * Create a test Issue record.
 */
async function createTestIssue(userId, copyId, profileId) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  return Issue.create({
    userId,
    copyId,
    profileId: profileId || new mongoose.Types.ObjectId(),
    issueDate: new Date(),
    dueDate,
    status: 'ISSUED'
  });
}

/**
 * Delete specific documents by their _id from a given model.
 * Only removes the documents created during testing.
 */
async function cleanupDocuments(model, ids) {
  if (ids && ids.length > 0) {
    await model.deleteMany({ _id: { $in: ids } });
  }
}

/**
 * Delete a user and associated auth record by userId.
 */
async function cleanupUser(userId) {
  if (!userId) return;
  await User.findByIdAndDelete(userId);
  await Auth.deleteMany({ userId });
}

module.exports = {
  registerAndLogin,
  createTestBook,
  createTestOrganization,
  createTestBranch,
  createTestIssue,
  cleanupDocuments,
  cleanupUser
};
