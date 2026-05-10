/**
 * Assessment Controller
 *
 * Handles predictive analysis business logic:
 * - Running risk assessments for patients
 * - Retrieving assessment history
 * - Fetching latest assessments
 * - PMS integration endpoints (API key authenticated)
 *
 * Performance optimizations:
 * - lean() on all read queries to skip Mongoose hydration overhead
 * - select() to exclude unused fields (e.g., __v)
 * - Pagination on list endpoints to cap memory and bandwidth
 * - Non-blocking audit logging (fire-and-forget)
 * - Optimized aggregation pipeline with pre-filtering
 * - Dev-only logging for PMS integration debugging
 */

const { scorePatient } = require("../services/scoring");
const { fetchPatient } = require("../services/pmsService");
const { buildDeterministicInsights } = require("../services/insightTemplateService");
const { normalizeConditions } = require("../utils/medicalNormalization");
const Assessment = require("../models/Assessment");
const { auditAsync } = require("../services/auditService");
const { AUDIT_ACTIONS } = require("../utils/auditActions");

/**
 * Clean and normalize text values
 */
function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text || "";
}

/**
 * Normalize breakdown data from various formats
 */
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

/**
 * Serialize assessment object for API responses
 * Handles multiple field naming conventions for backward compatibility
 */
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
  const structuredInsights = source?.structured_insights || insights?.structured_insights || null;

  const rawRiskScore = Number(source?.risk_score ?? source?.riskScore ?? 0);

  return {
    _id: source?._id || source?.assessment_id || null,
    assessment_id: source?.assessment_id || source?._id || null,
    patient_id: source?.patient_id || source?.inputs?.patient_id || null,
    risk_score: rawRiskScore,
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
    structured_insights: structuredInsights,
    insights: {
      recommendations,
      suggested_specialist: specialists,
      optional_lab_tests: labTests,
      breakdown,
      disclaimer,
      structured_insights: structuredInsights,
    },
  };
}

/**
 * Build assessment input object from patient data and overrides
 */
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

/**
 * Validate assessment input for required fields
 * Supports both PMS and internal app request formats
 */
function validateAssessmentInput(input = {}, isPmsRequest = false) {
  const missing = [];
  const lifestyle = input?.lifestyle || {};
  const isDev = process.env.NODE_ENV === "development";

  if (!cleanText(input?.patient_id)) missing.push("patient_id");
  if (!Number.isFinite(Number(input?.age)) || Number(input?.age) <= 0) missing.push("age");

  // For PMS requests, lifestyle fields are required
  if (isPmsRequest) {
    ["smoking", "alcohol", "diet", "physical_activity"].forEach((field) => {
      const value = lifestyle?.[field];
      if (value === undefined || value === null || cleanText(value) === "") {
        missing.push(`lifestyle.${field}`);
      }
    });
  }

  if (isDev && missing.length > 0) {
    console.debug("[ASSESSMENT] Validation failed, missing fields:", missing);
  }

  return missing;
}

/**
 * Check if user can access patient data
 */
function canAccessPatient(req, patientId) {
  if (req.user.role === "admin") return true;
  return req.user.role === "patient" && String(req.user.patient_id) === String(patientId);
}

/**
 * Retrieve the most recent assessment for a patient
 */
async function getLatestAssessment(patientId) {
  return Assessment.findOne({
    $or: [{ patient_id: patientId }, { "inputs.patient_id": patientId }],
  })
    .sort({ createdAt: -1 })
    .select("-__v")
    .lean();
}

/**
 * Create a new risk assessment for a patient
 * Supports both PMS integration (API key) and internal app (JWT) requests
 */
