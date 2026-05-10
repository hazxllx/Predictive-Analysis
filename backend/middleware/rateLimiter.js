/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting for authentication endpoints to prevent brute-force attacks.
 * Uses express-rate-limit with different configurations for different endpoints.
 */

const rateLimit = require("express-rate-limit");

/**
 * General rate limiter for authentication endpoints
 * - 5 requests per 15 minutes per IP
 * - Prevents brute-force attacks on login/register
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests too
});

/**
 * Stricter rate limiter for login endpoint
 * - 5 requests per 15 minutes per IP
 * - Prevents brute-force password attacks
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: {
    message: "Too many login attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Stricter rate limiter for registration endpoint
 * - 3 requests per hour per IP
 * - Prevents automated account creation spam
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  message: {
    message: "Too many registration attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Rate limiter for password change endpoint
 * - 3 requests per hour per IP
 * - Prevents rapid password changes
 */
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per windowMs
  message: {
    message: "Too many password change attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * General API rate limiter
 * - 100 requests per 15 minutes per IP
 * - Applied to all API endpoints to prevent abuse
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  message: {
    message: "Too many requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

module.exports = {
  authLimiter,
  loginLimiter,
  registerLimiter,
  passwordChangeLimiter,
  apiLimiter,
};