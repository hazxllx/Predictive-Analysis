const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { resolvePatientLink } = require("../services/patientLinkingService");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  patient_id: user.patient_id,
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, patient_id } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const createdUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || "patient",
      patient_id: role === "patient" ? (patient_id || null) : null,
    });

    const linkResult = await resolvePatientLink(createdUser, {
      persist: true,
      identifiers: { patient_id },
    });
    const user = linkResult?.user || createdUser;

    res.status(201).json({
      token: generateToken(user._id),
      user: serializeUser(user),
      patientLink: {
        linked: Boolean(linkResult?.linked),
        autoLinked: Boolean(linkResult?.autoLinked),
        linkedPatientId: linkResult?.linkedPatientId || null,
        multipleMatches: Boolean(linkResult?.multipleMatches),
        noMatch: Boolean(linkResult?.noMatch),
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const linkResult = await resolvePatientLink(user, { persist: true });
    const authenticatedUser = linkResult?.user || user;

    res.json({
      token: generateToken(authenticatedUser._id),
      user: serializeUser(authenticatedUser),
      patientLink: {
        linked: Boolean(linkResult?.linked),
        autoLinked: Boolean(linkResult?.autoLinked),
        linkedPatientId: linkResult?.linkedPatientId || null,
        multipleMatches: Boolean(linkResult?.multipleMatches),
        noMatch: Boolean(linkResult?.noMatch),
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    const linkResult = await resolvePatientLink(req.user, { persist: true });
    const currentUser = linkResult?.user || req.user;

    return res.json({
      user: serializeUser(currentUser),
      patientLink: {
        linked: Boolean(linkResult?.linked),
        autoLinked: Boolean(linkResult?.autoLinked),
        linkedPatientId: linkResult?.linkedPatientId || null,
        multipleMatches: Boolean(linkResult?.multipleMatches),
        noMatch: Boolean(linkResult?.noMatch),
      },
    });
  } catch (err) {
    console.error("Auth me error:", err);
    return res.status(500).json({ message: "Failed to restore session" });
  }
});

module.exports = router;