const createRiskAssessment = async (req, res) => {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const isPmsRequest = Boolean(req.pmsAuthenticated);

    if (isDev) {
      console.log("[ASSESSMENT] Create request - PMS:", isPmsRequest, "Body keys:", Object.keys(req.body));
    }

    const requestedPatientId = cleanText(req.body?.patient_id || req.body?.patientId);
    const patientId = isPmsRequest ? requestedPatientId : (req.user.role === "patient" ? cleanText(req.user.patient_id) : requestedPatientId);

    if (!patientId) {
      if (isDev) console.debug("[ASSESSMENT] Missing patient_id");
      return res.status(400).json({ success: false, message: "Missing patient_id" });
    }

    // For internal app requests, check access permissions
    if (!isPmsRequest) {
      if (!canAccessPatient(req, patientId)) {
        return res.status(403).json({ success: false, message: "Patients can only assess their own PMS record" });
      }
      if (req.user.role !== "admin" && req.user.role !== "patient") {
        return res.status(403).json({ success: false, message: "Insufficient permissions" });
      }
    }

    // For PMS requests, use the provided data directly
    // For internal app requests, fetch patient data from PMS
    let patient;
    if (isPmsRequest) {
      // PMS provides complete patient data in request body
      patient = {
        patient_id: patientId,
        name: cleanText(req.body?.name),
        age: Number(req.body?.age) || 0,
        gender: cleanText(req.body?.gender),
        medical_history: Array.isArray(req.body?.medical_history) ? req.body.medical_history : [],
        previous_diagnosis: Array.isArray(req.body?.previous_diagnosis) ? req.body.previous_diagnosis : [],
        lifestyle: req.body?.lifestyle || {},
        vitals: req.body?.vitals || {},
      };

      if (isDev) {
        console.log("[ASSESSMENT] PMS patient data:", {
          patient_id: patient.patient_id,
          age: patient.age,
          medical_history_count: patient.medical_history.length,
          lifestyle_keys: Object.keys(patient.lifestyle),
        });
      }
    } else {
      // Internal app fetches from PMS service
      patient = await fetchPatient(patientId);
      if (!patient?.patient_id) {
        return res.status(404).json({ success: false, message: "Patient not found" });
      }
    }

    const assessmentInput = buildAssessmentInput(patient, { ...req.body, patient_id: patientId });
    const missingFields = validateAssessmentInput(assessmentInput, isPmsRequest);

    if (missingFields.length > 0) {
      if (isDev) console.debug("[ASSESSMENT] Validation failed:", missingFields);
      return res.status(422).json({
        success: false,
        message: isPmsRequest ? "Invalid request payload" : "PMS patient data is incomplete for assessment",
        missing_fields: missingFields,
      });
    }

    // Normalize medical conditions
    if (assessmentInput.patient_record) {
      const normalizedConditions = normalizeConditions(assessmentInput.patient_record);
      assessmentInput.normalized_conditions = normalizedConditions;
      if (isDev) {
        console.log("[ASSESSMENT] Normalized conditions:", normalizedConditions);
      }
    }

    const result = scorePatient(assessmentInput);
    const latestPreviousAssessment = await getLatestAssessment(patientId);

    const structuredInsights = buildDeterministicInsights({
      assessment: result,
      patient: assessmentInput,
      previousAssessment: latestPreviousAssessment,
    });

    const serializedResult = serializeAssessment({
      ...result,
      structured_insights: structuredInsights,
    });

    const assessment = await Assessment.create({
      userId: isPmsRequest ? null : req.user._id,
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
        structured_insights: serializedResult.structured_insights,
      },
    });

    if (isDev) {
      console.log("[ASSESSMENT] Assessment created:", {
        assessment_id: assessment._id,
        patient_id: assessment.patient_id,
        risk_score: assessment.risk_score,
        risk_level: assessment.risk_level,
      });
    }

    // Fire-and-forget audit (non-blocking, only for internal app requests)
    if (!isPmsRequest) {
      void auditAsync({
        user_id: req.user._id.toString(),
        action_type: AUDIT_ACTIONS.ASSESSMENT_CREATED,
        details: `Assessment created for patient ${patientId} with risk score ${serializedResult.risk_score}`,
        ip_addr: req.clientIP || "0.0.0.0",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Assessment generated successfully",
      data: serializeAssessment({
        assessment_id: assessment._id,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
        inputs: assessmentInput,
        ...serializedResult,
      }),
    });
  } catch (error) {
    console.error("Assessment error:", error.message);
    const status = error.message === "Patient not found in PMS" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: status === 404 ? "Patient not found" : "Failed to assess patient risk",
    });
  }
};

