/**
 * Centralized Environment Configuration Loader
 *
 * Responsibilities:
 * - Loads environment variables from a single root `.env` file
 * - Validates required variables at startup (fail-fast behavior)
 * - Exports a typed, read-only config object for use across the backend
 * - Ensures backend secrets are NEVER exposed to the frontend
 *
 * Loading strategy:
 * - Resolves the root `.env` using an absolute path from `process.cwd()`
 * - Uses dotenv to populate `process.env` before any other module runs
 * - Supports both development and production deployments (Vercel, Render, Railway)
 *
 * Deployment notes:
 * - On PaaS platforms (Vercel, Render, Railway), env vars are injected at runtime
 *   and the `.env` file may not exist. dotenv will silently skip missing files.
 * - Always set required env vars in the platform dashboard.
 */

const path = require("path");

// Resolve the root `.env` absolutely from this module's location.
// env.js lives at backend/config/env.js, so ../../ reaches the project root.
const rootEnvPath = path.resolve(__dirname, "../../.env");

// Load before any other module consumes process.env.
require("dotenv").config({ path: rootEnvPath });

/**
 * Required backend variables.
 * The application will refuse to start if any of these are missing.
 */
const REQUIRED_BACKEND_VARS = [
  "MONGODB_URI",
  "JWT_SECRET",
  "API_KEY",
  "PMS_API_KEY",
];

/**
 * Optional backend variables with safe defaults.
 */
const OPTIONAL_DEFAULTS = {
  PORT: "5000",
  NODE_ENV: "development",
  PMS_BASE_URL: "https://pms-backend-kohl.vercel.app/api/v1/external",
  PMS_CACHE_TTL_MS: "120000",
  ADMIN_SUBSYSTEM_NAME: "Predictive",
};

/**
 * Validate required environment variables.
 * Throws on missing values so the app fails fast with a clear message.
 */
function validateEnv() {
  const missing = [];

  for (const key of REQUIRED_BACKEND_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "" || value.includes("your_")) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message = [
      "[ENV ERROR] The following required environment variables are missing or unset:",
      ...missing.map((k) => `  - ${k}`),
      ``,
      `Ensure they are defined in the root .env file or in your deployment platform's environment settings.`,
      `Root .env path: ${rootEnvPath}`,
    ].join("\n");

    // eslint-disable-next-line no-console
    console.error(message);
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

/**
 * Build the centralized config object.
 * Uses process.env directly with explicit defaults for optional values.
 */
function buildConfig() {
  return {
    // Server
    port: parseInt(process.env.PORT || OPTIONAL_DEFAULTS.PORT, 10),
    nodeEnv: process.env.NODE_ENV || OPTIONAL_DEFAULTS.NODE_ENV,

    // Database
    mongodbUri: process.env.MONGODB_URI,

    // JWT
    jwtSecret: process.env.JWT_SECRET,

    // Pulse Prophet API key (for internal PMS middleware)
    apiKey: process.env.API_KEY,

    // PMS Integration
    pmsApiKey: process.env.PMS_API_KEY,
    pmsBaseUrl: process.env.PMS_BASE_URL || OPTIONAL_DEFAULTS.PMS_BASE_URL,
    pmsCacheTtlMs: Number(process.env.PMS_CACHE_TTL_MS || OPTIONAL_DEFAULTS.PMS_CACHE_TTL_MS),

    // Admin Subsystem
    adminSubsystemBaseUri: process.env.ADMIN_SUBSYSTEM_BASE_URI,
    adminSubsystemApiKey: process.env.ADMIN_SUBSYSTEM_API_KEY,
    adminSubsystemName: process.env.ADMIN_SUBSYSTEM_NAME || OPTIONAL_DEFAULTS.ADMIN_SUBSYSTEM_NAME,
  };
}

// Run validation immediately on module load.
validateEnv();

/**
 * Centralized, validated configuration object.
 * Import this module at the TOP of server.js before anything else.
 */
const config = buildConfig();

module.exports = { config, rootEnvPath };
