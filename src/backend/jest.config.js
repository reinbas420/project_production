module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!src/models/**',
    '!src/services/paymentService.js',      // Requires MySQL - tested separately
    '!src/services/penaltyService.js',      // Requires MySQL - tested separately
    '!src/services/deliveryService.js',         // Requires live Porter API
    '!src/services/deliveryService.stub.js',    // Superseded by mock
    '!src/services/deliveryService.mock.js',    // In-memory mock; covered by integration tests
    '!src/services/bookMetadataService.js',      // Makes real HTTP calls to Google Books / Open Library
    '!src/services/emailVerificationService.js', // Sends real emails via SMTP; not unit-testable
    '!src/services/notificationService.js',      // Requires Firebase Admin SDK
    '!src/services/queueService.js',             // Requires Redis / Bull
    '!src/jobs/backgroundJobs.js',               // Cron + Bull workers; not unit-testable
    '!src/utils/cronJobs.js'                     // Cron scheduler - not unit-testable
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 19,
      lines: 44,
      statements: 44
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000
};
