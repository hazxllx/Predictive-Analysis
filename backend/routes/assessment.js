/**
 * Description:
 * Handles patient risk-assessment routes and assessment history retrieval.
 * Part of Predictive Analysis Subsystem.
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getPatientById } = require("../services/pmsData");
const { computeRiskScore } = require("../services/scoringService");
const Assessment = require("../models/Assessment");

/**
 * Description:
 * Executes risk assessment for a patient and stores the result.
 *
 * Inputs:
 * - patient_id (from request body)
 * - patient clinical/lifestyle data (resolved from PMS service)
 *
 * Output:
 * - risk_score
 * - risk_level
 * - confidence
 * - recommendations
 * - persisted assessment metadata
 */
// POST /risk-assessment
router.post("/", protect, async (req, res) => {
  try {
    const { patient_id } = req.body;

    // Validate input data
    if (!patient_id) {
      return res.status(400).json({ message: "patient_id is required" });
    }

    // Validate access rules
    if (req.user.role === "patient" && req.user.patient_id !== patient_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Fetch patient data from PMS
    const patient = getPatientById(patient_id);
    if (!patient) return res.status(404).json({ message: "Patient not found in PMS" });

    // Apply scoring rules
    // TODO: connect to predictive analysis subsystem
    // remove this local/rule-based scoring call after integration
    const result = computeRiskScore(patient);

    // Persist generated recommendations and score output
    const assessment = await Assessment.create({
      patient_id,
      risk_score: result.risk_score,
      risk_level: result.risk_level,
      confidence: result.confidence,
      recommendations: result.recommendations,
      specialists: result.specialists,
      lab_tests: result.lab_tests,
      score_breakdown: result.score_breakdown,
      assessed_by: req.user._id,
    });

    res.status(201).json({ ...result, assessment_id: assessment._id, timestamp: assessment.createdAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * Description:
 * Returns recent assessments for a specific patient.
 *
 * Inputs:
 * - id (patient_id from query string)
 *
 * Output:
 * - latest assessment records (up to 10)
 */
// GET /risk-assessment/user?id=PH001
router.get("/user", protect, async (req, res) => {
  try {
    const { id } = req.query;

    // Validate query input
    if (!id) {
      return res.status(400).json({ message: "id is required" });
    }

    // Validate access rules
    if (req.user.role === "patient" && req.user.patient_id !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Fetch assessment history for dashboard/progress views
    const assessments = await Assessment.find({ patient_id: id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(assessments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
