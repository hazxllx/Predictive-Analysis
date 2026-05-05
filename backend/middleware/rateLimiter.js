const rateLimit = require("express-rate-limit");

/**
 * // protect PMS endpoint
 * Rate limiter for external PMS integration endpoint.
 */
const pmsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from PMS. Please retry later.",
  },
});

module.exports = { pmsRateLimiter };
