/**
 * Predictive Analysis Subsystem Scoring Engine
 * // scoring logic based on subsystem rules
 */

const MEDICAL_HISTORY_POINTS = {
  cardiovascular: 20,
  metabolic: 18,
  respiratory: 15,
  renal: 15,
  mental: 12,
  cancer: 20,
};

const SPECIALIST_MAP = {
  cardiovascular: "Cardiologist",
  metabolic: "Endocrinologist",
  respiratory: "Pulmonologist",
  renal: "Nephrologist",
  mental: "Psychiatrist",
  cancer: "Oncologist",
};

const LAB_TEST_MAP = {
  metabolic: ["Blood glucose"],
  cardiovascular: ["ECG"],
  renal: ["Kidney function"],
};

function getRiskLevel(score) {
  if (score >= 70) return "Critical";
  if (score >= 45) return "High";
  if (score >= 20) return "Moderate";
  return "Low";
}

function getRecommendations(lifestyle = {}) {
  const recommendations = [];

  if (lifestyle.smoking) recommendations.push("Stop smoking");
  if (lifestyle.alcohol) recommendations.push("Reduce alcohol intake");
  if (lifestyle.diet === "poor") recommendations.push("Improve diet");
  if (lifestyle.physical_activity === "sedentary") {
    recommendations.push("Increase activity");
  }

  if (recommendations.length === 0) {
    recommendations.push("Maintain a healthy lifestyle");
  }

  return recommendations;
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function scorePatient(data = {}) {
  const { age = 0, lifestyle = {}, patient_record = [], patient_id = null } = data;

  let score = 0;

  // AGE
  if (age >= 65) score += 18;
  else if (age >= 50) score += 12;
  else if (age >= 40) score += 8;

  // LIFESTYLE
  if (lifestyle.smoking) score += 15;
  if (lifestyle.alcohol) score += 12;
  if (lifestyle.diet === "poor") score += 10;
  if (lifestyle.physical_activity === "sedentary") score += 10;
  else if (lifestyle.physical_activity === "light") score += 4;

  // MEDICAL HISTORY (additive only)
  for (const condition of patient_record) {
    const normalized = String(condition || "").toLowerCase().trim();
    if (MEDICAL_HISTORY_POINTS[normalized]) {
      score += MEDICAL_HISTORY_POINTS[normalized];
    }
  }

  const risk_level = getRiskLevel(score);

  const specialists = uniqueValues(
    patient_record
      .map((c) => SPECIALIST_MAP[String(c || "").toLowerCase().trim()])
      .filter(Boolean)
  );

  const lab_tests = uniqueValues(
    patient_record.flatMap((c) => LAB_TEST_MAP[String(c || "").toLowerCase().trim()] || [])
  );

  return {
    patient_id,
    riskScore: score,
    risk_score: score,
    risk_level,
    recommendations: getRecommendations(lifestyle),
    suggested_specialist: specialists,
    optional_lab_tests: lab_tests,
    disclaimer: "Guidance only; consult a healthcare professional.",
  };
}

module.exports = { scorePatient };
