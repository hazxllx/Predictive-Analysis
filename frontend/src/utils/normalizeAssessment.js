import { cleanText } from "./normalizePatients";

const ensureArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }
  return [];
};

const inferCategory = (label = "") => {
  const normalized = cleanText(label).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("age")) return "Demographics";
  if (
    normalized.includes("smoking") ||
    normalized.includes("alcohol") ||
    normalized.includes("diet") ||
    normalized.includes("activity") ||
    normalized.includes("lifestyle")
  ) {
    return "Lifestyle";
  }
  if (
    normalized.includes("pressure") ||
    normalized.includes("temperature") ||
    normalized.includes("heart rate")
  ) {
    return "Vitals";
  }
  return "Medical History";
};

const normalizeBreakdown = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        label: cleanText(item?.label),
        category: cleanText(item?.category) || inferCategory(item?.label),
        points: Number(item?.points) || 0,
      }))
      .filter((item) => item.label && item.points > 0);
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([label, points]) => ({
        label: cleanText(label),
        category: inferCategory(label),
        points: Number(points) || 0,
      }))
      .filter((item) => item.label && item.points > 0);
  }

  return [];
};

/**
 * Canonical score system:
 * - Risk Score = raw backend risk (0-100, higher = more risk)
 * - Risk Level = categorical bucket from backend
 */

export const getAssessmentRiskScore = (assessment) => {
  if (!assessment || typeof assessment !== "object") return null;

  const scoreCandidates = [
    assessment?.risk_score,
    assessment?.riskScore,
    assessment?.score,
    assessment?.data?.risk_score,
    assessment?.data?.riskScore,
    assessment?.data?.score,
    assessment?.insights?.risk_score,
    assessment?.insights?.riskScore,
  ];

  for (const candidate of scoreCandidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  return null;
};

export const getAssessmentRiskLevel = (assessment) => {
  if (!assessment || typeof assessment !== "object") return null;

  const levelCandidates = [
    assessment?.risk_level,
    assessment?.riskLevel,
    assessment?.data?.risk_level,
    assessment?.data?.riskLevel,
    assessment?.insights?.risk_level,
    assessment?.insights?.riskLevel,
  ];

  const validLevels = new Set(["Low", "Moderate", "High", "Critical"]);
  for (const candidate of levelCandidates) {
    const text = cleanText(candidate);
    if (validLevels.has(text)) return text;
  }

  return null;
};

export const normalizeAssessment = (value) => {
  if (!value || typeof value !== "object") return null;

  const source = value?.data && typeof value.data === "object" ? value.data : value;
  const insights = source?.insights || {};

  const recommendations = ensureArray(source?.recommendations || insights?.recommendations);
  const specialists = ensureArray(
    source?.specialists || source?.suggested_specialist || insights?.suggested_specialist
  );
  const labTests = ensureArray(
    source?.lab_tests || source?.optional_lab_tests || insights?.optional_lab_tests
  );
  const breakdown = normalizeBreakdown(
    source?.breakdown || source?.score_breakdown || insights?.breakdown
  );
  const disclaimer = cleanText(source?.disclaimer || insights?.disclaimer);
  const structuredInsights = source?.structured_insights || insights?.structured_insights || null;

  const normalizedRiskScore = getAssessmentRiskScore(source);
  const normalizedRiskLevel = getAssessmentRiskLevel(source);

  if (!normalizedRiskLevel && normalizedRiskScore === null && recommendations.length === 0) {
    return null;
  }

  return {
    ...source,
    risk_score: normalizedRiskScore,
    risk_level: normalizedRiskLevel,
    recommendations,
    specialists,
    suggested_specialist: specialists,
    lab_tests: labTests,
    optional_lab_tests: labTests,
    breakdown,
    disclaimer: disclaimer || null,
    createdAt: source?.createdAt || source?.timestamp || source?.updatedAt || null,
    structured_insights: structuredInsights,
    insights: {
      ...(insights || {}),
      recommendations,
      suggested_specialist: specialists,
      optional_lab_tests: labTests,
      breakdown,
      disclaimer: disclaimer || null,
      structured_insights: structuredInsights,
    },
  };
};
