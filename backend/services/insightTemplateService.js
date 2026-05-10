/**
 * Insight Template Service
 *
 * Builds deterministic, human-readable insights from assessment results.
 * Analyzes lifestyle signals, vitals, risk trends, and recommendations
 * to produce a structured patient-facing summary.
 */

// Safely coerce a value to a trimmed string
function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// Safely coerce a value to a finite number (null if invalid)
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Parse a blood pressure string (e.g., "120/80") into systolic/diastolic numbers
function parseBloodPressure(value) {
  const text = cleanText(value);
  if (!text.includes("/")) return { systolic: null, diastolic: null };
  const [systolic, diastolic] = text.split("/").map((part) => toNumber(part));
  return { systolic, diastolic };
}

// Find the highest-scoring risk factor from the assessment breakdown
function getTopBreakdownFactor(breakdown = []) {
  const list = Array.isArray(breakdown) ? breakdown : [];
  return list
    .filter((item) => Number(item?.points) > 0)
    .sort((a, b) => Number(b.points) - Number(a.points))[0] || null;
}

// Map internal risk levels to patient-friendly labels
function getPatientFacingRiskLabel(riskLevel) {
  if (riskLevel === "Low") return "Healthy Range";
  if (riskLevel === "Moderate") return "Needs Monitoring";
  if (riskLevel === "High") return "Elevated Risk";
  if (riskLevel === "Critical") return "Immediate Attention Recommended";
  return "Needs Monitoring";
}

// Extract boolean lifestyle flags from patient data (smoking, diet, activity, etc.)
function getLifestyleSignals(patient = {}) {
  const lifestyle = patient?.lifestyle || {};
  const diet = cleanText(lifestyle?.diet).toLowerCase();
  const activity = cleanText(lifestyle?.physical_activity || lifestyle?.physicalActivity).toLowerCase();

  return {
    smoking: Boolean(lifestyle?.smoking),
    alcohol: Boolean(lifestyle?.alcohol),
    highSodium: diet.includes("salt") || diet.includes("sodium"),
    processedFood: diet.includes("processed") || diet.includes("fried"),
    sugaryBeverages: diet.includes("sugar") || diet.includes("soft drink") || diet.includes("soda"),
    poorSleep: cleanText(lifestyle?.sleep).toLowerCase().includes("poor"),
    stress: cleanText(lifestyle?.stress).toLowerCase().includes("high"),
    lowWaterIntake:
      cleanText(lifestyle?.water_intake || lifestyle?.waterIntake).toLowerCase().includes("low"),
    sedentary:
      activity.includes("sedentary") ||
      activity.includes("inactive") ||
      activity.includes("desk") ||
      activity.includes("no exercise"),
    medicationNonCompliance:
      cleanText(lifestyle?.medication_adherence || lifestyle?.medicationAdherence)
        .toLowerCase()
        .includes("non"),
  };
}

// Extract boolean vitals flags (elevated BP, obesity, tachycardia)
function getVitalsSignals(patient = {}) {
  const vitals = patient?.vitals || {};
  const { systolic, diastolic } = parseBloodPressure(vitals?.blood_pressure);
  const bmi = toNumber(vitals?.bmi);
  const heartRate = toNumber(vitals?.heart_rate);

  return {
    elevatedBP: (systolic && systolic >= 130) || (diastolic && diastolic >= 85),
    highBP: (systolic && systolic >= 140) || (diastolic && diastolic >= 90),
    obesity: bmi ? bmi >= 30 : false,
    tachycardia: heartRate ? heartRate > 100 : false,
  };
}

// Compare current vs previous risk score to generate a trend summary
function buildTrendSummary(currentRiskScore, previousRiskScore) {
  const curr = toNumber(currentRiskScore);
  const prev = toNumber(previousRiskScore);

  if (curr === null || prev === null) {
    return {
      trendDirection: "insufficient-data",
      trendSummary: "Complete another assessment to establish your health trend.",
      progressInterpretation:
        "Your next assessment will help determine whether current routines are improving your health profile.",
    };
  }

  const delta = curr - prev;
  if (delta <= -4) {
    return {
      trendDirection: "improving",
      trendSummary: "Your recent trend shows improvement in overall risk.",
      progressInterpretation:
        "Your risk profile is improving. Continue your current care plan and sustain healthy routines.",
    };
  }

  if (delta >= 4) {
    return {
      trendDirection: "worsening",
      trendSummary: "Your recent trend suggests rising risk markers that need attention.",
      progressInterpretation:
        "Your risk profile increased. Focus on your top recommendations and monitor key vitals closely.",
    };
  }

  return {
    trendDirection: "stable",
    trendSummary: "Your recent trend is generally stable.",
    progressInterpretation:
      "Your profile is stable. Small, consistent lifestyle improvements can still produce meaningful gains.",
  };
}

