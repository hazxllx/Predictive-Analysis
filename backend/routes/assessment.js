/**
 * Predictive Analysis routes
 * - Admin can run and inspect assessments for any PMS patient
 * - Patients can run and inspect only their linked PMS patient record
 */

const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
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
    last_visit_date: patient?.last_visit_date || null,
  };
}

function validateAssessmentInput(input = {}) {
  const missing = [];
  const lifestyle = input?.lifestyle || {};

  if (!cleanText(input?.patient_id)) missing.push("patient_id");
  if (!Number.isFinite(Number(input?.age)) || Number(input?.age) <= 0) missing.push("age");

  ["smoking", "alcohol", "diet", "physical_activity"].forEach((field) => {
    const value = lifestyle?.[field];
    if (value === undefined || value === null || cleanText(value) === "") {
      missing.push(`lifestyle.${field}`);
    }
  });

  return missing;
}

function canAccessPatient(req, patientId) {
  if (req.user.role === "admin") return true;
  return req.user.role === "patient" && String(req.user.patient_id) === String(patientId);
}

async function getLatestAssessment(patientId) {
  return Assessment.findOne({
    $or: [{ patient_id: patientId }, { "inputs.patient_id": patientId }],
  })
    .sort({ createdAt: -1 })
    .lean();
}

router.post("/risk-assessment", requireAuth, async (req, res) => {
  try {
    const requestedPatientId = cleanText(req.body?.patient_id || req.body?.patientId);
    const patientId = req.user.role === "patient" ? cleanText(req.user.patient_id) : requestedPatientId;

    if (!patientId) {
      return res.status(400).json({ message: "Missing patient_id" });
    }
    if (!canAccessPatient(req, patientId)) {
      return res.status(403).json({ message: "Patients can only assess their own PMS record" });
    }
    if (req.user.role !== "admin" && req.user.role !== "patient") {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const patient = await fetchPatient(patientId);
    if (!patient?.patient_id) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const assessmentInput = buildAssessmentInput(patient, { ...req.body, patient_id: patientId });
    const missingFields = validateAssessmentInput(assessmentInput);

    if (missingFields.length > 0) {
      return res.status(422).json({
        message: "PMS patient data is incomplete for assessment",
        missing_fields: missingFields,
      });
    }

    const result = scorePatient(assessmentInput);
    const serializedResult = serializeAssessment(result);

    const assessment = await Assessment.create({
      userId: req.user._id,
      patient_id: serializedResult.patient_id || patientId,
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
    console.error("Assessment error:", error.message);
    const status = error.message === "Patient not found in PMS" ? 404 : 500;
    return res.status(status).json({
      message: status === 404 ? "Patient not found" : "Failed to assess patient risk",
    });
  }
});

router.get("/risk-assessment/user", requireAuth, async (req, res) => {
  try {
    const id = cleanText(req.query.id);

    if (!id) {
      return res.status(400).json({ message: "Missing patient_id" });
    }
    if (!canAccessPatient(req, id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await getLatestAssessment(id);
    return res.json({ data: result ? serializeAssessment(result) : null });
  } catch (err) {
    console.error("Risk fetch error:", err.message);
    return res.status(500).json({ message: "Failed to fetch assessment" });
  }
});

router.get("/risk-assessment/history", requireAuth, async (req, res) => {
  try {
    const id = req.user.role === "patient" ? cleanText(req.user.patient_id) : cleanText(req.query.id);

    if (!id) {
      return res.status(400).json({ message: "Missing patient_id" });
    }
    if (!canAccessPatient(req, id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const history = await Assessment.find({
      $or: [{ patient_id: id }, { "inputs.patient_id": id }],
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ data: history.map((entry) => serializeAssessment(entry)) });
  } catch (error) {
    console.error("Assessment history error:", error.message);
    return res.status(500).json({ message: "Failed to fetch assessment history" });
  }
});

router.get("/risk-assessment/latest-by-patient", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const latest = await Assessment.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$patient_id", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
    ]);

    const data = latest.reduce((acc, entry) => {
      if (entry?.patient_id) acc[entry.patient_id] = serializeAssessment(entry);
      return acc;
    }, {});

    return res.json({ data });
  } catch (error) {
    console.error("Bulk assessment fetch error:", error.message);
    return res.status(500).json({ message: "Failed to fetch assessments" });
  }
});

router.get("/risk-assessment/all", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
    const assessments = await Assessment.find({}).sort({ createdAt: -1 }).limit(limit).lean();

    return res.json({ data: assessments.map((entry) => serializeAssessment(entry)) });
  } catch (error) {
    console.error("Assessment list error:", error.message);
    return res.status(500).json({ message: "Failed to fetch assessments" });
  }
});

router.get("/user-history", requireAuth, async (req, res) => {
  try {
    const history = await Assessment.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json(history.map((entry) => serializeAssessment(entry)));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user history" });
  }
});

module.exports = router;
