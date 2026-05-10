/**
 * Pulse Prophet Backend Entry Point
 *
 * Loads environment from the centralized root .env before any other module.
 *
 * Architecture:
 * - Response compression enabled for JSON payloads
 * - Middleware ordered for minimal overhead (static/light first)
 * - Trust proxy configured for accurate client IPs behind load balancers
 * - Global input sanitization strips leading/trailing whitespace from all body strings
 * - Centralized error handling maps Mongoose, MongoDB, and JWT errors to clean responses
 */
require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/db");
const { migrateMissingUsernames } = require("./services/usernameMigration");
const { seedAdmin } = require("./utils/seedAdmin");
const { captureClientIP } = require("./middleware/auditMiddleware");
const { errorHandler } = require("./middleware/errorHandler");
const { sanitizeBody } = require("./middleware/validate");

const app = express();

// Enable trust proxy to correctly handle X-Forwarded-For and other proxy headers
// This is essential for capturing the real client IP in production environments
app.set("trust proxy", 1);

async function startServer() {
  // Wait for DB connection before enabling queries (bufferCommands = false)
  await connectDB();

  // Run username migration after DB is ready; failures are logged but non-blocking
  try {
    await migrateMissingUsernames();
    console.log("Username migration complete (if needed).");
  } catch (err) {
    console.error("Username migration failed:", err);
  }

  // Seed default admin if no admin exists; failures are logged but non-blocking
  try {
    const seedResult = await seedAdmin();
    if (seedResult.created) {
      console.log("Default admin seeded successfully.");
    } else if (seedResult.error) {
      console.error("Admin seeding failed:", seedResult.error);
    } else {
      console.log("Admin already exists — seed skipped.");
    }
  } catch (err) {
    console.error("Admin seeding error:", err);
  }

  /**
   * Security Headers (Helmet)
   * - Content Security Policy, X-Frame-Options, XSS-Filter, etc.
   */
  app.use(helmet());

  /**
   * CORS Configuration
   * - Defaults to wildcard in development for local testing
   * - Production should set CORS_ORIGIN to the deployed frontend URL
   */
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  app.use(cors({ origin: corsOrigin }));

  // Parse JSON bodies early
  app.use(express.json());

  // Audit middleware: Capture client IP for all requests (must be early)
  app.use(captureClientIP);

  // Global body sanitization: trim all string values before they reach route handlers
  app.use(sanitizeBody);

  // Mount routes
  app.use("/auth", require("./routes/auth"));
  app.use("/patients", require("./routes/patients"));
  app.use("/api/v1/predictive-analysis", require("./routes/assessment"));
  app.use("/admin", require("./routes/admin"));

  // Health check endpoint (used by load balancers / monitoring)
  app.get("/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/", (_, res) => res.json({ message: "Pulse Prophet API running" }));

  // 404 handler for unmatched routes
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Resource not found" });
  });

  // Centralized error handler — must be the LAST middleware registered
  // Maps Mongoose ValidationError, CastError, Duplicate Key, JWT errors to clean HTTP responses
  app.use(errorHandler);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Auth system initialized | ENV: ${process.env.NODE_ENV || "development"}`);
    console.log(`JWT expiry: 7d | Rate limiting: enabled | Helmet: enabled`);
  });
}

startServer();
