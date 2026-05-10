/**
 * Authentication Routes
 *
 * Routes for authentication endpoints.
 * Business logic is handled by authController.
 *
 * Endpoints:
 * - POST /auth/register - Register a new user
 * - POST /auth/login - Login (local or Predictive subsystem admin)
 * - GET /auth/me - Get current user session
 * - PATCH /auth/me - Update own profile
 * - POST /auth/change-password - Change password
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
} = require("../controllers/authController");
const {
  sanitizeBody,
  normalizeAuthFields,
  registerValidators,
  loginValidators,
  changePasswordValidators,
} = require("../middleware/validate");
const { loginLimiter, registerLimiter, passwordChangeLimiter } = require("../middleware/rateLimiter");

router.post("/register", registerLimiter, sanitizeBody, normalizeAuthFields, registerValidators, register);
router.post("/login", loginLimiter, sanitizeBody, normalizeAuthFields, loginValidators, login);
router.get("/me", protect, getMe);
router.patch("/me", protect, sanitizeBody, normalizeAuthFields, updateProfile);
router.post("/change-password", protect, passwordChangeLimiter, sanitizeBody, changePasswordValidators, changePassword);

module.exports = router;
