require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",

  // MongoDB
  mongodb: {
    uri:
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/hyper-local-library",
    testUri:
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/hyper-local-library-test",
  },

  // MySQL
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "library_transactions",
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || "default-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  // Business Rules
  business: {
    deliveryRadiusKm: parseFloat(process.env.DELIVERY_RADIUS_KM) || 8,
    lateFeePerDay: parseFloat(process.env.LATE_FEE_PER_DAY) || 10,
    gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS) || 2,
    defaultBorrowPeriodDays:
      parseInt(process.env.DEFAULT_BORROW_PERIOD_DAYS) || 14,
  },

  // AI API
  ai: {
    apiUrl: process.env.AI_API_URL || "http://localhost:8000/recommend",
    apiKey: process.env.AI_API_KEY || "",
  },

  // Google Books API (for ISBN metadata lookup)
  googleBooks: {
    apiKey: process.env.GOOGLE_BOOKS_API_KEY || '',
  },

  // Payment Gateway
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  },

  // Delivery Service (Porter — hyperlocal gig, Hyderabad)
  delivery: {
    provider:    process.env.DELIVERY_PROVIDER    || 'PORTER',
    apiUrl:      process.env.DELIVERY_API_URL     || 'https://api.porter.in/v1',
    apiKey:      process.env.DELIVERY_API_KEY     || '',
    hmacSecret:  process.env.DELIVERY_HMAC_SECRET || '',
  },

  // SMTP (email)
  // Leave SMTP_HOST empty to auto-use Ethereal test accounts in development.
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || '"Cloud Library" <noreply@cloudlibrary.dev>',
  },

  // ── Platform Services Layer — Aryan ──────────────────

  // Firebase Cloud Messaging (Push Notifications)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  },

  // Redis (Bull Queue backend)
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },

  // Hosting / Cloud
  hosting: {
    provider: process.env.HOSTING_PROVIDER || 'render', // render | railway | aws
    region: process.env.HOSTING_REGION || 'ap-south-1',
  },

  // Shiprocket (Shipping & Logistics)
  shiprocket: {
    email: process.env.SHIPROCKET_EMAIL || '',
    password: process.env.SHIPROCKET_PASSWORD || '',
  },

  // AWS S3
  s3: {
    accessKeyId:     process.env.AWS_ACCESS_KEY || '',
    secretAccessKey: process.env.AWS_SECRET     || '',
    bucket:          process.env.AWS_BUCKET     || '',
    region:          process.env.AWS_REGION     || 'ap-south-1',
  },
};
