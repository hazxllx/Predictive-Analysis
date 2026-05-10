/**
 * Frontend Medical Taxonomy
 *
 * Mirror of backend/constants/clinicalTags.js for client-side validation.
 * Used to:
 * - Reject junk/free-text terms
 * - Normalize clinical tags before rendering
 * - Ensure only medically valid tags appear in UI
 *
 * Note: This is a subset of the full backend taxonomy focused on
 * validation and normalization. Full scoring weights and recommendations
 * are calculated on the backend.
 */

/**
 * Rejected terms — these are NEVER valid medical tags.
 * Any input matching these (case-insensitive, after trim) is silently rejected.
 */
const REJECTED_TERMS = new Set([
  "wala lang",
  "need help",
  "okay lang",
  "none",
  "unknown",
  "n/a",
  "test",
  "lorem ipsum",
  "placeholder",
  "random",
  "comment",
  "note",
  "todo",
  "check",
  "review",
  "pending",
  "na",
  "wala",
  "hindi alam",
  "di alam",
  "ewan",
  "basta",
  "sige",
  "ok",
  "oks",
  "okay",
  "fine",
  "good",
  "no issues",
  "no problem",
  "none noted",
  "not applicable",
  "not available",
  "not sure",
  "unsure",
  "maybe",
  "possibly",
  "probably",
  "",
]);

/**
 * Common Filipino/common aliases to canonical medical labels.
 * This is a subset for frontend normalization.
 */
