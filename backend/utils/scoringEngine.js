/**
 * Balanced Scoring Engine — Preventive Wellness Risk Calculator
 *
 * Refactored to produce realistic, non-alarmist risk scores that
 * recognize both risk factors AND healthy behaviors.
 *
 * Philosophy:
 * - Low = genuinely healthy
 * - Moderate = common/manageable risks
 * - High = multiple concerning risks
 * - Critical = rare severe combinations
 *
 * Features:
 * - Scaled condition weights (prevents over-reaction)
 * - Protective/negative scoring for healthy behaviors
 * - Category caps (prevents infinite stacking)
 * - Controlled vs uncontrolled condition weights
 * - Reduced escalation bonuses
 * - Balanced risk thresholds
 * - Preventive, non-alarmist recommendations
 * - Safe clamping 0–100
 * - Dev-only logging (never logs PII)
 */

const { CLINICAL_TAG_REGISTRY } = require("../constants/clinicalTags");
const { extractClinicalRiskFactors } = require("./medicalNormalization");

const isDev = process.env.NODE_ENV === "development";

// ── Configuration ──

const WEIGHT_SCALE = 0.5;

const CATEGORY_CAPS = {
  Cardiovascular: 30,
  Metabolic: 25,
  Respiratory: 20,
  Renal: 25,
  Neurological: 20,
  "Mental Health": 15,
  Oncology: 25,
  Reproductive: 15,
  Infectious: 15,
  Musculoskeletal: 15,
  Lifestyle: 18,
  "Family History": 15,
  Demographics: 20,
  Vitals: 20,
  Escalation: 15,
};

// ── Disclaimer ──

const DISCLAIMER =
  "This assessment is for informational purposes only and does not replace professional medical advice. It is designed to encourage preventive wellness and guide conversations with your healthcare provider.";

// ── Helpers ──

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text || "";
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function addContribution(target, label, category, points) {
  if (points === 0) return;
  target.push({ label, category, points });
}

// ── Age Scoring ──

function getAgePoints(age) {
  const a = toNumber(age);
  if (a === null) return 0;
  if (a >= 65) return 12;
  if (a >= 50) return 8;
  if (a >= 40) return 5;
  return 0;
}

// ── Vitals Scoring ──

function parseBloodPressure(value) {
  const text = cleanText(value);
  if (!text.includes("/")) return { systolic: null, diastolic: null };
  const [systolic, diastolic] = text.split("/").map((part) => toNumber(part));
  return { systolic, diastolic };
}

function calculateBMI(weight, height) {
  const w = toNumber(weight);
  const h = toNumber(height);
  if (!w || !h) return null;
  const heightInMeters = h > 100 ? h / 100 : h;
  if (heightInMeters <= 0) return null;
  return w / (heightInMeters * heightInMeters);
}

