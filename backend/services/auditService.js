/**
 * Centralized Audit Logging Service
 *
 * Handles all audit log ingestion to the Admin Subsystem.
 * - Non-blocking async logging (uses fire-and-forget pattern)
 * - Automatic timeout protection (prevents hanging requests)
 * - Fallback logging if API fails
 * - Never crashes the application on audit failures
 * - Production-ready error handling
 *
 * Admin API Expectations:
 * - user_id: UUID format (MongoDB ObjectIds are NOT supported)
 * - action_type: Only specific allowed actions
 * - subsystem: Exactly "Predictive"
 * - No timestamp field in payload
 *
 * Note on user_id:
 * The current system uses MongoDB ObjectIds, but the Admin API expects UUIDs.
 * See documentation at the end of this file for mapping guidance.
 *
 * Environment variables required:
 * - ADMIN_AUDIT_API_URL: URL to the Admin Subsystem audit API
 * - SUBSYSTEM_API_KEY: Authorization key for the Admin Subsystem
 */

const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/User");

// Constants
const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds
const SUBSYSTEM_NAME = "Predictive"; // Must be exactly "Predictive"

/**
 * Allowed action types for Admin API.
 * Only these actions are accepted by the Admin Subsystem.
 */
const ALLOWED_ACTIONS = new Set([
  "PATIENT_LOGIN",
  "PATIENT_REGISTER",
  "ASSESSMENT_CREATED",
  "ASSESSMENT_UPDATED",
  "PATIENT_RECORD_UPDATED",
  "PATIENT_RECORD_DELETED",
]);

/**
 * Logs to fallback storage when Admin API fails.
 * In production, this could write to local file, CloudWatch, or external logging service.
 * Currently logs to console for development visibility with error details.
 * @private
 */
const fallbackLogToConsole = (payload, error, apiResponse = null) => {
  const details = {
    timestamp: new Date().toISOString(),
    payload,
  };

  if (error?.message) {
    details.error = error.message;
  }

  if (error?.code) {
    details.errorCode = error.code;
  }

  // Include API response details for validation/HTTP errors
  if (apiResponse?.status) {
    details.apiStatus = apiResponse.status;
    details.apiStatusText = apiResponse.statusText;
  }

  if (apiResponse?.data) {
    details.apiResponse = apiResponse.data;
  }

  // eslint-disable-next-line no-console
  console.warn("[AUDIT FALLBACK]", details);
};

/**
 * Validates the audit log payload before sending to Admin API.
 * Returns validation errors or null if valid.
 * @private
 */
const validatePayload = (payload) => {
  const errors = [];

  if (!payload.user_id || String(payload.user_id).trim() === "") {
    errors.push("user_id is required and cannot be empty");
  }

  if (!payload.action_type || String(payload.action_type).trim() === "") {
    errors.push("action_type is required and cannot be empty");
  } else if (!ALLOWED_ACTIONS.has(payload.action_type)) {
    errors.push(
      `action_type '${payload.action_type}' not in allowed list: ${Array.from(ALLOWED_ACTIONS).join(", ")}`
    );
  }

  if (!payload.ip_addr || String(payload.ip_addr).trim() === "") {
    errors.push("ip_addr is required and cannot be empty");
  }

  if (payload.subsystem !== SUBSYSTEM_NAME) {
    errors.push(`subsystem must be exactly '${SUBSYSTEM_NAME}', got '${payload.subsystem}'`);
  }

  // Check for unsupported fields
  if (payload.timestamp !== undefined) {
    errors.push(
      "timestamp field is not supported by Admin API and must be removed"
    );
  }

  return errors.length > 0 ? errors : null;
};

/**
 * Resolve a raw user_id to an audit_uuid for the Admin API.
 * - If the value is a valid MongoDB ObjectId, look up the user's audit_uuid.
 * - Otherwise return the value as-is (e.g. "UNKNOWN", upstream UUIDs).
 * Errors are swallowed so audit logging never breaks the app.
 * @private
 */
const resolveUserId = async (userId) => {
  try {
    if (!userId || userId === "UNKNOWN") return userId;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findById(userId).select("audit_uuid").lean();
      if (user?.audit_uuid) return user.audit_uuid;
    }
    return userId;
  } catch {
    return userId;
  }
};