// Build the complete insight payload from assessment, patient, and optional previous assessment
function buildDeterministicInsights({ assessment = {}, patient = {}, previousAssessment = null }) {
  const riskLevel = cleanText(assessment?.risk_level) || "Moderate";
  const riskScore = toNumber(assessment?.risk_score ?? assessment?.riskScore) ?? 0;
  const recommendations = Array.isArray(assessment?.recommendations) ? assessment.recommendations : [];
  const breakdown = Array.isArray(assessment?.breakdown) ? assessment.breakdown : [];
  const topFactor = getTopBreakdownFactor(breakdown);
  const patientRiskLabel = getPatientFacingRiskLabel(riskLevel);
  const lifestyle = getLifestyleSignals(patient);
  const vitals = getVitalsSignals(patient);

  const previousRiskScore = toNumber(previousAssessment?.risk_score);
  const trend = buildTrendSummary(riskScore, previousRiskScore);

  const topRiskFactor = cleanText(topFactor?.label) || "Recent health markers";
  const whatMattersMost = topRiskFactor;

  const nextSteps = [];
  if (recommendations.length > 0) nextSteps.push(...recommendations.slice(0, 3));

  if (vitals.highBP && lifestyle.highSodium) {
    nextSteps.push("Reduce high-sodium foods and monitor blood pressure readings daily.");
  }
  if (lifestyle.sedentary) {
    nextSteps.push("Start with light daily movement and gradually build toward 150 minutes weekly.");
  }
  if (lifestyle.smoking) {
    nextSteps.push("Prioritize smoking cessation support to reduce long-term cardiovascular and respiratory risk.");
  }

  const uniqueNextSteps = [...new Set(nextSteps.map((item) => cleanText(item)).filter(Boolean))].slice(0, 5);

  const lifestyleFocusItems = [];
  if (lifestyle.highSodium) lifestyleFocusItems.push("Lower sodium intake");
  if (lifestyle.processedFood) lifestyleFocusItems.push("Reduce processed and fried foods");
  if (lifestyle.sugaryBeverages) lifestyleFocusItems.push("Limit sugary beverages");
  if (lifestyle.sedentary) lifestyleFocusItems.push("Increase regular physical activity");
  if (lifestyle.lowWaterIntake) lifestyleFocusItems.push("Improve daily hydration");
  if (lifestyle.poorSleep) lifestyleFocusItems.push("Strengthen sleep routine");
  if (lifestyle.stress) lifestyleFocusItems.push("Use stress-management strategies");
  if (lifestyle.medicationNonCompliance) lifestyleFocusItems.push("Improve medication adherence");

  const lifestyleFocus = lifestyleFocusItems.length
    ? lifestyleFocusItems.join(", ")
    : "Maintain your current healthy routines and preventive habits.";

  const preventiveGuidance = vitals.highBP
    ? "Schedule regular blood pressure follow-up and maintain a low-sodium diet."
    : "Maintain annual preventive checkups and continue monitoring your routine health markers.";

  const predictiveOutlook =
    trend.trendDirection === "improving"
      ? "If current routines continue, your next assessments may remain favorable."
      : trend.trendDirection === "worsening"
      ? "With timely lifestyle adjustments and monitoring, this risk trajectory can still be improved."
      : "Consistent healthy routines are likely to keep your profile stable over future assessments.";

  const healthSummary = `Your current health status is categorized as ${patientRiskLabel}. The strongest contributing factor is ${whatMattersMost.toLowerCase()}.`;

  return {
    patient_facing_risk_label: patientRiskLabel,
    what_matters_most: whatMattersMost,
    top_risk_factor: topRiskFactor,
    recommended_next_steps: uniqueNextSteps,
    health_summary: healthSummary,
    progress_interpretation: trend.progressInterpretation,
    lifestyle_focus: lifestyleFocus,
    preventive_guidance: preventiveGuidance,
    trend_summary: trend.trendSummary,
    predictive_outlook: predictiveOutlook,
  };
}

module.exports = {
  buildDeterministicInsights,
  getPatientFacingRiskLabel,
};
