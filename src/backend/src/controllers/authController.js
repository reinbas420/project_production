const authService = require("../services/authService");
const emailVerificationService = require("../services/emailVerificationService");
const catchAsync = require("../utils/catchAsync");

/**
 * Check if email is available
 * POST /auth/check-email
 */
exports.checkEmail = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ status: "error", message: "Email is required" });
  }

  const exists = await authService.checkEmailExists(email);
  if (exists) {
    return res.status(200).json({
      status: "success",
      data: { available: false, message: "Email already registered" },
    });
  }

  res.status(200).json({ status: "success", data: { available: true } });
});

/**
 * Send a verification OTP to the given email
 * POST /auth/send-otp
 */
exports.sendOTP = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ status: "error", message: "Email is required" });
  }

  const result = await emailVerificationService.sendVerificationEmail(email);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Verify the OTP for a given email
 * POST /auth/verify-otp
 */
exports.verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ status: "error", message: "Email and OTP are required" });
  }

  await emailVerificationService.verifyOTP(email, otp);

  res.status(200).json({
    status: "success",
    data: { verified: true },
  });
});

/**
 * Register new user
 * POST /auth/register
 */
exports.register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    status: "success",
    data: result,
  });
});

/**
 * Login user
 * POST /auth/login
 */
exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Get current user
 * GET /auth/me
 */
exports.getMe = catchAsync(async (req, res) => {
  const user = await authService.getCurrentUser(req.user._id);

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

/**
 * Logout user
 * POST /auth/logout
 */
exports.logout = catchAsync(async (req, res) => {
  // In JWT-based auth, logout is handled client-side by removing the token
  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

/**
 * Change password
 * PUT /auth/change-password
 */
exports.changePassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const result = await authService.changePassword(
    req.user._id,
    oldPassword,
    newPassword,
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Request password reset
 * POST /auth/forgot-password
 */
exports.forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ status: "error", message: "Email is required" });
  }

  const result = await authService.requestPasswordReset(email);

  res.status(200).json({
    status: "success",
    message: result.message,
  });
});

/**
 * Reset password
 * POST /auth/reset-password
 */
exports.resetPassword = catchAsync(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res
      .status(400)
      .json({
        status: "error",
        message: "Email, OTP, and newPassword are required",
      });
  }

  const result = await authService.resetPassword(email, otp, newPassword);

  res.status(200).json({
    status: "success",
    message: result.message,
  });
});