const ALIAS_MAP = new Map([
  // Cardiovascular
  ["high blood", "Hypertension"],
  ["mataas blood", "Hypertension"],
  ["highblood", "Hypertension"],
  ["high bp", "Hypertension"],
  ["bp mataas", "Hypertension"],
  ["low blood", "Hypotension"],
  ["lowblood", "Hypotension"],
  ["low bp", "Hypotension"],
  ["na-stroke", "Stroke"],
  ["cva", "Stroke"],
  ["sakit sa puso", "Heart Disease"],
  ["heart problem", "Heart Disease"],
  ["inaatake sa puso", "Heart Attack"],
  ["myocardial infarction", "Heart Attack"],
  ["chest pain", "Angina"],
  ["sakit sa dibdib", "Angina"],
  ["high cholesterol", "High Cholesterol"],
  ["hyperlipidemia", "High Cholesterol"],
  ["mataas cholesterol", "High Cholesterol"],

  // Metabolic
  ["sugar", "Diabetes"],
  ["diabetes mellitus", "Diabetes"],
  ["dm", "Diabetes"],
  ["high blood sugar", "Diabetes"],
  ["mataas sugar", "Diabetes"],
  ["mahilig matamis", "Diabetes"],
  ["type 1 diabetes", "Type 1 Diabetes"],
  ["t1dm", "Type 1 Diabetes"],
  ["type 2 diabetes", "Type 2 Diabetes"],
  ["t2dm", "Type 2 Diabetes"],
  ["prediabetes", "Prediabetes"],
  ["borderline diabetes", "Prediabetes"],
  ["obesity", "Obesity"],
  ["sobrang taba", "Obesity"],
  ["overweight", "Overweight"],
  ["medyo mataba", "Overweight"],
  ["fatty liver", "Fatty Liver"],
  ["sakit sa atay", "Fatty Liver"],
  ["thyroid disease", "Thyroid Disease"],
  ["sakit sa thyroid", "Thyroid Disease"],
  ["gout", "Gout"],
  ["rayuma", "Gout"],
  ["uric acid", "Gout"],

  // Respiratory
  ["asthma", "Asthma"],
  ["hika", "Asthma"],
  ["copd", "COPD"],
  ["chronic obstructive pulmonary disease", "COPD"],
  ["pneumonia", "Pneumonia"],
  ["pulmonya", "Pneumonia"],
  ["tuberculosis", "Tuberculosis"],
  ["tb", "Tuberculosis"],
  ["chronic bronchitis", "Chronic Bronchitis"],
  ["emphysema", "Emphysema"],
  ["sleep apnea", "Sleep Apnea"],
  ["allergic rhinitis", "Allergic Rhinitis"],
  ["sinusitis", "Sinusitis"],
  ["sinus infection", "Sinusitis"],

  // Renal
  ["ckd", "CKD"],
  ["chronic kidney disease", "CKD"],
  ["kidney disease", "Kidney Disease"],
  ["renal disease", "Kidney Disease"],
  ["sakit sa bato", "Kidney Disease"],
  ["kidney failure", "Kidney Failure"],
  ["renal failure", "Kidney Failure"],
  ["kidney stones", "Kidney Stones"],
  ["nephrolithiasis", "Kidney Stones"],
  ["bato sa bato", "Kidney Stones"],
  ["uti", "UTI"],
  ["urinary tract infection", "UTI"],
  ["enlarged prostate", "Enlarged Prostate"],
  ["bph", "Enlarged Prostate"],
  ["prostate", "Prostate"],
  ["dialysis", "Dialysis History"],
  ["nagses dialysis", "Dialysis History"],

  // Neurological
  ["epilepsy", "Epilepsy"],
  ["seizure disorder", "Seizure Disorder"],
  ["seizure", "Seizure Disorder"],
  ["kinukuryente", "Seizure Disorder"],
  ["migraine", "Migraine"],
  ["sakit ng ulo", "Migraine"],
  ["parkinson disease", "Parkinson's Disease"],
  ["parkinsons", "Parkinson's Disease"],
  ["alzheimer disease", "Alzheimer's Disease"],
  ["alzheimers", "Alzheimer's Disease"],
  ["dementia", "Dementia"],
  ["nakakalimot", "Dementia"],
  ["neuropathy", "Neuropathy"],
  ["namamanhid", "Neuropathy"],
  ["bell palsy", "Bell's Palsy"],
  ["namatay na mukha", "Bell's Palsy"],

  // Mental Health
  ["anxiety", "Anxiety"],
  ["kinakabahan", "Anxiety"],
  ["pagkabalisa", "Anxiety"],
  ["depression", "Depression"],
  ["sadness", "Depression"],
  ["lungkot", "Depression"],
  ["bipolar", "Bipolar Disorder"],
  ["bipolar disorder", "Bipolar Disorder"],
  ["schizophrenia", "Schizophrenia"],
  ["psychosis", "Schizophrenia"],
  ["panic disorder", "Panic Disorder"],
  ["panic attack", "Panic Disorder"],
  ["namamatay pakiramdam", "Panic Disorder"],
  ["ptsd", "PTSD"],
  ["post-traumatic stress", "PTSD"],
  ["stress", "Stress Disorder"],
  ["sobrang stress", "Stress Disorder"],
  ["insomnia", "Insomnia"],
  ["hirap matulog", "Insomnia"],
  ["puyat", "Insomnia"],

  // Oncology
  ["cancer", "Cancer"],
  ["kanser", "Cancer"],
  ["tumor", "Cancer"],
  ["breast cancer", "Breast Cancer"],
  ["cancer sa dede", "Breast Cancer"],
  ["lung cancer", "Lung Cancer"],
  ["cancer sa baga", "Lung Cancer"],
  ["colon cancer", "Colon Cancer"],
  ["cancer sa bituka", "Colon Cancer"],
  ["liver cancer", "Liver Cancer"],
  ["cancer sa atay", "Liver Cancer"],
  ["cervical cancer", "Cervical Cancer"],
  ["prostate cancer", "Prostate Cancer"],
  ["leukemia", "Leukemia"],
  ["blood cancer", "Leukemia"],
  ["thyroid cancer", "Thyroid Cancer"],

  // Reproductive
  ["pregnancy", "Pregnancy"],
  ["buntis", "Pregnancy"],
  ["high risk pregnancy", "High Risk Pregnancy"],
  ["abortion", "Abortion"],
  ["miscarriage", "Miscarriage"],
  ["nawala bata", "Miscarriage"],
  ["pcos", "PCOS"],
  ["endometriosis", "Endometriosis"],
  ["menopause", "Menopause"],
  ["pagkapagpala", "Menopause"],
  ["gestational diabetes", "Gestational Diabetes"],
  ["preeclampsia", "Preeclampsia"],

  // Infectious
  ["dengue", "Dengue"],
  ["dengue fever", "Dengue"],
  ["covid-19", "COVID-19"],
  ["covid", "COVID-19"],
  ["coronavirus", "COVID-19"],
  ["hepatitis", "Hepatitis"],
  ["hepa", "Hepatitis"],
  ["hiv", "HIV/AIDS"],
  ["hiv/aids", "HIV/AIDS"],
  ["typhoid", "Typhoid Fever"],
  ["leptospirosis", "Leptospirosis"],
  ["lepto", "Leptospirosis"],
  ["sakit dala ng baha", "Leptospirosis"],
  ["chickenpox", "Chickenpox"],
  ["bulutong", "Chickenpox"],
  ["measles", "Measles"],
  ["tigdas", "Measles"],

  // Musculoskeletal
  ["arthritis", "Arthritis"],
  ["rayuma", "Arthritis"],
  ["sakit sa kasuksuan", "Arthritis"],
  ["osteoarthritis", "Osteoarthritis"],
  ["osteoarthritis", "Osteoarthritis"],
  ["osteoporosis", "Osteoporosis"],
  ["pagka-pangang ng buto", "Osteoporosis"],
  ["scoliosis", "Scoliosis"],
  ["chronic back pain", "Chronic Back Pain"],
  ["sakit sa likod", "Chronic Back Pain"],
  ["joint pain", "Joint Pain"],
  ["rheumatism", "Rheumatism"],

  // Lifestyle
  ["smoking", "Smoking"],
  ["smoker", "Smoking"],
  ["cigarette", "Smoking"],
  ["yosi", "Smoking"],
  ["sigarilyo", "Smoking"],
  ["vape", "Vape Use"],
  ["vaping", "Vape Use"],
  ["e-cigarette", "Vape Use"],
  ["alcohol", "Alcohol Use"],
  ["drinking", "Alcohol Use"],
  ["inom", "Alcohol Use"],
  ["tagay", "Alcohol Use"],
  ["sedentary", "Sedentary Lifestyle"],
  ["inactive", "Sedentary Lifestyle"],
  ["no exercise", "Sedentary Lifestyle"],
  ["puro upo", "Sedentary Lifestyle"],
  ["poor diet", "Poor Diet"],
  ["unhealthy diet", "Poor Diet"],
  ["junk food", "Poor Diet"],
  ["matabang pagkain", "Poor Diet"],
  ["high sodium", "High Sodium Diet"],
  ["salty", "High Sodium Diet"],
  ["mahilig sa alat", "High Sodium Diet"],
  ["maalat", "High Sodium Diet"],
  ["high sugar", "High Sugar Diet"],
  ["sugary", "High Sugar Diet"],
  ["mahilig matamis", "High Sugar Diet"],
  ["lack of exercise", "Lack of Exercise"],
  ["no workout", "Lack of Exercise"],
  ["sleep deprivation", "Sleep Deprivation"],
  ["kulang sa tulog", "Sleep Deprivation"],
  ["puyat", "Sleep Deprivation"],
  ["chronic stress", "Chronic Stress"],
  ["sobrang stress", "Chronic Stress"],

  // Family History
  ["family history of stroke", "Family History of Stroke"],
  ["stroke sa pamilya", "Family History of Stroke"],
  ["family history of diabetes", "Family History of Diabetes"],
  ["diabetes sa pamilya", "Family History of Diabetes"],
  ["family history of hypertension", "Family History of Hypertension"],
  ["high blood sa pamilya", "Family History of Hypertension"],
  ["family history of cancer", "Family History of Cancer"],
  ["cancer sa pamilya", "Family History of Cancer"],
  ["family history of heart disease", "Family History of Heart Disease"],
  ["sakit sa puso sa pamilya", "Family History of Heart Disease"],
  ["family history of kidney disease", "Family History of Kidney Disease"],
  ["kidney sa pamilya", "Family History of Kidney Disease"],
]);

