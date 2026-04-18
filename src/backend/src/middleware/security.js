const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan 2
 * Authentication & Security Middleware
 * =====================================================
 *
 * Layers:
 *   • Helmet — HTTP security headers (HSTS, CSP, etc.)
 *   • Rate Limiting — brute-force protection
 *   • JWT best-practices — already in auth.js
 *   • Secure env variable validation
 */

// ── Helmet (security headers) ──────────────────────────

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // needed for mobile clients
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
});

// ── Rate Limiters ──────────────────────────────────────

// Skip rate limiting entirely in test or development environment
const isTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

/**
 * General API rate limiter — 1000 req / 15 min per IP
 */
const apiLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 'error',
        message: 'Too many requests — please try again after 15 minutes'
      }
    });

/**
 * Auth rate limiter — 100 req / 15 min per IP (login, register)
 */
const authLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        status: 'error',
        message: 'Too many authentication attempts — please try again later'
      }
    });

/**
 * Strict rate limiter — 5 req / 15 min (password reset, etc.)
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Rate limit exceeded — please try again later'
  }
});

// ── Environment Variable Validation ────────────────────

/**
 * Validate critical env vars at startup
 * Throws if any required secret is missing in production
 */
const validateEnvSecrets = () => {
  const required = ['JWT_SECRET'];
  const warnings = [];
  const errors = [];

  for (const key of required) {
    if (!process.env[key] || process.env[key].includes('default') || process.env[key].includes('change')) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(`❌ ${key} must be set to a secure value in production`);
      } else {
        warnings.push(`⚠️  ${key} is using a default/insecure value`);
      }
    }
  }

  const recommended = [
    'FIREBASE_PROJECT_ID',
    'RAZORPAY_KEY_ID'
  ];

  for (const key of recommended) {
    if (!process.env[key] || process.env[key].startsWith('your_')) {
      warnings.push(`ℹ️  ${key} not configured (feature will be disabled)`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n🔒 Security Checks:');
    warnings.forEach((w) => console.log(`   ${w}`));
  }

  if (errors.length > 0) {
    console.error('\n🚨 SECURITY ERRORS:');
    errors.forEach((e) => console.error(`   ${e}`));
    throw new Error('Critical environment variables missing — cannot start in production');
  }
};

// ── HTTPS Redirect (for cloud deployments) ─────────────

const enforceHTTPS = (req, res, next) => {
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};

module.exports = {
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  strictLimiter,
  validateEnvSecrets,
  enforceHTTPS
};
