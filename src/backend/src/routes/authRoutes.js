const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { strictLimiter } = require("../middleware/security");
const validate = require("../middleware/validate");
const Joi = require("joi");

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().pattern(/^\d{10}$/).required().messages({
    'string.pattern.base': 'Phone number must be exactly 10 digits',
  }),
  name: Joi.string().required(),
  role: Joi.string().valid("USER", "LIBRARIAN", "ADMIN").default("USER"),
  preferredGenres: Joi.array().items(Joi.string()),
  preferredLanguages: Joi.array().items(Joi.string()),
  questionnaireResponses: Joi.object().unknown(true).optional(),
  profilePreferences: Joi.array()
    .items(
      Joi.object({
        questionId: Joi.string().required(),
        question: Joi.string().allow("", null),
        answer: Joi.alternatives().try(
          Joi.string().allow(""),
          Joi.array().items(Joi.string().allow("")),
        ),
      }),
    )
    .optional(),
  emailVerified: Joi.boolean(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const checkEmailSchema = Joi.object({
  email: Joi.string().email().required(),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const sendOTPSchema = Joi.object({
  email: Joi.string().email().required(),
});

const verifyOTPSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).required(),
});

// Routes
router.post("/send-otp", validate(sendOTPSchema), authController.sendOTP);
router.post("/verify-otp", validate(verifyOTPSchema), authController.verifyOTP);
router.post(
  "/check-email",
  validate(checkEmailSchema),
  authController.checkEmail,
);
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", protect, authController.logout);
router.get("/me", protect, authController.getMe);
router.put(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post(
  "/forgot-password",
  strictLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  strictLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

module.exports = router;
