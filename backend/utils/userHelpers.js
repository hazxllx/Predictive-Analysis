/**
 * User Helper Utilities
 *
 * Shared utility functions for user serialization and validation.
 * These are used across controllers to maintain consistency.
 */

/**
 * Serialize user object for API responses
 * Removes sensitive fields like password and normalizes output format
 */
const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  username: user.username,
  role: user.role,
  patient_id: user.patient_id,
  pms_linked_at: user.pms_linked_at || null,
  pms_matched_by: user.pms_matched_by || null,
  createdAt: user.createdAt,
});

/**
 * Simple email format validator
 * Checks if value matches standard email pattern
 */
const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

/**
 * Normalize and validate username
 * Converts to lowercase, trims whitespace, and validates format
 * Only allows letters, numbers, and underscores
 */
const normalizeUsername = (raw) => {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim().toLowerCase();
  if (!v) return "";
  if (!/^[a-z0-9_]+$/.test(v)) return "";
  return v;
};

module.exports = {
  serializeUser,
  looksLikeEmail,
  normalizeUsername,
};
