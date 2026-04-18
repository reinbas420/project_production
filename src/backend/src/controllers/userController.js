const userService = require("../services/userService");
const circulationService = require("../services/circulationService");
const catchAsync = require("../utils/catchAsync");

/**
 * Get user by ID
 * GET /users/:id
 */
exports.getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

/**
 * Update user
 * PUT /users/:id
 */
exports.updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

/**
 * Create child profile
 * POST /users/:parentId/children
 */
exports.createChildProfile = catchAsync(async (req, res) => {
  const profile = await userService.createChildProfile(
    req.params.parentId,
    req.body,
  );

  res.status(201).json({
    status: "success",
    data: { profile },
  });
});

/**
 * Get child profiles
 * GET /users/:parentId/children
 */
exports.getChildProfiles = catchAsync(async (req, res) => {
  const profiles = await userService.getChildProfiles(req.params.parentId);

  res.status(200).json({
    status: "success",
    data: { profiles },
  });
});

/**
 * Update profile
 * PUT /users/:userId/profiles/:profileId
 */
exports.updateProfile = catchAsync(async (req, res) => {
  const profile = await userService.updateProfile(
    req.params.userId,
    req.params.profileId,
    req.body,
  );

  res.status(200).json({
    status: "success",
    data: { profile },
  });
});

/**
 * Delete profile
 * DELETE /users/:userId/profiles/:profileId
 */
exports.deleteProfile = catchAsync(async (req, res) => {
  const result = await userService.deleteProfile(
    req.params.userId,
    req.params.profileId,
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Get reading history
 * GET /users/:userId/profiles/:profileId/history
 */
exports.getReadingHistory = catchAsync(async (req, res) => {
  const history = await userService.getReadingHistory(
    req.params.userId,
    req.params.profileId,
  );

  res.status(200).json({
    status: "success",
    data: { history },
  });
});

/**
 * Delete account
 * DELETE /users/:id
 */
exports.deleteAccount = catchAsync(async (req, res) => {
  await userService.deleteAccount(req.params.id);

  res.status(200).json({
    status: 'success',
    data: { message: 'Account deleted successfully' },
  });
});

/**
 * Get all issues for a user (across all profiles or filtered by profileId)
 * GET /users/:id/issues?profileId=xxx&status=ISSUED
 */
exports.getUserIssues = catchAsync(async (req, res) => {
  const filters = {
    status: req.query.status,
    profileId: req.query.profileId,
  };
  const issues = await circulationService.getUserIssues(req.params.id, filters);
  res.status(200).json({
    status: "success",
    results: issues.length,
    data: { issues },
  });
});

/**
 * Handle delivery location updates (add new address)
 */
exports.updateDeliveryLocation = catchAsync(async (req, res) => {
  const user = await userService.updateDeliveryLocation(
    req.params.id,
    req.body,
  );
  res.status(200).json({
    status: "success",
    data: {
      user: {
        id: user._id,
        deliveryAddress: user.deliveryAddress,
        deliveryAddresses: user.deliveryAddresses,
      },
    },
  });
});

/**
 * Get all saved delivery addresses
 */
exports.getDeliveryAddresses = catchAsync(async (req, res) => {
  const addresses = await userService.getDeliveryAddresses(req.params.id);
  res.status(200).json({
    status: "success",
    data: { addresses },
  });
});

/**
 * Delete a saved delivery address
 */
exports.deleteDeliveryAddress = catchAsync(async (req, res) => {
  const addresses = await userService.deleteDeliveryAddress(
    req.params.id,
    req.params.addressId,
  );
  res.status(200).json({
    status: "success",
    data: { addresses },
  });
});

/**
 * Set a delivery address as the default
 */
exports.setDefaultDeliveryAddress = catchAsync(async (req, res) => {
  const addresses = await userService.setDefaultDeliveryAddress(
    req.params.id,
    req.params.addressId,
  );
  res.status(200).json({
    status: "success",
    data: { addresses },
  });
});

/**
 * Check if the user is eligible for delivery (within radius)
 */
exports.checkDeliveryEligibility = catchAsync(async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) {
    return res
      .status(400)
      .json({ status: "fail", message: "branchId query param is required" });
  }
  const eligible = await userService.isUserWithinDeliveryZone(
    req.params.id,
    branchId,
  );
  res.status(200).json({
    status: "success",
    data: {
      eligible,
    },
  });
});

/**
 * Log user activity (views, searches)
 * POST /users/:userId/profiles/:profileId/activity
 */
exports.logActivity = catchAsync(async (req, res) => {
  const { bookId, action } = req.body;
  const user = await require('../models/User').findOne({ 
    _id: req.params.userId,
    "profiles.profileId": req.params.profileId 
  });
  if (!user) {
    return res.status(404).json({ status: "fail", message: "User or profile not found" });
  }
  
  const profile = user.profiles.find(p => p.profileId.toString() === req.params.profileId);
  if (profile) {
    profile.recentActivity.push({ bookId, action: action || 'VIEW' });
    if (profile.recentActivity.length > 20) {
      profile.recentActivity = profile.recentActivity.slice(-20);
    }
    await user.save();
  }
  
  res.status(200).json({ status: "success", data: null });
});

