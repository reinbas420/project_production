const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');
const config = require('../config');

/**
 * Protect routes - verify JWT token
 */
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token from header
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }
  
  // 2) Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again.', 401));
  }
  
  // 3) Check if user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }
  
  // 4) Check if user is active
  if (user.status !== 'ACTIVE') {
    return next(new AppError('Your account has been blocked. Please contact support.', 403));
  }
  
  // Grant access to protected route
  req.user = user;
  next();
});

/**
 * Restrict routes to specific roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

/**
 * Require an active/trialing subscription and optional feature flags.
 * Feature checks are backward compatible with existing users that do not
 * yet have a subscription object persisted.
 */
exports.requireActiveSubscription = (...requiredFeatures) => {
  return (req, res, next) => {
    // Staff roles bypass subscriber gates.
    if (['ADMIN', 'LIBRARIAN'].includes(req.user.role)) {
      return next();
    }

    const subscription = req.user.subscription || {};
    const status = String(subscription.status || 'ACTIVE').toUpperCase();
    const allowedStatuses = ['ACTIVE', 'TRIALING'];

    if (!allowedStatuses.includes(status)) {
      return next(new AppError('An active subscription is required for this feature.', 403));
    }

    if (subscription.currentPeriodEnd) {
      const endsAt = new Date(subscription.currentPeriodEnd).getTime();
      if (!Number.isNaN(endsAt) && endsAt < Date.now()) {
        return next(new AppError('Your subscription has expired. Please renew to continue.', 403));
      }
    }

    if (requiredFeatures.length === 0 || !subscription.features) {
      return next();
    }

    const missingFeature = requiredFeatures.find(
      (feature) => subscription.features[feature] !== true,
    );

    if (missingFeature) {
      return next(
        new AppError(
          `Your current plan does not include ${missingFeature}. Please upgrade your subscription.`,
          403,
        ),
      );
    }

    next();
  };
};

/**
 * Check if profile belongs to logged-in user
 */
exports.verifyProfileOwnership = catchAsync(async (req, res, next) => {
  const profileId = req.params.profileId || req.body.profileId;
  
  if (!profileId) {
    return next();
  }
  
  const userProfile = req.user.profiles.find(
    p => p.profileId.toString() === profileId.toString()
  );
  
  if (!userProfile && req.user.role !== 'ADMIN') {
    return next(new AppError('You do not have access to this profile', 403));
  }
  
  req.profile = userProfile;
  next();
});
