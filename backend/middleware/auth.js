const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * JWT auth middleware for users/patients.
 * Expects: Authorization: Bearer <token>
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      if (process.env.NODE_ENV === "development") {
        req.user = {
          _id: "dev-user",
          role: "admin",
          patient_id: "PAT-20260504-0058",
          name: "Dev Admin",
        };
        return next();
      }

      return res.status(401).json({ message: "Unauthorized: missing bearer token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const foundUser = await User.findById(decoded.id).select("-password");

    if (!foundUser) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    req.user = foundUser;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
};

/**
 * API key middleware for PMS integration only.
 * Reads x-api-key and compares with process.env.API_KEY
 */
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ message: "Unauthorized: invalid API key" });
  }

  next();
};

const staffOnly = (req, res, next) => {
  if (req.user && (req.user.role === "staff" || req.user.role === "admin")) return next();
  return res.status(403).json({ message: "Staff access only" });
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  return res.status(403).json({ message: "Admin access only" });
};

// Backward compatibility alias
const protect = requireAuth;

module.exports = { requireAuth, requireApiKey, protect, staffOnly, adminOnly };
