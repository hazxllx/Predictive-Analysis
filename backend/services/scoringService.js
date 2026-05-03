/**
 * Description:
 * Computes patient risk score and care guidance using local rule-based logic.
 * Part of Predictive Analysis Subsystem.
 *
 * TODO: connect to predictive analysis subsystem
 * remove this hardcoded/rule-based scoring logic after integration
 */

/**
 * Description:
 * Executes risk assessment for a patient profile.
 *
 * Inputs:
 * - patient: age, lifestyle, medical_history, vitals, family_history
 *
 * Output:
 * - risk_score
 * - risk_level
 * - confidence
 * - recommendations
 * - specialists
 * - lab_tests
 * - score_breakdown
 */
const computeRiskScore = (patient) => {
  const breakdown = {};
  let score = 0;

  // Apply age scoring rules
  const age = patient.age || 0;
  let ageScore = 0;
  if (age >= 70) ageScore = 20;
  else if (age >= 60) ageScore = 15;
  else if (age >= 50) ageScore = 10;
  else if (age >= 40) ageScore = 6;
  else if (age >= 30) ageScore = 3;
  else ageScore = 1;
  breakdown.Age = ageScore;
  score += ageScore;

  // Apply lifestyle scoring rules
  const ls = patient.lifestyle || {};
  let lifestyleScore = 0;
  if (ls.smoking) lifestyleScore += 8;
  if (ls.alcohol) lifestyleScore += 4;

  const activityMap = { sedentary: 6, light: 3, moderate: 1, active: 0 };
  lifestyleScore += activityMap[ls.physical_activity] ?? 3;

  const dietMap = { poor: 5, average: 2, balanced: 0 };
  lifestyleScore += dietMap[ls.diet] ?? 2;

  const bmi = ls.bmi || 22;
  if (bmi >= 35) lifestyleScore += 6;
  else if (bmi >= 30) lifestyleScore += 4;
  else if (bmi >= 25) lifestyleScore += 2;

  breakdown.Lifestyle = lifestyleScore;
  score += lifestyleScore;

  // Apply medical history scoring rules
  const mh = patient.medical_history || {};
  let medScore = 0;
  if (mh.heart_disease) medScore += 15;
  if (mh.stroke) medScore += 12;
  if (mh.diabetes) medScore += 8;
  if (mh.hypertension) medScore += 6;
  if (mh.kidney_disease) medScore += 7;
  if (mh.copd) medScore += 6;
  if (mh.cancer) medScore += 10;
  if (mh.asthma) medScore += 3;
  breakdown["Medical History"] = medScore;
  score += medScore;

  // Apply vitals scoring rules
  const v = patient.vitals || {};
  let vitalsScore = 0;

  // Evaluate blood pressure
  if (v.blood_pressure) {
    const [sys, dia] = v.blood_pressure.split("/").map(Number);
    if (sys >= 160 || dia >= 100) vitalsScore += 8;
    else if (sys >= 140 || dia >= 90) vitalsScore += 5;
    else if (sys >= 130 || dia >= 85) vitalsScore += 2;
  }

  // Evaluate blood glucose
  const glucose = v.blood_glucose || 90;
  if (glucose >= 250) vitalsScore += 7;
  else if (glucose >= 180) vitalsScore += 4;
  else if (glucose >= 126) vitalsScore += 2;

  // Evaluate cholesterol
  const chol = v.cholesterol || 170;
  if (chol >= 240) vitalsScore += 5;
  else if (chol >= 200) vitalsScore += 2;

  // Evaluate oxygen saturation
  const spo2 = v.oxygen_saturation || 99;
  if (spo2 < 90) vitalsScore += 8;
  else if (spo2 < 94) vitalsScore += 4;
  else if (spo2 < 96) vitalsScore += 2;

  // Evaluate heart rate
  const hr = v.heart_rate || 72;
  if (hr > 100 || hr < 50) vitalsScore += 3;

  breakdown.Vitals = vitalsScore;
  score += vitalsScore;

  // Apply family history scoring rules
  const fh = patient.family_history || {};
  let famScore = 0;
  if (fh.heart_disease) famScore += 5;
  if (fh.diabetes) famScore += 3;
  if (fh.hypertension) famScore += 3;
  if (fh.cancer) famScore += 4;
  breakdown["Family History"] = famScore;
  score += famScore;

  // Cap final risk score at 100
  score = Math.min(score, 100);

  // Determine risk level from score
  let risk_level;
  if (score >= 70) risk_level = "Critical";
  else if (score >= 50) risk_level = "High";
  else if (score >= 30) risk_level = "Moderate";
  else risk_level = "Low";

  // Compute confidence from field completeness
  let filledFields = 0;
  if (patient.age) filledFields++;
  if (patient.lifestyle && Object.keys(patient.lifestyle).length >= 4) filledFields++;
  if (patient.medical_history && Object.keys(patient.medical_history).length >= 4) filledFields++;
  if (patient.vitals && Object.keys(patient.vitals).length >= 4) filledFields++;
  if (patient.family_history && Object.keys(patient.family_history).length >= 2) filledFields++;

  let confidence;
  if (filledFields >= 5) confidence = "High";
  else if (filledFields >= 3) confidence = "Medium";
  else confidence = "Low";

  // Generate recommendations
  const recommendations = [];
  if (ls.smoking) recommendations.push("Enroll in a smoking cessation program immediately.");
  if (ls.alcohol) recommendations.push("Reduce alcohol intake to safe levels (≤1 drink/day).");
  if (ls.physical_activity === "sedentary") recommendations.push("Begin a supervised exercise program (30 min/day, 5x/week).");
  if (ls.diet === "poor") recommendations.push("Consult a dietitian for a heart-healthy meal plan.");
  if (bmi >= 30) recommendations.push("Target a 5–10% body weight reduction through diet and exercise.");
  if (mh.diabetes || glucose >= 126) recommendations.push("Monitor blood glucose daily; maintain HbA1c < 7%.");
  if (mh.hypertension || (v.blood_pressure && parseInt(v.blood_pressure, 10) >= 140)) {
    recommendations.push("Monitor blood pressure twice daily; reduce sodium intake.");
  }
  if (chol >= 200) recommendations.push("Follow a low-cholesterol diet; consider statin therapy.");
  if (spo2 < 96) recommendations.push("Pulmonary evaluation recommended; avoid high-altitude activities.");
  if (mh.kidney_disease) recommendations.push("Limit protein and potassium intake; monitor creatinine levels.");
  if (score >= 50) recommendations.push("Schedule a comprehensive health assessment within 2 weeks.");
  if (score >= 70) recommendations.push("Immediate specialist referral and possible hospitalization required.");
  if (recommendations.length === 0) {
    recommendations.push("Maintain current healthy lifestyle. Annual check-up recommended.");
  }

  // Generate specialist referrals
  const specialists = [];
  if (mh.heart_disease || score >= 50) specialists.push("Cardiologist");
  if (mh.diabetes || glucose >= 126) specialists.push("Endocrinologist");
  if (mh.hypertension || mh.kidney_disease) specialists.push("Nephrologist");
  if (mh.copd || mh.asthma || spo2 < 96) specialists.push("Pulmonologist");
  if (mh.cancer) specialists.push("Oncologist");
  if (mh.stroke) specialists.push("Neurologist");
  if (bmi >= 30) specialists.push("Bariatric Specialist / Dietitian");
  if (score >= 70) specialists.push("Internal Medicine Specialist");
  const uniqueSpecialists = [...new Set(specialists)];
  if (uniqueSpecialists.length === 0) uniqueSpecialists.push("General Practitioner");

  // Generate lab test suggestions
  const lab_tests = [];
  if (score >= 30) lab_tests.push("Complete Blood Count (CBC)");
  if (mh.diabetes || glucose >= 100) lab_tests.push("HbA1c", "Fasting Blood Glucose");
  if (chol >= 180) lab_tests.push("Lipid Panel (Total Cholesterol, LDL, HDL, Triglycerides)");
  if (mh.kidney_disease || mh.hypertension) lab_tests.push("Creatinine & BUN", "Urinalysis");
  if (mh.heart_disease || score >= 50) lab_tests.push("ECG / 12-Lead Electrocardiogram", "Troponin I");
  if (mh.copd || spo2 < 96) lab_tests.push("Pulmonary Function Test (PFT)", "Chest X-Ray");
  if (score >= 70) lab_tests.push("Echocardiogram", "Renal Ultrasound");
  if (ls.smoking) lab_tests.push("Lung Cancer Screening (Low-dose CT)");
  const uniqueLabs = [...new Set(lab_tests)];
  if (uniqueLabs.length === 0) uniqueLabs.push("Annual Physical Exam Panel");

  return {
    risk_score: Math.round(score),
    risk_level,
    confidence,
    recommendations,
    specialists: uniqueSpecialists,
    lab_tests: uniqueLabs,
    score_breakdown: breakdown,
  };
};

module.exports = { computeRiskScore };
