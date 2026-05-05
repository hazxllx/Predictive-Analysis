const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { fetchAllPatients, fetchPatient } = require("../services/pmsService");
const { scorePatient } = require("../services/scoring");
const User = require("../models/User");

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const enrichWithRisk = (patient = null) => {
  if (!patient) return null;

  const scored = scorePatient({
    patient_id: patient.patient_id || null,
    age: patient.age || 0,
    lifestyle: patient.lifestyle || {},
    patient_record: Array.isArray(patient.patient_record) ? patient.patient_record : [],
  });

  return {
    ...patient,
    ...scored,
  };
};

router.get("/me", protect, async (req, res) => {
  try {
    const user = req.user;
    console.log("[/patients/me] user:", {
      id: user?._id,
      role: user?.role,
      name: user?.name,
      patient_id: user?.patient_id || null,
    });

    if (user.patient_id) {
      const patient = await fetchPatient(user.patient_id);
      console.log("[/patients/me] linked via existing patient_id:", {
        patient_id: user.patient_id,
        found: !!patient,
      });
      return res.json({ linked: true, data: enrichWithRisk(patient) });
    }

    const patients = await fetchAllPatients();
    console.log("[/patients/me] fetched PMS patients:", {
      count: patients.length,
      sampleNames: patients.slice(0, 5).map((p) => p?.name),
    });

    const targetName = normalizeName(user?.name);
    const matches = patients.filter((p) => normalizeName(p?.name) === targetName);

    console.log("[/patients/me] match results:", {
      targetName,
      matchCount: matches.length,
      matchIds: matches.map((m) => m?.patient_id),
      matchNames: matches.map((m) => m?.name),
    });

    if (matches.length === 1) {
      const matched = matches[0];

      await User.findByIdAndUpdate(user._id, {
        patient_id: matched.patient_id,
      });

      return res.json({
        linked: true,
        autoLinked: true,
        linkedPatientId: matched.patient_id,
        data: enrichWithRisk(matched),
      });
    }

    if (matches.length > 1) {
      return res.json({
        linked: false,
        multipleMatches: true,
        options: matches.map(enrichWithRisk),
      });
    }

    return res.json({ linked: false });
  } catch (error) {
    console.error("🔥 AUTO-LINK ERROR:", error.message);
    return res.status(500).json({ message: "Failed to resolve patient link" });
  }
});

// GET /patients — admin/staff sees all, patient sees own
router.get("/", protect, async (req, res) => {
  try {
    const patients = await fetchAllPatients();

    if (req.user.role === "patient") {
      const pid = req.user.patient_id;
      if (!pid) return res.status(403).json({ message: "No patient ID linked" });

      const patient = patients.find((p) => String(p.patient_id) === String(pid));

      const enriched = enrichWithRisk(patient);
      return res.json({
        source: "pms",
        count: enriched ? 1 : 0,
        data: enriched ? [enriched] : [],
      });
    }

    return res.json({
      source: "pms",
      count: patients.length,
      data: patients.map(enrichWithRisk),
    });
  } catch (error) {
    console.error("🔥 CRITICAL ERROR:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// GET /patients/:id
router.get("/:id", protect, async (req, res) => {
  try {
    console.log("BACKEND RECEIVED ID:", req.params.id);

    if (req.user.role === "patient" && String(req.user.patient_id) !== String(req.params.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const patient = await fetchPatient(req.params.id);

    if (!patient?.name || !patient?.patient_id) {
      throw new Error("Corrupt PMS data");
    }

    const enriched = enrichWithRisk(patient);
    console.log("FINAL PATIENT RESPONSE:", enriched);

    return res.json({ data: enriched });
  } catch (error) {
    console.error("PATIENT FETCH ERROR:", error.message);

    return res.status(500).json({
      message: "Failed to fetch patient",
      error: error.message,
    });
  }
});

module.exports = router;
