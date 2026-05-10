/**
 * Medical Normalization Helpers
 *
 * Centralized utilities to:
 * - sanitize medical input
 * - normalize clinical tags via taxonomy aliases
 * - reject junk / free-text / arbitrary values
 * - extract risk factors from raw patient data
 * - filter valid clinical tags before rendering
 *
 * Security:
 * - NEVER passes arbitrary text through as a medical tag
 * - All outputs are canonical labels from clinicalTags.js
 * - Rejected values return null / are silently dropped
 */

const {
  CLINICAL_TAG_REGISTRY,
  REJECTED_TERMS,
  ALIAS_MAP,
} = require("../constants/clinicalTags");

const isDev = process.env.NODE_ENV === "development";

/**
 * Clean and sanitize raw medical input
 * - Trims whitespace
 * - Removes excessive special characters
 * - Collapses multiple spaces
 */
function sanitizeMedicalInput(raw) {
  if (raw === null || raw === undefined) return "";
  let text = String(raw).trim();
  if (!text) return "";

  // Strip excessive special chars but keep hyphens and apostrophes for medical terms
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
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn("[MEDICAL] Rejected tag:", sanitized);
    }
    return null;
  }

  // Direct alias map lookup
  const canonical = ALIAS_MAP.get(lower);
  if (canonical) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log("[MEDICAL] Normalized tag:", sanitized, "->", canonical);
    }
    return canonical;
  }

  // Fuzzy prefix / substring matching for unmapped common terms
  // This handles minor variations not explicitly listed in aliases
  const fuzzyMatches = [];
  for (const [alias, canonicalLabel] of ALIAS_MAP.entries()) {
    // If input contains alias or alias contains input (for partial matches)
    if (lower.includes(alias) || alias.includes(lower)) {
      fuzzyMatches.push({ canonical: canonicalLabel, alias });
    }
  }

  if (fuzzyMatches.length > 0) {
    // Prefer the longest alias match (most specific)
    fuzzyMatches.sort((a, b) => b.alias.length - a.alias.length);
    const best = fuzzyMatches[0].canonical;
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log("[MEDICAL] Fuzzy normalized tag:", sanitized, "->", best);
    }
    return best;
  }

  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn("[MEDICAL] Unmapped tag (rejected):", sanitized);
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

  if (isDev) {
    const rejected = rawTags.length - valid.length;
    if (rejected > 0) {
      // eslint-disable-next-line no-console
      console.log(`[MEDICAL] Filtered ${rejected} invalid tags from ${rawTags.length} inputs`);
    }
  }

  return valid;
}

/**
 * Extract clinical risk factors from patient data objects.
 * Accepts:
 *   - condition_categories: string[]
 *   - patient_record: string[]
 *   - lifestyle object with boolean flags
 *   - family_history: string[]
 *
 * Returns array of canonical clinical tag labels.
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

  // Lifestyle booleans mapped to canonical tags
  const lifestyle = patientData.lifestyle || {};
  if (lifestyle.smoking) sources.push("Smoking");
  if (lifestyle.vape || lifestyle.vaping) sources.push("Vape Use");
  if (lifestyle.alcohol) sources.push("Alcohol Use");
  if (lifestyle.substance_abuse) sources.push("Substance Abuse");
  if (lifestyle.sedentary) sources.push("Sedentary Lifestyle");
  if (lifestyle.poor_diet) sources.push("Poor Diet");
  if (lifestyle.high_sodium) sources.push("High Sodium Diet");
  if (lifestyle.high_sugar) sources.push("High Sugar Diet");
  if (lifestyle.lack_exercise) sources.push("Lack of Exercise");
  if (lifestyle.sleep_deprivation) sources.push("Sleep Deprivation");
  if (lifestyle.chronic_stress) sources.push("Chronic Stress");
  if (lifestyle.excessive_caffeine) sources.push("Excessive Caffeine Intake");

  // Diet text normalization
  const dietText = sanitizeMedicalInput(lifestyle.diet);
  if (dietText) {
    const dlower = dietText.toLowerCase();
    if (dlower.includes("poor") || dlower.includes("junk") || dlower.includes("processed") || dlower.includes("unhealthy")) {
      sources.push("Poor Diet");
    }
    if (dlower.includes("salt") || dlower.includes("sodium") || dlower.includes("alat") || dlower.includes("maalat")) {
      sources.push("High Sodium Diet");
    }
    if (dlower.includes("sugar") || dlower.includes("matamis") || dlower.includes("soft drink") || dlower.includes("soda")) {
      sources.push("High Sugar Diet");
    }
  }

  // Physical activity text normalization
  const activityText = sanitizeMedicalInput(lifestyle.physical_activity || lifestyle.physicalActivity);
  if (activityText) {
    const alower = activityText.toLowerCase();
    if (alower.includes("sedentary") || alower.includes("inactive") || alower.includes("none") || alower.includes("no exercise")) {
      sources.push("Sedentary Lifestyle");
    }
    if (alower.includes("light") && !alower.includes("moderate") && !alower.includes("active")) {
      sources.push("Lack of Exercise");
    }
  }

  // Family history
  const familyHistory = Array.isArray(lifestyle.family_history)
    ? lifestyle.family_history
    : lifestyle.family_history
    ? [lifestyle.family_history]
    : [];

  for (const fh of familyHistory) {
    const fhtext = sanitizeMedicalInput(fh).toLowerCase();
    if (fhtext.includes("stroke")) sources.push("Family History of Stroke");
    if (fhtext.includes("diabetes") || fhtext.includes("sugar")) sources.push("Family History of Diabetes");
    if (fhtext.includes("hypertension") || fhtext.includes("high blood") || fhtext.includes("highblood") || fhtext.includes("blood pressure")) {
      sources.push("Family History of Hypertension");
    }
    if (fhtext.includes("cancer") || fhtext.includes("kanser")) sources.push("Family History of Cancer");
    if (fhtext.includes("heart") || fhtext.includes("puso") || fhtext.includes("cardiac")) {
      sources.push("Family History of Heart Disease");
    }
    if (fhtext.includes("kidney") || fhtext.includes("bato")) sources.push("Family History of Kidney Disease");
  }

  return filterValidClinicalTags(sources);
}

/**
 * Map a list of raw inputs to canonical labels (convenience wrapper).
 */
function mapClinicalAliases(rawInputs = []) {
  return filterValidClinicalTags(rawInputs);
}

module.exports = {
  sanitizeMedicalInput,
  isRejectedTerm,
  normalizeClinicalTag,
  filterValidClinicalTags,
  extractClinicalRiskFactors,
  mapClinicalAliases,
  normalizeConditions: filterValidClinicalTags,
};
