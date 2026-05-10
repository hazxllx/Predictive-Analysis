/**
 * Authentication Controller
 *
 * Handles all authentication business logic including:
 * - User registration with validation
 * - Local login (email/username + password)
 * - Predictive subsystem admin login via Admin Subsystem
 * - Session restoration
 * - Profile updates
 * - Password changes
 *
 * Performance optimizations:
 * - lean() on all read-only user lookups to skip Mongoose hydration
 * - select() to fetch only needed fields (e.g., +password only when comparing)
 * - Consolidated DB queries in predictive admin flow
 * - Non-blocking audit logging (fire-and-forget)
 */

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { resolvePatientLink } = require("../services/patientLinkingService");
const {
  looksLikeEmail,
  normalizeUsername,
  ensureUserHasUsername,
  generateUniqueUsername,
} = require("../utils/authValidation");
const { AdminSubsystemClient } = require("../services/adminSubsystemClient");
const adminSubsystemTokenCache = require("../services/adminSubsystemTokenCache");
const { auditAsync } = require("../services/auditService");
const { AUDIT_ACTIONS } = require("../utils/auditActions");

const ALLOWED_ROLES = new Set(["patient", "admin"]);

/**
 * Generate JWT token for user session
 */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const isDev = process.env.NODE_ENV === "development";

/**
 * Serialize user object for API responses
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
});

/**
 * Resolve user by identifier (email or username)
 * Uses lean() for performance; fetches +password only when needed for auth.
 */
const resolveUserByIdentifier = async (identifier) => {
  const id = String(identifier || "").trim();
  if (!id) return null;

  if (looksLikeEmail(id)) {
    return User.findOne({ email: id.toLowerCase().trim() }).select("+password").lean();
  }

  const username = normalizeUsername(id);
  if (username) {
    const byUsername = await User.findOne({ username }).select("+password").lean();
    if (byUsername) return byUsername;
  }

  return User.findOne({ email: id.toLowerCase().trim() }).select("+password").lean();
};

/**
 * Register a new user
 * Validates input, checks for duplicates, creates user, and attempts patient linking
 *
 * Bootstrap logic: If no admin accounts exist in the database, the first user
 * to register is automatically promoted to admin role.
 */
const register = async (req, res) => {
  try {
    const { name, username, email, password, role, patient_id } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: "Full name, username, email, and password are required" });
    }

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return res.status(400).json({ success: false, message: "Username must use letters, numbers, and underscores only (no spaces)" });
    }

    if (!looksLikeEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [emailExists, usernameExists, adminCount] = await Promise.all([
      User.findOne({ email: normalizedEmail }).select("_id").lean(),
      User.findOne({ username: normalizedUsername }).select("_id").lean(),
      User.countDocuments({ role: "admin" }),
    ]);

    if (usernameExists) return res.status(409).json({ success: false, message: "Username is already taken" });
    if (emailExists) return res.status(409).json({ success: false, message: "Email is already registered" });

    let nextRole = role || "patient";
    if (adminCount === 0) {
      nextRole = "admin";
    }

    if (!ALLOWED_ROLES.has(nextRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const createdUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      role: nextRole,
      patient_id: null,
    });

    const linkResult = await resolvePatientLink(createdUser, {
      persist: true,
      identifiers: { patient_id },
      hydrate: false,
    });
    const user = linkResult?.user || createdUser;

    void auditAsync({
      user_id: user._id.toString(),
      action_type: AUDIT_ACTIONS.PATIENT_REGISTER,
      details: `User registered: ${user.email} (${nextRole})`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token: generateToken(user._id),
      user: serializeUser(user),
      patientLink: {
        linked: Boolean(linkResult?.linked),
        autoLinked: Boolean(linkResult?.autoLinked),
        linkedPatientId: linkResult?.linkedPatientId || null,
        multipleMatches: Boolean(linkResult?.multipleMatches),
        noMatch: Boolean(linkResult?.noMatch),
        duplicateLink: Boolean(linkResult?.duplicateLink),
        conflictingData: Boolean(linkResult?.conflictingData),
      },
    });
  } catch (err) {
    if (isDev) console.error("[AUTH] Register error:", err.message);
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Username or email is already in use" });
    }
    return res.status(500).json({ success: false, message: "Registration failed. Please try again later." });
  }
};

/**
 * Handle user login
 * Supports both local authentication and Predictive subsystem admin authentication
 */