/**
 * Get the latest assessment for a specific patient
 * Supports both PMS (API key) and internal app (JWT) requests
 */
const getRiskAssessment = async (req, res) => {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const isPmsRequest = Boolean(req.pmsAuthenticated);
    const id = cleanText(req.query.id);

    if (isDev) {
      console.log("[ASSESSMENT] Get request - PMS:", isPmsRequest, "Patient ID:", id);
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Missing patient_id" });
    }

    // For internal app requests, check access permissions
    if (!isPmsRequest) {
      if (!canAccessPatient(req, id)) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const result = await getLatestAssessment(id);

    if (isDev) {
      console.log("[ASSESSMENT] Retrieved assessment:", result ? "Found" : "Not found");
    }

    // Fire-and-forget audit (non-blocking, only for internal app requests)
    if (!isPmsRequest && result) {
      void auditAsync({
        user_id: req.user._id.toString(),
        action_type: AUDIT_ACTIONS.ASSESSMENT_VIEWED,
        details: `Assessment viewed for patient ${id}`,
        ip_addr: req.clientIP || "0.0.0.0",
      });
    }

    return res.json({ 
      success: true, 
      message: result ? "Assessment retrieved successfully" : "No assessment found",
      data: result ? serializeAssessment(result) : null 
    });
  } catch (err) {
    console.error("Risk fetch error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch assessment" });
  }
};

/**
 * Get assessment history for a patient
 * Supports both PMS (API key) and internal app (JWT) requests
 */
const getAssessmentHistory = async (req, res) => {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const isPmsRequest = Boolean(req.pmsAuthenticated);
    const id = isPmsRequest ? cleanText(req.query.id) : (req.user.role === "patient" ? cleanText(req.user.patient_id) : cleanText(req.query.id));

    if (isDev) {
      console.log("[ASSESSMENT] History request - PMS:", isPmsRequest, "Patient ID:", id);
    }

    // For internal patient users without patient_id in JWT, fall back to userId-based query
    if (!isPmsRequest && req.user.role === "patient" && !id) {
      const history = await Assessment.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .select("-__v")
        .lean();

      if (isDev) {
        console.log("[ASSESSMENT] Retrieved history by userId:", history.length, "assessments");
      }

      return res.json({
        success: true,
        message: `Retrieved ${history.length} assessment records`,
        data: history.map((entry) => serializeAssessment(entry)),
      });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Missing patient_id" });
    }

    // For internal app requests, check access permissions
    if (!isPmsRequest) {
      if (!canAccessPatient(req, id)) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    }

    const history = await Assessment.find({
      $or: [{ patient_id: id }, { "inputs.patient_id": id }],
    })
      .sort({ createdAt: -1 })
      .select("-__v")
      .lean();

    if (isDev) {
      console.log("[ASSESSMENT] Retrieved history:", history.length, "assessments");
    }

    return res.json({ 
      success: true, 
      message: `Retrieved ${history.length} assessment records`,
      data: history.map((entry) => serializeAssessment(entry)) 
    });
  } catch (error) {
    console.error("Assessment history error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch assessment history" });
  }
};

/**
 * Get latest assessment by patient (admin only)
 *
 * Optimized aggregation: pre-filter to last 90 days before sorting to reduce
 * working set size on large collections.
 */
const getLatestByPatient = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const latest = await Assessment.aggregate([
      { $match: { createdAt: { $gte: ninetyDaysAgo } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$patient_id", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
    ]);

    const data = latest.reduce((acc, entry) => {
      if (entry?.patient_id) acc[entry.patient_id] = serializeAssessment(entry);
      return acc;
    }, {});

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Bulk assessment fetch error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch assessments" });
  }
};

/**
 * Get all assessments (admin only, with pagination)
 *
 * Defaults to 100 items per page; max 1000 to protect memory and bandwidth.
 */
