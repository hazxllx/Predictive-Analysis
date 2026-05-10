/**
 * Centralized Audit Action Constants
 *
 * IMPORTANT: Only actions in this list are supported by the Admin Subsystem API.
 * Any attempt to log an action not listed here will be rejected by Admin API validation.
 *
 * Allowed Actions:
 * - PATIENT_LOGIN: User login (patient or admin)
 * - PATIENT_REGISTER: User registration
 * - ASSESSMENT_CREATED: Assessment created
 * - ASSESSMENT_UPDATED: Assessment updated
 * - PATIENT_RECORD_UPDATED: Patient record/user updated
 * - PATIENT_RECORD_DELETED: Patient record/user deleted
 *
 * Action categories:
 * - Patient Authentication: login, register
 * - Assessment Operations: create, update
 * - Patient Record Management: update, delete
 */

const AUDIT_ACTIONS = {
  // ─── PATIENT AUTHENTICATION (ALLOWED) ────────────────────────
  PATIENT_LOGIN: "PATIENT_LOGIN",
  PATIENT_REGISTER: "PATIENT_REGISTER",

  // ─── ASSESSMENT OPERATIONS (ALLOWED) ─────────────────────────
  ASSESSMENT_CREATED: "ASSESSMENT_CREATED",
  ASSESSMENT_UPDATED: "ASSESSMENT_UPDATED",

  // ─── PATIENT RECORD MANAGEMENT (ALLOWED) ─────────────────────
  PATIENT_RECORD_UPDATED: "PATIENT_RECORD_UPDATED",
  PATIENT_RECORD_DELETED: "PATIENT_RECORD_DELETED",

  // ─── LOGGING ACTIONS BELOW THIS LINE MAY FAIL ADMIN API VALIDATION ─
  // These are supported locally but rejected by Admin API.
  // Keep for backward compatibility with existing code, but they will be
  // validated out by the auditService before sending.

  PATIENT_LOGOUT: "PATIENT_LOGOUT",
  PROFILE_UPDATED: "PROFILE_UPDATED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  ASSESSMENT_DELETED: "ASSESSMENT_DELETED",
  ASSESSMENT_VIEWED: "ASSESSMENT_VIEWED",
  ADMIN_LOGIN: "ADMIN_LOGIN",
  ADMIN_LOGOUT: "ADMIN_LOGOUT",
  PATIENT_RECORD_VIEWED: "PATIENT_RECORD_VIEWED",
  SYSTEM_CONFIGURATION_CHANGED: "SYSTEM_CONFIGURATION_CHANGED",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  FAILED_LOGIN_ATTEMPT: "FAILED_LOGIN_ATTEMPT",
  UNAUTHORIZED_ACCESS_ATTEMPT: "UNAUTHORIZED_ACCESS_ATTEMPT",
  INVALID_TOKEN: "INVALID_TOKEN",
  RISK_PREDICTION_GENERATED: "RISK_PREDICTION_GENERATED",
  DASHBOARD_VIEWED: "DASHBOARD_VIEWED",
};

/**
 * Allowed action types for Admin Subsystem API.
 * Only these actions will be accepted when sent to the Admin API.
 */
const ALLOWED_ADMIN_API_ACTIONS = new Set([
  "PATIENT_LOGIN",
  "PATIENT_REGISTER",
  "ASSESSMENT_CREATED",
  "ASSESSMENT_UPDATED",
  "PATIENT_RECORD_UPDATED",
  "PATIENT_RECORD_DELETED",
]);

/**
 * Helper function to check if an action string is valid locally.
 * @param {string} action - The action to validate
 * @returns {boolean} True if the action exists in AUDIT_ACTIONS
 */
const isValidAction = (action) => {
  return Object.values(AUDIT_ACTIONS).includes(action);
};

/**
 * Helper function to check if an action is supported by Admin API.
 * @param {string} action - The action to check
 * @returns {boolean} True if the action is in the Admin API allowed list
 */
const isSupportedByAdminAPI = (action) => {
  return ALLOWED_ADMIN_API_ACTIONS.has(action);
};

module.exports = {
  AUDIT_ACTIONS,
  ALLOWED_ADMIN_API_ACTIONS,
  isValidAction,
  isSupportedByAdminAPI,
};