/**
 * Sends an audit log to the Admin Subsystem API.
 * This function is non-blocking and will never throw or crash the application.
 *
 * @param {Object} logData - The audit log data
 * @param {string} logData.user_id - User identifier (UUID preferred, see docs for ObjectId mapping)
 * @param {string} logData.action_type - Type of action (must be in ALLOWED_ACTIONS)
 * @param {string} logData.details - Human-readable description of the action
 * @param {string} logData.ip_addr - IP address of the client (captured by middleware)
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Request timeout in milliseconds (default: 5000)
 * @returns {Promise<void>} Always resolves, never rejects
 */
const logAudit = async (logData, options = {}) => {
  try {
    // Validate input
    if (!logData || typeof logData !== "object") {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("[AUDIT] Invalid log data (not an object):", logData);
      }
      return;
    }

    const { timeout = DEFAULT_TIMEOUT_MS } = options;

    // Extract configuration from environment
    const apiUrl = process.env.ADMIN_AUDIT_API_URL;
    const apiKey = process.env.SUBSYSTEM_API_KEY;

    // If audit is not configured, silently skip (but log in development)
    if (!apiUrl || !apiKey) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug(
          "[AUDIT] Audit API not configured (ADMIN_AUDIT_API_URL or SUBSYSTEM_API_KEY missing)"
        );
      }
      return;
    }

    // Resolve MongoDB ObjectId to audit_uuid before building payload
    const resolvedUserId = await resolveUserId(logData.user_id);

    // Build the payload with required fields (NO timestamp field)
    const payload = {
      user_id: String(resolvedUserId || "UNKNOWN").trim(),
      action_type: String(logData.action_type || "UNKNOWN").trim(),
      details: String(logData.details || "").trim(),
      ip_addr: String(logData.ip_addr || "0.0.0.0").trim(),
      subsystem: SUBSYSTEM_NAME, // Always use exact subsystem name
    };

    // Validate payload before sending
    const validationErrors = validatePayload(payload);
    if (validationErrors) {
      // eslint-disable-next-line no-console
      console.warn("[AUDIT] Validation failed:", {
        errors: validationErrors,
        payload,
      });
      fallbackLogToConsole(payload, { message: `Validation errors: ${validationErrors.join("; ")}` });
      return;
    }

    // Make the request with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios.post(apiUrl, payload, {
        headers: {
          "X-Subsystem-Key": apiKey,
          "Content-Type": "application/json",
        },
        timeout, // Also set axios timeout as backup
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success - audit logged to Admin API
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug("[AUDIT] Log sent successfully:", {
          action: payload.action_type,
          user_id: payload.user_id,
          status: response.status,
        });
      }
    } catch (requestError) {
      clearTimeout(timeoutId);

      // Distinguish between validation errors, HTTP errors, and network errors
      if (requestError.response) {
        // HTTP error (4xx, 5xx)
        // eslint-disable-next-line no-console
        console.error("[AUDIT] HTTP error from Admin API:", {
          status: requestError.response.status,
          statusText: requestError.response.statusText,
          data: requestError.response.data,
          payload,
        });
        fallbackLogToConsole(payload, requestError, requestError.response);
      } else if (requestError.code === "ECONNABORTED") {
        // Timeout error
        // eslint-disable-next-line no-console
        console.error("[AUDIT] Request timeout (>5s):", {
          url: apiUrl,
          payload,
        });
        fallbackLogToConsole(payload, { message: "Request timeout" }, null);
      } else {
        // Network or other error
        // eslint-disable-next-line no-console
        console.error("[AUDIT] Network error:", {
          code: requestError.code,
          message: requestError.message,
          payload,
        });
        fallbackLogToConsole(payload, requestError, null);
      }
    }
  } catch (error) {
    // Outer catch for any unexpected errors
    // eslint-disable-next-line no-console
    console.error("[AUDIT] Unexpected error in logAudit:", error);
    // Never throw - let the application continue
  }
};

/**
 * Fire-and-forget wrapper for audit logging.
 * Ensures that audit failures never block the main application flow.
 *
 * @param {Object} logData - The audit log data
 * @param {Object} options - Configuration options
 * @returns {void}
 */
const auditAsync = (logData, options = {}) => {
  // Use setImmediate to queue the audit log asynchronously
  // This ensures the main request handler completes before audit processing
  setImmediate(() => {
    logAudit(logData, options).catch((err) => {
      // Triple-safe: catch any unexpected errors
      // eslint-disable-next-line no-console
      console.error("[AUDIT] Caught error in auditAsync:", err);
    });
  });
};

module.exports = {
  logAudit,
  auditAsync,
};
