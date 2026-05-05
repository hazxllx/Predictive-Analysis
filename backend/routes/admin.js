const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { protect, adminOnly } = require("../middleware/auth");
const User = require("../models/User");
const Assessment = require("../models/Assessment");
const { fetchAllPatients } = require("../services/pmsService");

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// GET /admin/users — list all users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 }).lean();
    const pmsPatients = await fetchAllPatients();
    const pmsMap = new Map(pmsPatients.map((p) => [String(p.id), p]));

    const merged = users.map((user) => {
      if (user.role !== "patient") return user;

      const pms = pmsMap.get(String(user.patient_id));

      return {
        ...user,
        displayName: pms?.name || user.name,
        pmsLinked: !!pms,
      };
    });

    res.json(merged);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /admin/users — create a user (staff/patient/admin)
router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, patient_id } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(400).json({ message: "Email already registered" });

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      patient_id: role === "patient" ? (patient_id || null) : null,
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      patient_id: user.patient_id,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /admin/users/:id — edit user role or patient_id
router.put("/users/:id", async (req, res) => {
  try {
    const { name, role, patient_id, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name.trim();
    if (role) user.role = role;
    if (role === "patient") {
      user.patient_id = patient_id || null;
    } else {
      user.patient_id = null;
    }
    if (password && password.length >= 6) {
      user.password = password; // pre-save hook will hash it
    }

    await user.save();
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      patient_id: user.patient_id,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /admin/users/:id — remove a user
router.delete("/users/:id", async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /admin/stats — system-wide statistics
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStaff = await User.countDocuments({ role: "staff" });
    const totalPatientUsers = await User.countDocuments({ role: "patient" });
    const totalAdmins = await User.countDocuments({ role: "admin" });
    const totalAssessments = await Assessment.countDocuments();
    const totalPatients = (await fetchAllPatients()).length;

    res.json({
      totalUsers,
      totalStaff,
      totalPatientUsers,
      totalAdmins,
      totalAssessments,
      totalPatients,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