const getAllAssessments = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access only" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const [assessments, total] = await Promise.all([
      Assessment.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-__v")
        .lean(),
      Assessment.countDocuments(),
    ]);

    if (process.env.NODE_ENV === "development") {
      console.log(`[ASSESSMENT] getAllAssessments: fetched ${assessments.length} of ${total} total`);
    }

    return res.json({
      success: true,
      data: assessments.map((entry) => serializeAssessment(entry)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Assessment list error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch assessments" });
  }
};

/**
 * Get current user's assessment history
 */
const getUserHistory = async (req, res) => {
  try {
    const history = await Assessment.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select("-__v")
      .lean();

    if (history.length > 0) {
      void auditAsync({
        user_id: req.user._id.toString(),
        action_type: AUDIT_ACTIONS.DASHBOARD_VIEWED,
        details: `User viewed assessment history (${history.length} assessments)`,
        ip_addr: req.clientIP || "0.0.0.0",
      });
    }

    return res.json({ success: true, data: history.map((entry) => serializeAssessment(entry)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch user history" });
  }
};

/**
 * Update an existing assessment (PMS only)
 * Allows updating lifestyle data and recomputing the assessment
 */
const updateRiskAssessment = async (req, res) => {
  try {
    const isDev = process.env.NODE_ENV === "development";
    const assessmentId = req.params.assessmentId || req.params.id;

    if (isDev) {
      console.log("[ASSESSMENT] Update request - Assessment ID:", assessmentId);
    }

    if (!assessmentId) {
      return res.status(400).json({ success: false, message: "Missing assessment_id" });
    }

    const assessment = await Assessment.findById(assessmentId).lean();
    if (!assessment) {
      return res.status(404).json({ success: false, message: "Assessment not found" });
    }

    // Build updated input with lifestyle overrides
    const updatedInput = {
      ...assessment.inputs,
      lifestyle: req.body?.lifestyle ? { ...assessment.inputs.lifestyle, ...req.body.lifestyle } : assessment.inputs.lifestyle,
      vitals: req.body?.vitals ? { ...assessment.inputs.vitals, ...req.body.vitals } : assessment.inputs.vitals,
    };

    // Validate updated input
    const missingFields = validateAssessmentInput(updatedInput, true);
    if (missingFields.length > 0) {
      if (isDev) console.debug("[ASSESSMENT] Update validation failed:", missingFields);
      return res.status(422).json({
        success: false,
        message: "Invalid request payload",
        missing_fields: missingFields,
      });
    }

    // Recompute assessment
    const result = scorePatient(updatedInput);
    const structuredInsights = buildDeterministicInsights({
      assessment: result,
      patient: updatedInput,
      previousAssessment: assessment,
    });

    const serializedResult = serializeAssessment({
      ...result,
      structured_insights: structuredInsights,
    });

    // Update assessment in database
    const updatedAssessment = await Assessment.findByIdAndUpdate(
      assessmentId,
      {
        risk_score: serializedResult.risk_score,
        risk_level: serializedResult.risk_level,
        inputs: updatedInput,
        insights: {
          recommendations: serializedResult.recommendations,
          suggested_specialist: serializedResult.suggested_specialist,
          optional_lab_tests: serializedResult.optional_lab_tests,
          disclaimer: serializedResult.disclaimer,
          breakdown: serializedResult.breakdown,
          structured_insights: serializedResult.structured_insights,
        },
      },
      { new: true }
    ).lean();

    if (isDev) {
      console.log("[ASSESSMENT] Assessment updated:", {
        assessment_id: updatedAssessment._id,
        patient_id: updatedAssessment.patient_id,
        risk_score: updatedAssessment.risk_score,
        risk_level: updatedAssessment.risk_level,
      });
    }

    return res.json({
      success: true,
      message: "Assessment updated successfully",
      data: serializeAssessment(updatedAssessment),
    });
  } catch (error) {
    console.error("Assessment update error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update assessment" });
  }
};

module.exports = {
  createRiskAssessment,
  getRiskAssessment,
  getAssessmentHistory,
  getLatestByPatient,
  getAllAssessments,
  getUserHistory,
  updateRiskAssessment,
};