function getVitalsContributions(vitals = {}) {
  const contributions = [];
  const { systolic, diastolic } = parseBloodPressure(vitals?.blood_pressure);

  // Blood Pressure — risk and protective
  if ((systolic && systolic >= 160) || (diastolic && diastolic >= 100)) {
    addContribution(contributions, "Severe hypertension (≥160/100)", "Vitals", 6);
  } else if ((systolic && systolic >= 140) || (diastolic && diastolic >= 90)) {
    addContribution(contributions, "Stage 2 hypertension (140-159/90-99)", "Vitals", 5);
  } else if ((systolic && systolic >= 130) || (diastolic && diastolic >= 85)) {
    addContribution(contributions, "Elevated blood pressure (130-139/85-89)", "Vitals", 3);
  } else if (systolic && systolic < 120 && diastolic && diastolic < 80) {
    addContribution(contributions, "Normal Blood Pressure", "Protective Factors", -8);
  }

  // Heart Rate — risk and protective
  const heartRate = toNumber(vitals?.heart_rate);
  if (heartRate && heartRate > 100) {
    addContribution(contributions, "Tachycardia (elevated resting heart rate)", "Vitals", 3);
  } else if (heartRate && heartRate < 50 && heartRate > 0) {
    addContribution(contributions, "Bradycardia (low resting heart rate)", "Vitals", 2);
  } else if (heartRate && heartRate >= 60 && heartRate <= 100) {
    addContribution(contributions, "Healthy Heart Rate", "Protective Factors", -5);
  }

  // Respiratory Rate — risk and protective
  const respiratoryRate = toNumber(vitals?.respiratory_rate);
  if (respiratoryRate && (respiratoryRate > 20 || respiratoryRate < 12)) {
    addContribution(contributions, "Abnormal respiratory rate", "Vitals", 2);
  } else if (respiratoryRate && respiratoryRate >= 12 && respiratoryRate <= 20) {
    addContribution(contributions, "Normal Respiratory Rate", "Protective Factors", -4);
  }

  // Temperature
  const temperature = toNumber(vitals?.temperature);
  if (temperature && temperature >= 100.4) {
    addContribution(contributions, "Elevated temperature", "Vitals", 2);
  }

  // BMI — risk and protective
  const bmi = calculateBMI(vitals?.weight, vitals?.height);
  if (bmi && bmi >= 30) {
    if (bmi >= 35) {
      addContribution(contributions, "Class 2 obesity (BMI ≥35)", "Vitals", 5);
    } else {
      addContribution(contributions, "Obesity (BMI 30-34.9)", "Vitals", 4);
    }
  } else if (bmi && bmi >= 25) {
    addContribution(contributions, "Overweight (BMI 25-29.9)", "Vitals", 2);
  } else if (bmi && bmi >= 18.5 && bmi < 25) {
    addContribution(contributions, "Healthy BMI", "Protective Factors", -6);
  }

  return contributions;
}

// ── Controlled vs Uncontrolled ──

function isConditionControlled(tag, vitals = {}, lifestyle = {}) {
  const { systolic, diastolic } = parseBloodPressure(vitals?.blood_pressure);
  const glucose = toNumber(vitals?.blood_glucose || vitals?.bloodGlucose);
  const hba1c = toNumber(vitals?.hba1c || vitals?.HbA1c);
  const medAdherence = cleanText(lifestyle?.medication_adherence || lifestyle?.medicationAdherence).toLowerCase();
  const lastVisit = lifestyle?.last_visit_date || null;

  const hasGoodAdherence = medAdherence.includes("good") || medAdherence.includes("consistent") || medAdherence.includes("compliant");
  const hasRecentVisit = lastVisit && (new Date() - new Date(lastVisit)) / (1000 * 60 * 60 * 24 * 30) <= 6;

  switch (tag) {
    case "Hypertension":
      if (systolic && diastolic) {
        if (systolic < 130 && diastolic < 85) return true;
        if (systolic >= 140 || diastolic >= 90) return false;
      }
      return hasGoodAdherence && hasRecentVisit ? true : null;

    case "Diabetes":
    case "Type 1 Diabetes":
    case "Type 2 Diabetes":
      if (glucose && hba1c) {
        if (glucose < 126 && hba1c < 7.0) return true;
        if (glucose >= 180 || hba1c >= 9.0) return false;
      } else if (glucose) {
        if (glucose < 126) return true;
        if (glucose >= 180) return false;
      } else if (hba1c) {
        if (hba1c < 7.0) return true;
        if (hba1c >= 9.0) return false;
      }
      return hasGoodAdherence ? true : null;

    case "Asthma":
    case "COPD":
      return hasGoodAdherence ? true : null;

    default:
      return null;
  }
}

// ── Protective Factors ──