/**
 * Clean and sanitize raw medical input
 */
function sanitizeMedicalInput(raw) {
  if (raw === null || raw === undefined) return "";
  let text = String(raw).trim();
  if (!text) return "";

  // Strip excessive special chars but keep hyphens and apostrophes
  text = text.replace(/[^a-zA-Z0-9\s\-'.()\/]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Check if a term is rejected junk/free-text
 */
function isRejectedTerm(text) {
  if (!text) return true;
  const normalized = String(text).trim().toLowerCase();
  if (!normalized) return true;

  // Exact match in rejected set
  if (REJECTED_TERMS.has(normalized)) return true;

  // Symbols-only check
  if (/^[\W_]+$/.test(normalized)) return true;

  // Very short meaningless strings (<=2 chars)
  if (normalized.length <= 2) return true;

  // Common placeholder patterns
  if (/^test\d*$/i.test(normalized)) return true;
  if (/^(lorem|ipsum|placeholder|sample|demo|mock|fake)/i.test(normalized)) return true;
  if (/^(comment|note|remark|feedback|survey|answer)\s*\d*$/i.test(normalized)) return true;

  return false;
}

/**
 * Normalize a single clinical tag input to its canonical label.
 * Returns the canonical label string if valid, otherwise null.
 */
function normalizeClinicalTag(raw) {
  const sanitized = sanitizeMedicalInput(raw);
  if (!sanitized) return null;
  const lower = sanitized.toLowerCase();

  if (isRejectedTerm(lower)) {
    return null;
  }

  // Direct alias map lookup
  const canonical = ALIAS_MAP.get(lower);
  if (canonical) {
    return canonical;
  }

  // Fuzzy prefix / substring matching for unmapped common terms
  const fuzzyMatches = [];
  for (const [alias, canonicalLabel] of ALIAS_MAP.entries()) {
    if (lower.includes(alias) || alias.includes(lower)) {
      fuzzyMatches.push({ canonical: canonicalLabel, alias });
    }
  }

  if (fuzzyMatches.length > 0) {
    // Prefer the longest alias match (most specific)
    fuzzyMatches.sort((a, b) => b.alias.length - a.alias.length);
    return fuzzyMatches[0].canonical;
  }

  return null;
}

/**
 * Filter an array of raw tags; returns only valid canonical labels.
 * Duplicates are removed.
 */
function filterValidClinicalTags(rawTags = []) {
  if (!Array.isArray(rawTags)) return [];

  const seen = new Set();
  const valid = [];

  for (const raw of rawTags) {
    const canonical = normalizeClinicalTag(raw);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      valid.push(canonical);
    }
  }

  return valid;
}

/**
 * Extract clinical risk factors from patient data objects.
 */
function extractClinicalRiskFactors(patientData = {}) {
  const sources = [];

  // Medical history / condition categories
  if (Array.isArray(patientData.condition_categories)) {
    sources.push(...patientData.condition_categories);
  }
  if (Array.isArray(patientData.patient_record)) {
    sources.push(...patientData.patient_record);
  }
  if (Array.isArray(patientData.conditions)) {
    sources.push(...patientData.conditions);
  }
  if (Array.isArray(patientData.diagnoses)) {
    sources.push(...patientData.diagnoses);
  }

  return filterValidClinicalTags(sources);
}

export {
  REJECTED_TERMS,
  ALIAS_MAP,
  sanitizeMedicalInput,
  isRejectedTerm,
  normalizeClinicalTag,
  filterValidClinicalTags,
  extractClinicalRiskFactors,
};
