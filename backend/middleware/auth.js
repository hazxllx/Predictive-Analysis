/**
 * Authorization middleware for Pulse Prophet backend APIs.
 *
 * Purpose:
 * - Protects endpoints by verifying Bearer JWTs and loading the corresponding user document.
 * - Provides an API-key middleware for PMS integration endpoints.
 * - Provides an admin-only gate for admin protected routes.
 *
 * Access control behavior:
 * - requireAuth/protect: requires Authorization header "Bearer <token>".
 * - requireApiKey: requires header "x-api-key" matching process.env.API_KEY.
 * - adminOnly: allows only users with role === "admin".
 *
 * Security behavior:
 * - Never returns token internals; always returns generic "Unauthorized" or "Admin access only".
 * - In development only, a dev bypass exists for local testing.
 *
 * Performance:
 * - Lightweight in-memory LRU cache for user lookups reduces DB round-trips on every request.
 * - Cache entries expire after 60s to balance speed with data freshness.
 */
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Simple LRU cache for authenticated user lookups (max 200 entries, 60s TTL)
const USER_CACHE_MAX = 200;
const userCache = new Map();

function getCachedUser(userId) {
  const entry = userCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.ts > 60_000) {
    userCache.delete(userId);
    return null;
  }
  return entry.data;
}

function setCachedUser(userId, data) {
  if (userCache.size >= USER_CACHE_MAX) {
    const firstKey = userCache.keys().next().value;
    userCache.delete(firstKey);
  }
  userCache.set(userId, { data, ts: Date.now() });
}

/**
 * JWT auth middleware for users/patients.
 * Expects: Authorization: Bearer <token>
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      // Dev bypass: only when explicitly enabled and in development
      if (process.env.NODE_ENV === "development" && process.env.AUTH_DEV_BYPASS === "true") {
        if (process.env.DEBUG_AUTH === "true") {
          console.debug("[AUTH] Dev bypass activated for:", req.method, req.path);
        }
        req.user = {
          _id: "dev-user",
          role: "admin",
          patient_id: "DEV-PATIENT",
          name: "Dev Admin",
          email: "dev@pulseprophet.local",
          username: "dev_admin",
        };
        return next();
      }

      if (process.env.DEBUG_AUTH === "true") {
        console.debug("[AUTH] Missing bearer token for:", req.method, req.path);
      }
      return res.status(401).json({ success: false, message: "Unauthorized: missing bearer token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = String(decoded.id);
    let foundUser = getCachedUser(cacheKey);

    if (!foundUser) {
      foundUser = await User.findById(decoded.id).select("-password").lean();
      if (foundUser) {
        setCachedUser(cacheKey, foundUser);
      }
    }

    if (!foundUser) {
      if (process.env.DEBUG_AUTH === "true") {
        console.debug("[AUTH] User not found for ID:", decoded.id);
      }
      return res.status(401).json({ success: false, message: "Unauthorized: user not found" });
    }

    if (process.env.DEBUG_AUTH === "true") {
      console.debug("[AUTH] Authenticated:", foundUser.email, "role:", foundUser.role, "for:", req.method, req.path);
    }
    req.user = foundUser;
    next();
  } catch (error) {
    if (process.env.DEBUG_AUTH === "true") {
      console.debug("[AUTH] Token verification failed:", error.message);
    }
    return res.status(401).json({ success: false, message: "Unauthorized: invalid token" });
  }
};

/**
 * API key middleware for PMS integration only.
 * Reads x-api-key and compares with process.env.API_KEY
 */
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized: invalid API key" });
  }

  next();
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    if (process.env.DEBUG_AUTH === "true") {
      console.debug("[AUTH] Admin access granted to:", req.user.email, "for:", req.method, req.path);
    }
    return next();
  }
  if (process.env.DEBUG_AUTH === "true") {
    console.debug("[AUTH] Admin access denied for user:", req.user?.email, "role:", req.user?.role, "for:", req.method, req.path);
  }
  return res.status(403).json({ success: false, message: "Admin access only" });
};

// Backward compatibility alias
const protect = requireAuth;

module.exports = { requireAuth, requireApiKey, protect, adminOnly };
