/**
 * Admin Controller
 *
 * Handles admin-only business logic for:
 * - User CRUD operations (list, create, update, delete)
 * - Dashboard statistics
 *
 * Performance optimizations:
 * - lean() on all read queries to skip Mongoose document hydration
 * - select() to exclude password and __v from responses
 * - Parallel Promise.all for independent lookups
 * - Non-blocking audit logging
 */

const User = require("../models/User");
const Assessment = require("../models/Assessment");
const { fetchAllPatients } = require("../services/pmsService");
const { resolvePatientLink } = require("../services/patientLinkingService");
const { auditAsync } = require("../services/auditService");
const { AUDIT_ACTIONS } = require("../utils/auditActions");
const { serializeUser, looksLikeEmail, normalizeUsername } = require("../utils/userHelpers");

const ALLOWED_ROLES = new Set(["patient", "admin"]);

/**
 * List all users with PMS display name enrichment for patients
 */
const listUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password -__v").sort({ createdAt: -1 }).lean();
    const hasPatientUsers = users.some((user) => user.role === "patient");
    const pmsPatients = hasPatientUsers ? await fetchAllPatients() : [];
    const pmsMap = new Map(pmsPatients.map((p) => [String(p.patient_id), p]));

    const merged = users.map((user) => {
      if (user.role !== "patient") return user;

      const pms = pmsMap.get(String(user.patient_id));
      return {
        ...user,
        displayName: pms?.name || user.name,
        pmsLinked: Boolean(pms),
      };
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[ADMIN] listUsers: fetched ${merged.length} users`);
    }

    return res.json({ success: true, data: merged });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("[ADMIN] listUsers error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to fetch users. Please try again later." });
  }
};

/**
 * Create a new user with validation for email, username, and role
 */
const createUser = async (req, res) => {
  try {
    const { name, email, username, password, role, patient_id } = req.body;

    if (!name || !email || !username || !password || !role) {
      return res.status(400).json({ success: false, message: "Name, username, email, password, and role are required" });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return res.status(400).json({ success: false, message: "Username must use letters, numbers, and underscores only (no spaces)" });
    }
    if (!looksLikeEmail(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    const normalizedEmail = email.toLowerCase().trim();

    const [emailExists, usernameExists] = await Promise.all([
      User.findOne({ email: normalizedEmail }).select("_id").lean(),
      User.findOne({ username: normalizedUsername }).select("_id").lean(),
    ]);

    if (usernameExists) return res.status(409).json({ success: false, message: "Username is already taken" });
    if (emailExists) return res.status(409).json({ success: false, message: "Email is already registered" });

    if (role === "patient" && patient_id) {
      const duplicatePatient = await User.findOne({ role: "patient", patient_id }).select("_id").lean();
      if (duplicatePatient) {
        return res.status(409).json({ success: false, message: "Patient ID is already linked to another user" });
      }
    }

    const createdUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      role,
      patient_id: null,
    });

    const linkResult =
      role === "patient"
        ? await resolvePatientLink(createdUser, {
            persist: true,
            identifiers: { patient_id },
            hydrate: false,
          })
        : null;

    void auditAsync({
      user_id: req.user._id.toString(),
      action_type: AUDIT_ACTIONS.USER_CREATED,
      details: `Admin created user: ${createdUser.email} (${role})`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    return res.status(201).json({ success: true, user: serializeUser(linkResult?.user || createdUser) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Username/email is already in use" });
    }
    return res.status(500).json({ success: false, message: "Failed to create user. Please try again later." });
  }
};

/**
 * Update an existing user (name, email, username, role, patient_id, password)
 */
const updateUser = async (req, res) => {
  try {
    const { name, role, patient_id, password, username, email } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (name) user.name = name.trim();

    if (username !== undefined) {
      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        return res.status(400).json({ success: false, message: "Username must use letters, numbers, and underscores only (no spaces)" });
      }
      if (normalizedUsername !== user.username) {
        const usernameExists = await User.findOne({ username: normalizedUsername })
          .select("_id")
          .lean();
        if (usernameExists) return res.status(409).json({ success: false, message: "Username is already taken" });
        user.username = normalizedUsername;
      }
    }

    if (email !== undefined) {
      if (!looksLikeEmail(email)) {
        return res.status(400).json({ success: false, message: "Enter a valid email address" });
      }
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const emailExists = await User.findOne({ email: normalizedEmail })
          .select("_id")
          .lean();
        if (emailExists) return res.status(409).json({ success: false, message: "Email is already registered" });
        user.email = normalizedEmail;
      }
    }

    if (role) {
      if (!ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }
      user.role = role;
    }

    if (user.role === "patient") {
      const nextPatientId = patient_id || null;
      if (nextPatientId) {
        const duplicatePatient = await User.findOne({
          _id: { $ne: user._id },
          role: "patient",
          patient_id: nextPatientId,
        })
          .select("_id")
          .lean();
        if (duplicatePatient) {
          return res.status(409).json({ success: false, message: "Patient ID is already linked to another user" });
        }
      }

      user.patient_id = nextPatientId;
      user.pms_linked_at = nextPatientId ? new Date() : null;
      user.pms_matched_by = nextPatientId ? "patient_id" : null;
    } else {
      user.patient_id = null;
      user.pms_linked_at = null;
      user.pms_matched_by = null;
    }

    if (password && password.length >= 6) {
      user.password = password;
    }

    await user.save();

    void auditAsync({
      user_id: req.user._id.toString(),
      action_type: AUDIT_ACTIONS.PATIENT_RECORD_UPDATED,
      details: `Admin updated user: ${user.email} (${user.role})`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    return res.json({ success: true, user: serializeUser(user) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Username/email is already in use" });
    }
    return res.status(500).json({ success: false, message: "Failed to update user. Please try again later." });
  }
};

/**
 * Delete a user (admins cannot delete themselves)
 */
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    void auditAsync({
      user_id: req.user._id.toString(),
      action_type: AUDIT_ACTIONS.PATIENT_RECORD_DELETED,
      details: `Admin deleted user: ${user.email} (${user.role})`,
      ip_addr: req.clientIP || "0.0.0.0",
    });

    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to delete user. Please try again later." });
  }
};

/**
 * Dashboard statistics: total users, patients, admins, assessments, and PMS patients
 */
const getStats = async (req, res) => {
  try {
    const [totalUsers, totalPatientUsers, totalAdmins, totalAssessments, patients] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "patient" }),
      User.countDocuments({ role: "admin" }),
      Assessment.countDocuments(),
      fetchAllPatients(),
    ]);

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalPatientUsers,
        totalAdmins,
        totalAssessments,
        totalPatients: patients.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch stats. Please try again later." });
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getStats,
};
