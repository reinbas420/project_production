const axios = require('axios');
const config = require('./index');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Shiprocket API Authentication
 * =====================================================
 *
 * Authenticates with the Shiprocket API and returns a
 * bearer token. Tokens are cached in-memory (valid ~10 days)
 * and auto-refreshed when expired.
 */

let cachedToken = null;
let tokenExpiresAt = 0; // epoch ms

/**
 * Get a valid Shiprocket auth token.
 * Caches the token for 9 days (Shiprocket tokens last ~10 days).
 */
async function getShiprocketToken() {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const { email, password } = config.shiprocket;

  if (!email || !password) {
    throw new Error(
      'Shiprocket credentials missing — set SHIPROCKET_EMAIL & SHIPROCKET_PASSWORD in .env'
    );
  }

  try {
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      { email, password }
    );

    cachedToken = response.data.token;
    // Cache for 9 days (Shiprocket tokens are valid for ~10 days)
    tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;

    console.log('🚀 Shiprocket token acquired');
    return cachedToken;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    console.error('❌ Shiprocket auth failed:', msg);
    throw new Error(`Shiprocket authentication failed: ${msg}`);
  }
}

/**
 * Get an Axios instance pre-configured with the Shiprocket base URL
 * and Authorization header.
 */
async function shiprocketClient() {
  const token = await getShiprocketToken();
  return axios.create({
    baseURL: 'https://apiv2.shiprocket.in/v1/external',
    headers: { Authorization: `Bearer ${token}` }
  });
}

/**
 * Invalidate the cached token (useful after 401 errors).
 */
function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

module.exports = { getShiprocketToken, shiprocketClient, invalidateToken };
