const config = require('../config');

/**
 * =====================================================
 * PLATFORM SERVICES LAYER — Aryan
 * Background Jobs — Bull Queue Manager
 * =====================================================
 *
 * Provides robust, Redis-backed job queues for:
 *   - Daily penalty calculations
 *   - Due-date reminder notifications
 *   - Delivery status polling
 *   - Reservation availability checks
 *
 * Stack: Bull Queue + Redis
 * Falls back to in-memory node-cron when Redis is unavailable.
 */

// ── Queue Definitions ──────────────────────────────────

let penaltyQueue, notificationQueue, deliveryQueue, reservationQueue;
let bullAvailable = false;

const initQueues = async () => {
  // First check if Redis is reachable before creating queues
  const net = require('net');
  const redisHost = config.redis.host || '127.0.0.1';
  const redisPort = config.redis.port || 6379;

  const isRedisUp = await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket
      .on('connect', () => { socket.destroy(); resolve(true); })
      .on('timeout', () => { socket.destroy(); resolve(false); })
      .on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(redisPort, redisHost);
  });

  if (!isRedisUp) {
    console.warn('⚠️  Redis not reachable — Bull queues disabled (using node-cron fallback)');
    bullAvailable = false;
    return;
  }

  try {
    const Queue = require('bull');

    const REDIS_CONFIG = {
      host: redisHost,
      port: redisPort,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 3
    };

    penaltyQueue = new Queue('penalty-processing', { redis: REDIS_CONFIG });
    notificationQueue = new Queue('notification-dispatch', { redis: REDIS_CONFIG });
    deliveryQueue = new Queue('delivery-status', { redis: REDIS_CONFIG });
    reservationQueue = new Queue('reservation-check', { redis: REDIS_CONFIG });

    // Attach shared event listeners
    [penaltyQueue, notificationQueue, deliveryQueue, reservationQueue].forEach(
      (q) => {
        q.on('error', (err) =>
          console.error(`❌ Queue "${q.name}" error:`, err.message)
        );
        q.on('failed', (job, err) =>
          console.error(`❌ Job ${job.id} in "${q.name}" failed:`, err.message)
        );
      }
    );

    bullAvailable = true;
    console.log('🐂 Bull queues initialized (Redis-backed)');
  } catch (error) {
    console.warn('⚠️  Bull queue init failed — using node-cron fallback');
    bullAvailable = false;
  }
};

// ── Queue Getters ──────────────────────────────────────

exports.getPenaltyQueue = () => penaltyQueue;
exports.getNotificationQueue = () => notificationQueue;
exports.getDeliveryQueue = () => deliveryQueue;
exports.getReservationQueue = () => reservationQueue;
exports.isBullAvailable = () => bullAvailable;

// ── Job Scheduling Helpers ─────────────────────────────

/**
 * Enqueue a penalty-processing job
 */
exports.addPenaltyJob = async (data = {}) => {
  if (!bullAvailable) return null;
  return penaltyQueue.add('process-overdue', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 50
  });
};

/**
 * Enqueue a notification job
 */
exports.addNotificationJob = async (data) => {
  if (!bullAvailable) return null;
  return notificationQueue.add('send-notification', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100
  });
};

/**
 * Enqueue a delivery-status polling job
 */
exports.addDeliveryStatusJob = async (data) => {
  if (!bullAvailable) return null;
  return deliveryQueue.add('check-delivery', data, {
    attempts: 2,
    removeOnComplete: 30
  });
};

/**
 * Enqueue a reservation-availability check
 */
exports.addReservationCheckJob = async (data) => {
  if (!bullAvailable) return null;
  return reservationQueue.add('check-reservation', data, {
    attempts: 2,
    removeOnComplete: 30
  });
};

/**
 * Gracefully close all queues
 */
exports.closeAllQueues = async () => {
  if (!bullAvailable) return;
  await Promise.all([
    penaltyQueue.close(),
    notificationQueue.close(),
    deliveryQueue.close(),
    reservationQueue.close()
  ]);
  console.log('🐂 All Bull queues closed');
};

/**
 * Initialize queues (call before using any queue)
 */
exports.initQueues = initQueues;
