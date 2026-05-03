const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getAllPatients, getPatientById } = require("../services/pmsData");

// GET /patients — admin/staff sees all, patient sees own
router.get("/", protect, (req, res) => {
  if (req.user.role === "staff" || req.user.role === "admin") {
    return res.json(getAllPatients());
  }
  // Patient role
  const pid = req.user.patient_id;
  if (!pid) return res.status(403).json({ message: "No patient ID linked" });
  const patient = getPatientById(pid);
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  return res.json([patient]);
});

// GET /patients/:id
router.get("/:id", protect, (req, res) => {
  if (req.user.role === "patient" && req.user.patient_id !== req.params.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  const patient = getPatientById(req.params.id);
  if (!patient) return res.status(404).json({ message: "Patient not found" });
  res.json(patient);
});

module.exports = router;
