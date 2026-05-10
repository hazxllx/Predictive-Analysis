const User = require("../models/User");

/**
 * Ensures legacy users have a username.
 * - Generates from email (local-part) when username missing/empty
 * - Normalizes to lowercase and converts invalid chars to underscores
 * - Enforces allowed charset: letters, numbers, underscores only
 * - Resolves conflicts by suffixing with _2, _3, ...
 *
 * Safe to run multiple times.
 */
async function migrateMissingUsernames() {
  const cursor = User.find({
    $or: [{ username: { $exists: false } }, { username: null }, { username: "" }],
  })
    .select("email name username")
    .lean();

  const users = await cursor;

  let updatedCount = 0;

  for (const u of users) {
    const email = (u?.email || "").toLowerCase().trim();
    const name = (u?.name || "").toLowerCase().trim();

    // Base candidate: email local-part if available, else name
    const emailLocal = email.includes("@") ? email.split("@")[0] : "";
    const rawBase = emailLocal || name || "user";

    // Normalize: lowercase + allowed charset [a-z0-9_]
    let candidate = rawBase
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!candidate) candidate = "user";

    // Generate unique username
    let next = candidate;
    let i = 1;

    // eslint-disable-next-line no-await-in-loop
    while (true) {
      const exists = await User.findOne({ username: next }).select("_id").lean();
      if (!exists) break;
      i += 1;
      next = `${candidate}_${i}`;
    }

    // eslint-disable-next-line no-await-in-loop
    await User.updateOne({ _id: u._id }, { $set: { username: next } });
    updatedCount += 1;
  }

  return { migrated: updatedCount };
}

module.exports = { migrateMissingUsernames };