function getProtectiveFactors(lifestyle = {}, vitals = {}, lastVisitDate = null) {
  const factors = [];

  const diet = cleanText(lifestyle?.diet).toLowerCase();
  if (diet.includes("balanced") || diet.includes("healthy") || diet.includes("mediterranean")) {
    addContribution(factors, "Balanced Diet", "Protective Factors", -8);
  }

  const activity = cleanText(lifestyle?.physical_activity || lifestyle?.physicalActivity).toLowerCase();
  if (activity.includes("active") || activity.includes("moderate") || activity.includes("regular") || activity.includes("vigorous")) {
    addContribution(factors, "Active Lifestyle", "Protective Factors", -10);
  } else if (activity.includes("light") || activity.includes("some")) {
    addContribution(factors, "Light Physical Activity", "Protective Factors", -4);
  }

  if (lifestyle?.smoking === false) {
    addContribution(factors, "Non-Smoker", "Protective Factors", -8);
  }

  if (lifestyle?.alcohol === false) {
    addContribution(factors, "No Alcohol Use", "Protective Factors", -5);
  }

  const sleep = cleanText(lifestyle?.sleep).toLowerCase();
  if (sleep.includes("good") || sleep.includes("7-9") || sleep.includes("8 hours") || sleep.includes("adequate") || sleep.includes("7 hours") || sleep.includes("9 hours")) {
    addContribution(factors, "Good Sleep Habits", "Protective Factors", -4);
  }

  const stress = cleanText(lifestyle?.stress).toLowerCase();
  if (stress.includes("low") || stress.includes("managed") || stress.includes("minimal")) {
    addContribution(factors, "Low Stress Level", "Protective Factors", -3);
  }

  const medAdherence = cleanText(lifestyle?.medication_adherence || lifestyle?.medicationAdherence).toLowerCase();
  if (medAdherence.includes("good") || medAdherence.includes("consistent") || medAdherence.includes("compliant")) {
    addContribution(factors, "Good Medication Adherence", "Protective Factors", -5);
  }

  if (lastVisitDate) {
    const lastVisit = new Date(lastVisitDate);
    const monthsSinceVisit = (new Date() - lastVisit) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceVisit <= 6) {
      addContribution(factors, "Routine Checkups", "Protective Factors", -4);
    }
  }

  return factors;
}

// ── Risk Escalation Logic ──

function applyRiskEscalation(canonicalTags, breakdown) {
  const tags = new Set(canonicalTags);
  const has = (t) => tags.has(t);

  if (has("Hypertension") && has("Diabetes") && has("Smoking")) {
    addContribution(breakdown, "Major cardiovascular escalation (HTN + DM + Smoking)", "Escalation", 6);
  }

  if ((has("CKD") || has("Kidney Disease") || has("Kidney Failure")) && has("Diabetes")) {
    addContribution(breakdown, "Critical metabolic/renal escalation (CKD + Diabetes)", "Escalation", 7);
  }

  if ((has("Obesity") || has("Overweight")) && has("Sedentary Lifestyle")) {
    addContribution(breakdown, "Increased metabolic risk (Obesity + Sedentary)", "Escalation", 4);
  }

  if (has("Smoking") && (has("COPD") || has("Asthma"))) {
    addContribution(breakdown, "Severe respiratory escalation (Smoking + COPD/Asthma)", "Escalation", 5);
  }

  if (has("Stroke") && (has("Heart Disease") || has("Heart Attack") || has("Coronary Artery Disease"))) {
    addContribution(breakdown, "Critical neurological/cardiovascular risk (Stroke + Heart Disease)", "Escalation", 7);
  }

  if (has("Hypertension") && has("High Cholesterol")) {
    addContribution(breakdown, "Accelerated atherosclerosis risk (HTN + High Cholesterol)", "Escalation", 4);
  }

  if (has("Diabetes") && has("High Cholesterol")) {
    addContribution(breakdown, "High cardiovascular risk (Diabetes + Dyslipidemia)", "Escalation", 4);
  }

  if (has("Pregnancy") && has("Hypertension")) {
    addContribution(breakdown, "Preeclampsia risk (Pregnancy + Hypertension)", "Escalation", 5);
  }

  if (has("Pregnancy") && has("Diabetes")) {
    addContribution(breakdown, "Gestational diabetes risk (Pregnancy + Diabetes)", "Escalation", 4);
  }

  const familyHistories = canonicalTags.filter((t) => t.startsWith("Family History"));
  if (familyHistories.length >= 3) {
    addContribution(breakdown, "Significant genetic/family risk burden (≥3 family history risks)", "Escalation", 3);
  }

  const lifestyleRiskCount = canonicalTags.filter((t) => {
    const entry = CLINICAL_TAG_REGISTRY[t];
    return entry && entry.category === "Lifestyle";
  }).length;
  if (lifestyleRiskCount >= 4) {
    addContribution(breakdown, "High lifestyle risk clustering (≥4 lifestyle factors)", "Escalation", 3);
  }

  if (isDev) {
    const escalationItems = breakdown.filter((b) => b.category === "Escalation");
    if (escalationItems.length > 0) {
      console.log("[SCORING] Escalations applied:", escalationItems.map((i) => i.label));
    }
  }
}

