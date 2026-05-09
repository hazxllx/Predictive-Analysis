const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const User = require("../models/User");
const Assessment = require("../models/Assessment");
const { fetchAllPatients } = require("../services/pmsService");
const { resolvePatientLink } = require("../services/patientLinkingService");

const ALLOWED_ROLES = new Set(["patient", "admin"]);

router.use(protect, adminOnly);

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    patient_id: user.patient_id,
    pms_linked_at: user.pms_linked_at || null,
    pms_matched_by: user.pms_matched_by || null,
    createdAt: user.createdAt,
  };
}

router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 }).lean();
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

    return res.json(merged);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, patient_id } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (exists) return res.status(400).json({ message: "Email already registered" });

    if (role === "patient" && patient_id) {
      const duplicatePatient = await User.findOne({ role: "patient", patient_id }).select("_id").lean();
      if (duplicatePatient) {
        return res.status(409).json({ message: "Patient ID is already linked to another user" });
      }
    }

    const createdUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
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

    return res.status(201).json(serializeUser(linkResult?.user || createdUser));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Patient ID or email is already in use" });
    }
    return res.status(500).json({ message: err.message });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const { name, role, patient_id, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name.trim();
    if (role) {
      if (!ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ message: "Invalid role" });
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
          return res.status(409).json({ message: "Patient ID is already linked to another user" });
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
    return res.json(serializeUser(user));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Patient ID or email is already in use" });
    }
    return res.status(500).json({ message: err.message });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [totalUsers, totalPatientUsers, totalAdmins, totalAssessments, patients] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "patient" }),
      User.countDocuments({ role: "admin" }),
      Assessment.countDocuments(),
      fetchAllPatients(),
    ]);

    return res.json({
      totalUsers,
      totalPatientUsers,
      totalAdmins,
      totalAssessments,
      totalPatients: patients.length,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