const login = async (req, res) => {
  try {
    const {
      identifier,
      username,
      email,
      password: passwordBody,
      pass,
      pwd,
    } = req.body || {};

    const rawPassword = passwordBody ?? pass ?? pwd;
    const password = typeof rawPassword === "string" ? rawPassword.trim() : "";

    const rawId = identifier ?? username ?? email;
    const id = typeof rawId === "string" ? rawId.trim() : "";

    const normalizedIdentifier = id.toLowerCase();
    const isPredictiveSubsystemAdmin = normalizedIdentifier === "predictive_admin";

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] Login attempt | identifier type: ${looksLikeEmail(id) ? "email" : "username"}`);
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Email or username and password are required" });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    // Centralized auth for Predictive subsystem admins
    if (isPredictiveSubsystemAdmin) {
      const baseURL = process.env.ADMIN_SUBSYSTEM_BASE_URI;
      const apiKey = process.env.ADMIN_SUBSYSTEM_API_KEY;
      const subsystemName = process.env.ADMIN_SUBSYSTEM_NAME || "Predictive";

      if (!baseURL || !apiKey) {
        return res.status(401).json({ success: false, message: "Unable to connect to authentication server." });
      }

      const subsystemClient = new AdminSubsystemClient({ baseURL, apiKey, subsystem: subsystemName });

      let upstreamAccessToken;
      let upstreamUser;

      try {
        upstreamAccessToken = await adminSubsystemTokenCache.getOrLogin({
          subsystem: subsystemName,
          username: "predictive_admin",
          password,
        });

        const loginRes = await subsystemClient.subsystemLogin({
          username: "predictive_admin",
          password,
          subsystem: subsystemName,
        });

        upstreamAccessToken = loginRes.accessToken;
        upstreamUser = loginRes.user;
      } catch (e) {
        if (isDev) console.error("[AUTH] Predictive admin upstream login failed:", e.message);
        return res.status(401).json({ success: false, message: "Authentication failed." });
      }

      const safeUpstreamUser = upstreamUser || {};
      const upstreamUserId = safeUpstreamUser?.user_id;
      const upstreamRole = safeUpstreamUser?.role;
      const upstreamStatus = safeUpstreamUser?.status;
      const upstreamSubsystem = safeUpstreamUser?.subsystem;

      const roleStr = typeof upstreamRole === "string" ? upstreamRole : "";
      const statusStr = typeof upstreamStatus === "string" ? upstreamStatus : "";
      const subsystemStr = typeof upstreamSubsystem === "string" ? upstreamSubsystem : "";

      const roleLooksAdmin = roleStr.toLowerCase().includes("admin");
      const subsystemMatches = subsystemStr.toLowerCase() === "predictive";
      const statusActive = statusStr.toLowerCase() === "active";

      if (!upstreamAccessToken || !upstreamUserId || !subsystemMatches || !roleLooksAdmin || !statusActive) {
        return res.status(401).json({ success: false, message: "Authentication failed." });
      }

      const localUsername = "predictive_admin";
      let localUser = await User.findOne({ username: localUsername }).select("+password").lean();

      if (!localUser) {
        const syntheticPassword = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const syntheticEmail = `${localUsername}@pulse-prophet.local`;
        const created = await User.create({
          name: "Predictive Admin",
          email: syntheticEmail,
          username: localUsername,
          password: syntheticPassword,
          role: "admin",
          patient_id: null,
        });
        localUser = created.toObject();
      }

      // Ingest audit: failures must not block login
      void subsystemClient.ingestAudit({
        accessToken: upstreamAccessToken,
        payload: {
          user_id: upstreamUserId,
          action_type: "SUBSYSTEM_LOGIN_SUCCESS",
          details: "Predictive assessment admin authenticated via Admin Subsystem",
          ip_addr: req.ip || "127.0.0.1",
          subsystem: "Predictive",
        },
      }).catch(() => {});

      const pulseUserDoc = await User.findOne({ username: localUsername }).select("+password");
      const linkResult = await resolvePatientLink(pulseUserDoc, { persist: true, hydrate: false });
      const finalUser = linkResult?.user || pulseUserDoc;

      void auditAsync({
        user_id: upstreamUserId,
        action_type: AUDIT_ACTIONS.PATIENT_LOGIN,
        details: `Predictive Admin authenticated via Admin Subsystem`,
        ip_addr: req.clientIP || "0.0.0.0",
      });

      return res.json({
        success: true,
        message: "Login successful",
        token: generateToken(finalUser._id),
        user: serializeUser(finalUser),
        patientLink: {
          linked: Boolean(linkResult?.linked),
          autoLinked: Boolean(linkResult?.autoLinked),
          linkedPatientId: linkResult?.linkedPatientId || null,
          multipleMatches: Boolean(linkResult?.multipleMatches),
          noMatch: Boolean(linkResult?.noMatch),
          duplicateLink: Boolean(linkResult?.duplicateLink),
          conflictingData: Boolean(linkResult?.conflictingData),
        },
      });
    }

    // Local login: identifier resolution + bcrypt verification
    const lookupId = looksLikeEmail(id) ? id.toLowerCase() : id;
    const user = await resolveUserByIdentifier(lookupId);

    if (!user) {
      if (isDev) console.warn("[AUTH] User not found for identifier:", lookupId);
      void auditAsync({
        user_id: "UNKNOWN",
        action_type: AUDIT_ACTIONS.FAILED_LOGIN_ATTEMPT,
        details: `Failed login attempt with identifier: ${id}`,
        ip_addr: req.clientIP || "0.0.0.0",
      });
      return res.status(401).json({ success: false, message: "Incorrect email/username or password." });
    }

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] User found: ${user.email} (${user.role}) | hasPassword: ${Boolean(user.password)}`);
    }

    if (!user.password || typeof user.password !== "string") {
      return res.status(401).json({ success: false, message: "Incorrect email/username or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[AUTH] Password comparison result: ${isMatch}`);
    }

    if (!isMatch) {
      void auditAsync({
        user_id: user._id.toString(),
        action_type: AUDIT_ACTIONS.FAILED_LOGIN_ATTEMPT,
        details: `Failed login attempt (password mismatch): ${user.email}`,
        ip_addr: req.clientIP || "0.0.0.0",
      });
      return res.status(401).json({ success: false, message: "Incorrect email/username or password." });
    }

    // Auto-generate username for legacy users
    let authenticatedUser = user;
    if (!user.username) {
      try {
        await ensureUserHasUsername(user);
        authenticatedUser = await User.findById(user._id).select("+password").lean();
      } catch {
        // Intentionally ignored to preserve login reliability
      }
    }

    // Canonicalize local admin identity
    if (authenticatedUser?.role === "admin" && authenticatedUser?.email) {
      const canonicalAdmin = await User.findOne({
        email: String(authenticatedUser.email).toLowerCase().trim(),
        role: "admin",
      })
        .sort({ createdAt: -1 })
        .select("+password")
        .lean();

      if (canonicalAdmin) {
        authenticatedUser = canonicalAdmin;
      }
    }

    const linkResult = await resolvePatientLink(authenticatedUser, { persist: true, hydrate: false });
    const finalUser = linkResult?.user || authenticatedUser;

    void auditAsync({
      user_id: finalUser._id.toString(),
      action_type: AUDIT_ACTIONS.PATIENT_LOGIN,
      details: `User logged in: ${finalUser.email} (${finalUser.role})`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    res.json({
      success: true,
      message: "Login successful",
      token: generateToken(finalUser._id),
      user: serializeUser(finalUser),
      patientLink: {
        linked: Boolean(linkResult?.linked),
        autoLinked: Boolean(linkResult?.autoLinked),
        linkedPatientId: linkResult?.linkedPatientId || null,
        multipleMatches: Boolean(linkResult?.multipleMatches),
        noMatch: Boolean(linkResult?.noMatch),
        duplicateLink: Boolean(linkResult?.duplicateLink),
        conflictingData: Boolean(linkResult?.conflictingData),
      },
    });
  } catch (err) {
    if (isDev) console.error("[AUTH] Login error:", err.message);
    return res.status(500).json({ success: false, message: "Authentication failed. Please try again later." });
  }
};

/**
 * Get current user session
 */
const getMe = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: serializeUser(req.user),
    });
  } catch (err) {
    if (isDev) console.error("[AUTH] Get me error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to restore session" });
  }
};