// ── Category Caps ──

function applyCategoryCaps(breakdown) {
  const categoryTotals = {};
  breakdown.forEach((item) => {
    if (!item?.category || item.points <= 0) return;
    categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.points;
  });

  Object.entries(categoryTotals).forEach(([category, total]) => {
    const cap = CATEGORY_CAPS[category];
    if (cap && total > cap) {
      const excess = total - cap;
      addContribution(breakdown, `${category} category cap applied`, "Adjustments", -excess);
    }
  });

  return breakdown;
}

// ── Recommendation Engine ──

function buildRecommendations(canonicalTags, riskLevel) {
  const recommendations = [];
  const seen = new Set();

  const addRec = (text) => {
    const t = cleanText(text);
    if (!t || seen.has(t)) return;
    seen.add(t);
    recommendations.push(t);
  };

  canonicalTags.forEach((tag) => {
    const entry = CLINICAL_TAG_REGISTRY[tag];
    if (entry?.recommendations) {
      entry.recommendations.forEach(addRec);
    }
  });

  if (riskLevel === "Critical") {
    addRec("Schedule a comprehensive health assessment as soon as possible");
    addRec("Discuss this assessment with your primary care provider");
    addRec("Ensure all prescribed medications are being taken as directed");
  } else if (riskLevel === "High") {
    addRec("Schedule a health assessment appointment within the next few weeks");
    addRec("Begin tracking your health metrics consistently");
  } else if (riskLevel === "Moderate") {
    addRec("Schedule a preventive health check-up");
    addRec("Begin implementing lifestyle improvements gradually");
  } else {
    addRec("Continue your healthy habits and maintain regular preventive care");
    addRec("Schedule an annual wellness check-up");
  }

  if (!recommendations.some((r) => r.toLowerCase().includes("checkup") || r.toLowerCase().includes("assessment") || r.toLowerCase().includes("wellness"))) {
    addRec("Maintain regular preventive health checkups at least annually");
  }
  addRec("Stay hydrated and maintain consistent sleep (7–9 hours nightly)");

  return recommendations.slice(0, 14);
}

// ── Specialists & Labs ──

function buildSpecialists(canonicalTags, riskLevel, vitals) {
  const specialists = new Set();

  canonicalTags.forEach((tag) => {
    const entry = CLINICAL_TAG_REGISTRY[tag];
    if (entry?.specialists) {
      entry.specialists.forEach((s) => specialists.add(s));
    }
  });

  const { systolic, diastolic } = parseBloodPressure(vitals?.blood_pressure);
  if ((systolic && systolic >= 140) || (diastolic && diastolic >= 90)) {
    specialists.add("Cardiologist");
  }

  if ((riskLevel === "High" || riskLevel === "Critical") && specialists.size === 0) {
    specialists.add("Internal Medicine");
  }

  return Array.from(specialists);
}

