/**
 * App-wide configuration.
 * EXPO_PUBLIC_* vars are baked in at bundle time (they appear in .env).
 * Hardcoded fallback points to dev backend on same machine.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';
