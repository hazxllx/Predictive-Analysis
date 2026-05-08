/**
 * Predictive Analysis routes
 * - Patient-triggered risk assessment (JWT protected)
 * - Authenticated user history
 */

const express = require("express");
const router = express.Router();

const { requireAuth, staffOnly } = require("../middleware/auth");
const { scorePatient } = require("../services/scoring");
const { fetchPatient } = require("../services/pmsService");
const Assessment = require("../models/Assessment");

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text || "";
}

function normalizeBreakdown(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => ({
        label: cleanText(item?.label),
        category: cleanText(item?.category),
        points: Number(item?.points) || 0,
      }))
      .filter((item) => item.label && item.points > 0);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([label, points]) => ({
        label: cleanText(label),
        category: "",
        points: Number(points) || 0,
      }))
      .filter((item) => item.label && item.points > 0);
  }

  return [];
}

function serializeAssessment(raw = {}) {
  const source = typeof raw?.toObject === "function" ? raw.toObject() : raw;
  const insights = source?.insights || {};
  const recommendations = source?.recommendations || insights?.recommendations || [];
  const specialists =
    source?.specialists ||
    source?.suggested_specialist ||
    insights?.suggested_specialist ||
    [];
  const labTests =
    source?.lab_tests ||
    source?.optional_lab_tests ||
    insights?.optional_lab_tests ||
    [];
  const breakdown = normalizeBreakdown(
    source?.breakdown || source?.score_breakdown || insights?.breakdown
  );
  const disclaimer = cleanText(source?.disclaimer || insights?.disclaimer);

  return {
    _id: source?._id || source?.assessment_id || null,
    assessment_id: source?.assessment_id || source?._id || null,
    patient_id: source?.patient_id || source?.inputs?.patient_id || null,
    risk_score: Number(source?.risk_score ?? source?.riskScore ?? 0),
    risk_level: source?.risk_level || null,
    confidence: source?.confidence || null,
    recommendations,
    suggested_specialist: specialists,
    specialists,
    optional_lab_tests: labTests,
    lab_tests: labTests,
    breakdown,
    disclaimer,
    createdAt: source?.createdAt || source?.timestamp || null,
    updatedAt: source?.updatedAt || null,
    inputs: source?.inputs || null,
    insights: {
      recommendations,
      suggested_specialist: specialists,
      optional_lab_tests: labTests,
      breakdown,
      disclaimer,
    },
  };
}

function buildAssessmentInput(patient = {}, overrides = {}) {
  return {
    patient_id: patient?.patient_id || overrides?.patient_id || overrides?.patientId || null,
    age: Number(overrides?.age ?? patient?.age ?? 0) || 0,
    lifestyle:
      overrides?.lifestyle && typeof overrides.lifestyle === "object"
        ? { ...patient?.lifestyle, ...overrides.lifestyle }
        : patient?.lifestyle || {},
    vitals:
      overrides?.vitals && typeof overrides.vitals === "object"
        ? { ...patient?.vitals, ...overrides.vitals }
        : patient?.vitals || {},
    patient_record: Array.isArray(overrides?.patient_record)
      ? overrides.patient_record
      : Array.isArray(patient?.patient_record)
      ? patient.patient_record
      : [],
    condition_categories: Array.isArray(overrides?.condition_categories)
      ? overrides.condition_categories
      : Array.isArray(patient?.condition_categories)
      ? patient.condition_categories
      : [],
  };
}

// POST /api/v1/predictive-analysis/risk-assessment
router.post("/risk-assessment", requireAuth, staffOnly, async (req, res) => {
  try {
    const patientId = cleanText(req.body?.patient_id || req.body?.patientId);
    let assessmentInput = req.body;

    if (patientId) {
      const patient = await fetchPatient(patientId);

      if (!patient?.patient_id) {
        return res.status(404).json({ message: "Patient not found" });
      }

      assessmentInput = buildAssessmentInput(patient, req.body);
    }

    const result = scorePatient(assessmentInput);
    const serializedResult = serializeAssessment(result);

    const assessment = await Assessment.create({
      userId: req.user._id,
      patient_id: serializedResult.patient_id || null,
      risk_score: serializedResult.risk_score,
      risk_level: serializedResult.risk_level,
      inputs: assessmentInput,
      insights: {
        recommendations: serializedResult.recommendations,
        suggested_specialist: serializedResult.suggested_specialist,
        optional_lab_tests: serializedResult.optional_lab_tests,
        disclaimer: serializedResult.disclaimer,
        breakdown: serializedResult.breakdown,
      },
    });

    return res.status(201).json(
      serializeAssessment({
        assessment_id: assessment._id,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
        inputs: assessmentInput,
        ...serializedResult,
      })
    );
  } catch (error) {
    console.error("ASSESSMENT ERROR:", error.message);
    return res.status(500).json({ message: "Failed to assess patient risk" });
  }
});

// GET /api/v1/predictive-analysis/risk-assessment/user?id=PATIENT_ID
router.get("/risk-assessment/user", requireAuth, async (req, res) => {
  try {
    const id = cleanText(req.query.id);

    if (!id) {
      return res.status(400).json({ message: "Missing patient_id" });
    }

    const result = await Assessment.findOne({
      $or: [{ "inputs.patient_id": id }, { patient_id: id }],
    }).sort({ createdAt: -1 });

    if (!result) {
      return res.status(200).json({ data: null });
    }

    return res.json({ data: serializeAssessment(result) });
  } catch (err) {
    console.error("RISK FETCH ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/v1/predictive-analysis/user-history
router.get("/user-history", requireAuth, async (req, res) => {
  try {
    const history = await Assessment.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json(history.map((entry) => serializeAssessment(entry)));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user history" });
  }
});

module.exports = router;