function buildLabTests(canonicalTags, riskLevel, vitals) {
  const tests = new Set();

  canonicalTags.forEach((tag) => {
    const entry = CLINICAL_TAG_REGISTRY[tag];
    if (entry?.labTests) {
      entry.labTests.forEach((t) => tests.add(t));
    }
  });

  const { systolic, diastolic } = parseBloodPressure(vitals?.blood_pressure);
  if ((systolic && systolic >= 130) || (diastolic && diastolic >= 85)) {
    tests.add("Blood Pressure Monitoring");
    tests.add("ECG");
  }

  if (riskLevel === "High" || riskLevel === "Critical") {
    tests.add("Comprehensive Metabolic Panel");
    tests.add("Complete Blood Count (CBC)");
    tests.add("Lipid Profile");
  }

  return Array.from(tests);
}

// ── Risk Level ──

function getRiskLevel(score) {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Moderate";
  return "Low";
}

// ── Main Scoring Function ──

function scorePatient(data = {}) {
  const patientId = cleanText(data?.patient_id || data?.patientId) || null;
  const age = Number(data?.age) || 0;
  const lifestyle = data?.lifestyle || {};
  const vitals = data?.vitals || {};
  const lastVisitDate = data?.last_visit_date || null;

  const breakdown = [];

  // Age
  addContribution(breakdown, "Age", "Demographics", getAgePoints(age));

  // Extract & normalize clinical tags
  const canonicalTags = extractClinicalRiskFactors(data);

  if (isDev) {
    console.log("[SCORING] Canonical tags:", canonicalTags);
  }

  // Condition weights with controlled/uncontrolled logic
  canonicalTags.forEach((tag) => {
    const entry = CLINICAL_TAG_REGISTRY[tag];
    if (entry) {
      const baseWeight = Math.round(entry.weight * WEIGHT_SCALE);
      const controlStatus = isConditionControlled(tag, vitals, lifestyle);

      let weight = baseWeight;
      let label = tag;

      if (controlStatus === true) {
        weight = Math.round(baseWeight * 0.5);
        label = `${tag} (well-managed)`;
      } else if (controlStatus === false) {
        weight = baseWeight;
        label = `${tag} (uncontrolled)`;
      }

      addContribution(breakdown, label, entry.category, weight);
    }
  });

  // Vitals
  breakdown.push(...getVitalsContributions(vitals));

  // Protective factors (lifestyle + vitals)
  breakdown.push(...getProtectiveFactors(lifestyle, vitals, lastVisitDate));

  // Escalation
  applyRiskEscalation(canonicalTags, breakdown);

  // Category caps
  applyCategoryCaps(breakdown);

  // Final score (clamp 0–100)
  const rawScore = breakdown.reduce((sum, item) => sum + (Number(item?.points) || 0), 0);
  const score = Math.min(Math.max(rawScore, 0), 100);
  const riskLevel = getRiskLevel(score);

  // Recommendations
  const recommendations = buildRecommendations(canonicalTags, riskLevel);
  const specialists = buildSpecialists(canonicalTags, riskLevel, vitals);
  const labTests = buildLabTests(canonicalTags, riskLevel, vitals);

  // Score breakdown object (includes negative values)
  const scoreBreakdown = breakdown.reduce((acc, item) => {
    const label = cleanText(item?.label);
    const points = Number(item?.points) || 0;
    if (!label) return acc;
    acc[label] = (acc[label] || 0) + points;
    return acc;
  }, {});

  if (isDev) {
    console.log(`[SCORING] Final score: ${score} (${riskLevel}) for patient ${patientId || "N/A"}`);
  }

  return {
    patient_id: patientId,
    riskScore: score,
    risk_score: score,
    risk_level: riskLevel,
    recommendations,
    suggested_specialist: specialists,
    specialists,
    optional_lab_tests: labTests,
    lab_tests: labTests,
    breakdown,
    score_breakdown: scoreBreakdown,
    disclaimer: DISCLAIMER,
    clinical_tags: canonicalTags,
  };
}

module.exports = {
  scorePatient,
  getRiskLevel,
  getAgePoints,
  getVitalsContributions,
  applyRiskEscalation,
  buildRecommendations,
  buildSpecialists,
  buildLabTests,
  DISCLAIMER,
};
