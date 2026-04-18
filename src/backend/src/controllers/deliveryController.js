const catchAsync = require('../utils/catchAsync');
const AppError   = require('../utils/AppError');
const config     = require('../config');
// Auto-select delivery implementation based on Porter API key presence
const deliveryService = config.delivery.apiKey
  ? require('../services/deliveryService')
  : require('../services/deliveryService.mock');

/**
 * GET /api/v1/delivery/my
 * Returns all deliveries for the logged-in user.
 */
exports.getMyDeliveries = catchAsync(async (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;

  const deliveries = await deliveryService.getUserDeliveries(req.user._id, filters);

  res.status(200).json({
    status:  'success',
    results: deliveries.length,
    data:    { deliveries }
  });
});

/**
 * GET /api/v1/delivery/:deliveryId
 * Returns a single delivery. Users may only see their own.
 */
exports.getDelivery = catchAsync(async (req, res) => {
  const delivery = await deliveryService.getDeliveryById(req.params.deliveryId);

  if (
    req.user.role === 'USER' &&
    delivery.userId._id?.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Not authorized to view this delivery', 403);
  }

  res.status(200).json({ status: 'success', data: { delivery } });
});

/**
 * GET /api/v1/delivery/issue/:issueId
 * Returns the delivery record linked to a book issue.
 */
exports.getDeliveryByIssue = catchAsync(async (req, res) => {
  const delivery = await deliveryService.getDeliveryByIssueId(req.params.issueId);

  if (
    req.user.role === 'USER' &&
    delivery.userId._id?.toString() !== req.user._id.toString()
  ) {
    throw new AppError('Not authorized to view this delivery', 403);
  }

  res.status(200).json({ status: 'success', data: { delivery } });
});

/**
 * PATCH /api/v1/delivery/:deliveryId/dispatch  [LIBRARIAN / ADMIN]
 * Librarian triggers this once the book is packed.
 * Calls the gig provider (Porter) to place a pickup order.
 */
exports.dispatchDelivery = catchAsync(async (req, res) => {
  const result = await deliveryService.dispatchDelivery(req.params.deliveryId);

  res.status(200).json({
    status:  'success',
    message: 'Delivery dispatched — Porter order created',
    data:    result
  });
});

/**
 * PATCH /api/v1/delivery/:deliveryId/status  [LIBRARIAN / ADMIN]
 * Manual status override (e.g., mark as FAILED, CANCELLED, DELIVERED).
 */
exports.updateDeliveryStatus = catchAsync(async (req, res) => {
  const { status } = req.body;
  if (!status) throw new AppError('Please provide a status field in the request body', 400);

  const delivery = await deliveryService.updateDeliveryStatus(
    req.params.deliveryId,
    status
  );

  res.status(200).json({ status: 'success', data: { delivery } });
});

/**
 * PATCH /api/v1/delivery/:deliveryId/cancel  [LIBRARIAN / ADMIN]
 * Cancel a delivery (also calls Porter to cancel the gig order if dispatched).
 */
exports.cancelDelivery = catchAsync(async (req, res) => {
  const { reason } = req.body;
  const delivery = await deliveryService.cancelDelivery(
    req.params.deliveryId,
    reason
  );
  res.status(200).json({ status: 'success', data: { delivery } });
});

/**
 * GET /api/v1/delivery/:deliveryId/sync  [LIBRARIAN / ADMIN]
 * Pull latest status from Porter (for missed webhooks).
 */
exports.syncDeliveryStatus = catchAsync(async (req, res) => {
  const result = await deliveryService.syncDeliveryStatus(req.params.deliveryId);
  res.status(200).json({ status: 'success', data: result });
});

/**
 * POST /api/v1/delivery/webhook  [No auth — called by Porter]
 * In mock mode: HMAC verification is skipped.
 * In production: swap to real deliveryService which verifies HMAC-SHA256.
 */
exports.handleWebhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-porter-signature'] || '';
  const rawBody   = req.rawBody || Buffer.from(JSON.stringify(req.body));

  const result = await deliveryService.processWebhookUpdate(
    rawBody,
    signature,
    req.body
  );

  res.status(200).json({ status: 'success', data: result });
});

// ─── Mock control endpoints (dev/test only — blocked in production by controller)

/**
 * PATCH /api/v1/delivery/mock/:gigOrderId/advance  [LIBRARIAN / ADMIN]
 * Advances the mock delivery to the next Porter event in the lifecycle.
 * Simulates what happens when Porter pushes a webhook.
 */
exports.advanceMockStatus = catchAsync(async (req, res) => {
  if (config.nodeEnv === 'production') {
    throw new AppError('Mock control endpoints are disabled in production', 403);
  }

  const result = await deliveryService.advanceStatus(req.params.gigOrderId);

  res.status(200).json({
    status:  'success',
    message: `Mock: advanced to Porter event '${result.porterEvent}' → status '${result.newStatus}'`,
    data:    result
  });
});

/**
 * GET /api/v1/delivery/mock/orders  [LIBRARIAN / ADMIN]
 * Returns the in-memory mock order registry for inspection.
 */
exports.getMockOrders = catchAsync(async (req, res) => {
  if (config.nodeEnv === 'production') {
    throw new AppError('Mock control endpoints are disabled in production', 403);
  }

  const orders = deliveryService._getMockOrders();
  res.status(200).json({
    status:  'success',
    results: Object.keys(orders).length,
    data:    { orders }
  });
});
