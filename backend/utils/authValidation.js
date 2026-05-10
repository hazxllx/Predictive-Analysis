/**
 * Auth Validation Utilities
 *
 * Helper functions for:
 * - Email format validation
 * - Username normalization and validation
 * - Unique username generation (with conflict resolution)
 * - Ensuring users have a valid username
 */
const User = require("../models/User");

// Check if a string looks like a valid email address
const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

// Normalize a raw username: lowercase, trim, validate allowed chars [a-z0-9_]
const normalizeUsername = (raw) => {
  if (raw === null || raw === undefined) return "";
  const v = String(raw).trim().toLowerCase();
  if (!v) return "";
  if (!/^[a-z0-9_]+$/.test(v)) return "";
  return v;
};

// Generate a username candidate from email local-part or name
function generateUsernameCandidate(email = "", name = "") {
  const emailLocal = (email || "").toLowerCase().trim().includes("@")
    ? email.toLowerCase().trim().split("@")[0]
    : "";
  const rawBase = emailLocal || (name || "").toLowerCase().trim() || "user";

  let candidate = rawBase
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!candidate) candidate = "user";
  return candidate;
}

// Generate a unique username, suffixing with _2, _3, ... if conflicts exist
async function generateUniqueUsername(email = "", name = "", excludeId = null) {
  const candidate = generateUsernameCandidate(email, name);
  let next = candidate;
  let i = 1;

  while (true) {
    const query = { username: next };
    if (excludeId) query._id = { $ne: excludeId };
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.findOne(query).select("_id").lean();
    if (!exists) break;
    i += 1;
    next = `${candidate}_${i}`;
  }

  return next;
}

// Backfill a missing username for an existing user
async function ensureUserHasUsername(user) {
  if (!user || user.username) return user.username;
  const generated = await generateUniqueUsername(user.email, user.name, user._id);
  await User.updateOne({ _id: user._id }, { $set: { username: generated } });
  return generated;
}

module.exports = {
  looksLikeEmail,
  normalizeUsername,
  generateUsernameCandidate,
  generateUniqueUsername,
  ensureUserHasUsername,
};
