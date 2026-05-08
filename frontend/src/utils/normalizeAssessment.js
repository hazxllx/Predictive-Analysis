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

  const riskScore = Number(source?.risk_score ?? source?.riskScore);
  const normalizedRiskScore = Number.isFinite(riskScore) ? riskScore : null;

  if (!source?.risk_level && normalizedRiskScore === null && recommendations.length === 0) {
    return null;
  }

  return {
    ...source,
    risk_score: normalizedRiskScore,
    recommendations,
    specialists,
    suggested_specialist: specialists,
    lab_tests: labTests,
    optional_lab_tests: labTests,
    breakdown,
    disclaimer: disclaimer || null,
    createdAt: source?.createdAt || source?.timestamp || source?.updatedAt || null,
    insights: {
      ...(insights || {}),
      recommendations,
      suggested_specialist: specialists,
      optional_lab_tests: labTests,
      breakdown,
      disclaimer: disclaimer || null,
    },
  };
};
