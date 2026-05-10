/**
 * Query Cache
 *
 * Two-tier caching layer for frontend API data:
 * - In-memory Map (fastest, survives component re-renders)
 * - sessionStorage (survives page reloads within the same session)
 *
 * Exported functions:
 * - getCachedQuery    — read cached data if not stale
 * - setCachedQuery    — write data to both tiers
 * - invalidateCachedQuery — remove a single entry
 * - clearAllCachedQueries — wipe the entire cache
 */

const CACHE_PREFIX = "pulse:query-cache:";
const memoryCache = new Map();

// Normalize cache keys (arrays are stringified)
function toCacheKey(key) {
  if (Array.isArray(key)) return JSON.stringify(key);
  return String(key);
}

function now() {
  return Date.now();
}

// Check if the browser supports sessionStorage
function canUseSessionStorage() {
  try {
    return typeof window !== "undefined" && !!window.sessionStorage;
  } catch {
    return false;
  }
}

// Read a cached entry from sessionStorage
function readSession(key) {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Write a cached entry to sessionStorage
function writeSession(key, value) {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore storage write failures
  }
}

// Remove a cached entry from sessionStorage
function removeSession(key) {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // ignore storage remove failures
  }
}

// Retrieve cached data by key if it exists and is within the stale window
export function getCachedQuery(key, staleTime = 5 * 60 * 1000) {
  const cacheKey = toCacheKey(key);
  const inMemory = memoryCache.get(cacheKey);
  const persisted = inMemory || readSession(cacheKey);

  if (!persisted || typeof persisted !== "object") return null;
  if (!persisted.updatedAt || now() - persisted.updatedAt > staleTime) return null;

  if (!inMemory) {
    memoryCache.set(cacheKey, persisted);
  }

  return persisted.data;
}

// Store data in both memory and sessionStorage
export function setCachedQuery(key, data) {
  const cacheKey = toCacheKey(key);
  const entry = { data, updatedAt: now() };
  memoryCache.set(cacheKey, entry);
  writeSession(cacheKey, entry);
  return data;
}

// Remove a single cached entry from both tiers
export function invalidateCachedQuery(key) {
  const cacheKey = toCacheKey(key);
  memoryCache.delete(cacheKey);
  removeSession(cacheKey);
}

// Wipe all cached entries (memory + sessionStorage)
export function clearAllCachedQueries() {
  memoryCache.clear();
  if (!canUseSessionStorage()) return;

  try {
    const keysToDelete = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {
    // ignore storage clear failures
  }
}
