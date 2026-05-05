/**
 * Predictive Analysis routes
 * - Patient-triggered risk assessment (JWT protected)
 * - PMS-triggered risk assessment (API key protected)
 * - Authenticated user history
 */

const express = require("express");
const router = express.Router();

const { requireAuth, requireApiKey } = require("../middleware/auth");
const { pmsRateLimiter } = require("../middleware/rateLimiter");
const { pmsRequestLogger } = require("../middleware/requestLogger");
const { scorePatient } = require("../services/scoring");
const { runPmsAssessment } = require("../controllers/pmsAssessmentController");
const Assessment = require("../models/Assessment");

// POST /api/v1/predictive-analysis/risk-assessment
router.post("/risk-assessment", requireAuth, async (req, res) => {
  try {
    const result = scorePatient(req.body);

    const assessment = await Assessment.create({
      userId: req.user._id,
      risk_score: result.risk_score,
      risk_level: result.risk_level,
      inputs: req.body,
      insights: {
        recommendations: result.recommendations,
        suggested_specialist: result.suggested_specialist,
        optional_lab_tests: result.optional_lab_tests,
        disclaimer: result.disclaimer,
      },
    });

    return res.status(201).json({
      assessment_id: assessment._id,
      ...result,
      createdAt: assessment.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to assess patient risk" });
  }
});

// POST /api/v1/predictive-analysis/pms/risk-assessment
router.post(
  "/pms/risk-assessment",
  requireApiKey, // API key validation
  pmsRateLimiter, // protect PMS endpoint
  pmsRequestLogger,
  async (req, res) => {
    try {
      console.log("Step 1: received body");
      console.log("Incoming PMS data:", req.body);

      if (!req.body || !req.body.lifestyle) {
        return res.status(400).json({ message: "Invalid input structure" });
      }

      // connect here (PMS integration point)
      console.log("Step 2: scoring...");
      const result = scorePatient(req.body);

      console.log("Step 3: saving...");
      const assessment = await Assessment.create({
        risk_score: result.risk_score,
        risk_level: result.risk_level,
        inputs: req.body,
        insights: {
          recommendations: result.recommendations,
          suggested_specialist: result.suggested_specialist,
          optional_lab_tests: result.optional_lab_tests,
          disclaimer: result.disclaimer,
        },
      });

      console.log("Step 4: success");
      return res.status(201).json({
        assessment_id: assessment._id,
        ...result,
        createdAt: assessment.createdAt,
      });
    } catch (error) {
      console.error("🔥 PMS ERROR:", error);
      return res.status(500).json({
        message: "Failed to assess patient risk via PMS",
        error: error.message,
      });
    }
  }
);

// POST /api/v1/predictive-analysis/pms/from-pms/:patientId
router.post(
  "/pms/from-pms/:patientId",
  requireApiKey,
  pmsRateLimiter,
  pmsRequestLogger,
  runPmsAssessment
);

// GET /api/v1/predictive-analysis/risk-assessment/user?id=PATIENT_ID
router.get("/risk-assessment/user", requireAuth, async (req, res) => {
  try {
    console.log("RISK REQUEST FOR:", req.query.id);
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ message: "Missing patient_id" });
    }

    const result = await Assessment.findOne({ "inputs.patient_id": id }).sort({ createdAt: -1 });

    if (!result) {
      return res.status(200).json({ data: null });
    }

    return res.json({ data: result });
  } catch (err) {
    console.error("RISK FETCH ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/predictive-analysis/user-history
router.get("/user-history", requireAuth, async (req, res) => {
  try {
    const history = await Assessment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user history" });
  }
});

module.exports = router;