/**
 * Update own profile (name, username)
 */
const updateProfile = async (req, res) => {
  try {
    const { name, username } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (name !== undefined) user.name = String(name).trim();

    if (username !== undefined) {
      const normalized = normalizeUsername(username);
      if (!normalized) {
        return res.status(400).json({ success: false, message: "Username must use letters, numbers, and underscores only (no spaces)" });
      }
      if (normalized !== user.username) {
        const taken = await User.findOne({ username: normalized }).select("_id").lean();
        if (taken) return res.status(409).json({ success: false, message: "Username is already taken" });
        user.username = normalized;
      }
    }

    await user.save();

    void auditAsync({
      user_id: user._id.toString(),
      action_type: AUDIT_ACTIONS.PROFILE_UPDATED,
      details: `User profile updated: ${user.email}`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    return res.json({ success: true, message: "Profile updated", user: serializeUser(user) });
  } catch (err) {
    if (isDev) console.error("[AUTH] Update profile error:", err.message);
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Username is already in use" });
    }
    return res.status(500).json({ success: false, message: "Failed to update profile. Please try again later." });
  }
};

/**
 * Change password (requires current password)
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Current password, new password, and confirmation are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New password and confirmation do not match" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    void auditAsync({
      user_id: user._id.toString(),
      action_type: AUDIT_ACTIONS.PASSWORD_CHANGED,
      details: `User changed password: ${user.email}`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    if (isDev) console.error("[AUTH] Change password error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to change password. Please try again later." });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
};
