/**
 * Assessment Routes
 *
 * Predictive Analysis routes:
 * - PMS integration endpoints (authenticated via API key)
 * - Admin can run and inspect assessments for any PMS patient
 * - Patients can run and inspect only their linked PMS patient record
 *
 * Business logic is handled by assessmentController.
 */

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { pmsAuth } = require("../middleware/pmsAuth");
const {
  createRiskAssessment,
  getRiskAssessment,
  getAssessmentHistory,
  getLatestByPatient,
  getAllAssessments,
  getUserHistory,
  updateRiskAssessment,
} = require("../controllers/assessmentController");
const { healthCheck } = require("../controllers/healthController");
const { sanitizeBody, assessmentValidators, getAssessmentValidators } = require("../middleware/validate");

// Health Check (PMS can use this to verify PAS availability)
router.get("/health", healthCheck);

// PMS Integration Endpoints (API Key Authenticated)
// All prefixed with /pms to avoid collision with internal app endpoints
// POST /api/v1/predictive-analysis/pms/risk-assessment
router.post("/pms/risk-assessment", pmsAuth, sanitizeBody, assessmentValidators, createRiskAssessment);

// GET /api/v1/predictive-analysis/pms/risk-assessment?id=patientId
router.get("/pms/risk-assessment", pmsAuth, getRiskAssessment);

// GET /api/v1/predictive-analysis/pms/risk-assessment/history?id=patientId
router.get("/pms/risk-assessment/history", pmsAuth, getAssessmentHistory);

// PUT /api/v1/predictive-analysis/pms/risk-assessment/:assessmentId
router.put("/pms/risk-assessment/:assessmentId", pmsAuth, sanitizeBody, updateRiskAssessment);

// Internal App Endpoints (JWT Authenticated)
// POST for patients/admins to run new assessments
router.post("/risk-assessment", requireAuth, sanitizeBody, assessmentValidators, createRiskAssessment);
router.get("/risk-assessment/user", requireAuth, getAssessmentValidators, getRiskAssessment);
router.get("/risk-assessment/history", requireAuth, getAssessmentHistory);
router.get("/risk-assessment/latest-by-patient", requireAuth, getLatestByPatient);
router.get("/risk-assessment/all", requireAuth, getAllAssessments);
router.get("/user-history", requireAuth, getUserHistory);

module.exports = router;
