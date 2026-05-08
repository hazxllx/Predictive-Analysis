import { cleanText } from "./normalizePatients";

/**
 * Condition extraction utility for converting raw PMS visit/condition text
 * into clean, meaningful medical condition tags.
 * 
 * Removes generic phrases and extracts core diagnosis keywords.
 */

// Generic phrases to filter out (non-condition entries)
const GENERIC_PHRASES = [
  "refill medication",
  "labs",
  "annual physical",
  "follow-up",
  "prescribed medication",
  "monitoring",
  "therapy referral",
  "dietary advice",
  "vaccination on file",
  "recommend continuing therapy",
  "medication and rest",
  "medication and labs",
  "physical therapy referral",
  "preventive care",
  "consultation visit",
  "procedure visit",
  "series incomplete",
  "vaccination administered",
  "advice and monitoring",
  "refill",
  "labs",
  "visit",
];

// Condition patterns with their normalized labels
const CONDITION_MAPPINGS = [
  { patterns: ["tension headache", "headache"], label: "Tension Headache" },
  { patterns: ["chronic back pain"], label: "Chronic Back Pain" },
  { patterns: ["back pain"], label: "Back Pain" },
  { patterns: ["shortness of breath"], label: "Shortness of Breath" },
  { patterns: ["asthma"], label: "Asthma" },
  { patterns: ["seasonal allergy", "allergy"], label: "Allergy" },
  { patterns: ["respiratory", "upper respiratory"], label: "Respiratory" },
  { patterns: ["fever"], label: "Fever" },
  { patterns: ["dermatitis"], label: "Dermatitis" },
  { patterns: ["cough"], label: "Cough" },
  { patterns: ["joint stiffness", "stiffness"], label: "Joint Stiffness" },
  { patterns: ["abdominal pain"], label: "Abdominal Pain" },
  { patterns: ["hypertension"], label: "Hypertension" },
  { patterns: ["diabetes"], label: "Diabetes" },
  { patterns: ["arthritis"], label: "Arthritis" },
  { patterns: ["obesity"], label: "Obesity" },
];

/**
 * Normalizes a single condition/visit text into a clean condition tag
 * @param {string} text - Raw condition/visit text from PMS
 * @returns {object|null} - { label, priority } or null if text should be filtered
 */
export function normalizeConditionLabel(text) {
  const input = cleanText(text);
  if (!input) return null;

  const normalized = input.toLowerCase();

  // Filter out generic, non-condition phrases
  for (const phrase of GENERIC_PHRASES) {
    if (normalized.includes(phrase)) {
      // Special handling: if the text contains a condition keyword, extract it
      for (const mapping of CONDITION_MAPPINGS) {
        for (const pattern of mapping.patterns) {
          if (normalized.includes(pattern)) {
            return { label: mapping.label, priority: true };
          }
        }
      }
      // No specific condition found, filter it out
      return null;
    }
  }

  // Check for condition patterns
  for (const mapping of CONDITION_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      if (normalized.includes(pattern)) {
        return { label: mapping.label, priority: true };
      }
    }
  }

  // Return the text as-is if it's not a generic phrase and not a known pattern
  // Remove trailing period if present
  const label = input.replace(/\.$/, "").trim();
  return label ? { label, priority: false } : null;
}

/**
 * Extracts clean condition tags from patient data
 * Deduplicates and limits results to max 3 tags
 * @param {object} patient - Normalized patient object
 * @param {number} maxTags - Maximum number of tags to return (default: 3)
 * @returns {array} - Array of condition tag strings
 */
export function extractConditionTags(patient, maxTags = 3) {
  if (!patient || typeof patient !== "object") return [];

  const rawItems = [
    ...(patient?.condition_categories || []),
    ...(patient?.medical_summaries || []),
    ...(patient?.visit_reasons || []),
    ...(patient?.patient_record || []),
  ];

  const tags = [];
  const seen = new Set();

  for (const item of rawItems) {
    const normalized = normalizeConditionLabel(item);
    if (!normalized) continue;

    const label = normalized.label;
    const lowerLabel = label.toLowerCase();

    // Skip duplicates
    if (seen.has(lowerLabel)) continue;
    seen.add(lowerLabel);

    tags.push(label);

    // Stop when we reach max tags
    if (tags.length >= maxTags) break;
  }

  return tags;
}

/**
 * Helper to check if a text is a valid condition (not a generic phrase)
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function isValidCondition(text) {
  const normalized = normalizeConditionLabel(text);
  return normalized !== null;
}
