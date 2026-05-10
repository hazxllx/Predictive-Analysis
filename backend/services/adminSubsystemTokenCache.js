/**
 * Admin Subsystem Token Cache
 *
 * Caches Admin Subsystem access tokens to avoid repeated logins.
 * - In-memory cache with automatic expiry
 * - Request deduplication during token refresh
 * - Parses JWT expiry for accurate TTL calculation
 */
const { AdminSubsystemClient } = require("./adminSubsystemClient");

const DEFAULT_TTL_MS = 50 * 60 * 1000; // 50 minutes

// In-memory token cache: key -> { token, expiresAt }
const cache = new Map();
// In-flight login deduplication locks: key -> Promise
const lock = new Map();

function now() {
  return Date.now();
}

function makeKey(subsystem) {
  return String(subsystem || "").trim();
}

function getConfiguredClient() {
  const baseURL = process.env.ADMIN_SUBSYSTEM_BASE_URI;
  const apiKey = process.env.ADMIN_SUBSYSTEM_API_KEY;
  const subsystem = process.env.ADMIN_SUBSYSTEM_NAME;

  return new AdminSubsystemClient({ baseURL, apiKey, subsystem });
}

function isExpired(entry) {
  if (!entry) return true;
  return !entry.expiresAt || now() >= entry.expiresAt;
}

function parseTokenExpiryMs(accessToken) {
  // If token is JWT, read exp claim for accurate TTL.
  try {
    const parts = String(accessToken).split(".");
    if (parts.length !== 3) return DEFAULT_TTL_MS;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    const expMs = payload?.exp ? payload.exp * 1000 : null;
    if (!expMs) return DEFAULT_TTL_MS;
    const ttl = expMs - now() - 60 * 1000; // subtract 1 min skew
    if (!Number.isFinite(ttl) || ttl <= 0) return DEFAULT_TTL_MS;
    return Math.min(ttl, DEFAULT_TTL_MS);
  } catch {
    return DEFAULT_TTL_MS;
  }
}

async function getOrLogin({ subsystem, username, password } = {}) {
  const key = makeKey(subsystem);
  if (!key) throw new Error("Missing subsystem");

  const existing = cache.get(key);
  if (existing && !isExpired(existing)) return existing.token;

  if (lock.has(key)) {
    return await lock.get(key);
  }

  const loginPromise = (async () => {
    try {
      const client = getConfiguredClient();

      const { accessToken } = await client.subsystemLogin({
        username,
        password,
        subsystem: subsystem || process.env.ADMIN_SUBSYSTEM_NAME,
      });

      const ttl = parseTokenExpiryMs(accessToken);
      const expiresAt = now() + ttl;

      cache.set(key, { token: accessToken, expiresAt });
      return accessToken;
    } finally {
      lock.delete(key);
    }
  })();

  lock.set(key, loginPromise);
  return await loginPromise;
}

async function invalidate(subsystem) {
  const key = makeKey(subsystem);
  cache.delete(key);
}

module.exports = {
  getOrLogin,
  invalidate,
};
