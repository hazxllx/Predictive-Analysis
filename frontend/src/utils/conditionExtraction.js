import { cleanText } from "./normalizePatients";
import { normalizeClinicalTag } from "./medicalTaxonomy";

/**
 * Condition extraction utility for converting raw PMS visit/condition text
 * into clean, meaningful medical condition tags using the centralized taxonomy.
 *
 * This now uses the medical taxonomy to:
 * - Reject junk/free-text terms
 * - Normalize to canonical medical labels
 * - Ensure only medically valid tags appear in UI
 */

/**
 * Generic phrases to filter out (non-condition entries)
 * These are administrative/visit types, not medical conditions.
 */
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
  "visit",
  "checkup",
  "routine",
  "check-up",
];

/**
 * Normalizes a single condition/visit text into a clean condition tag
 * Uses the centralized medical taxonomy for validation and normalization.
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
      return null;
    }
  }

  // Use centralized medical taxonomy to normalize
  const canonical = normalizeClinicalTag(input);
  if (canonical) {
    return { label: canonical, priority: true };
  }

  // If not found in taxonomy, reject it (no arbitrary text allowed)
  return null;
}

/**
 * Extracts clean condition tags from patient data
 * Uses the medical taxonomy to ensure only valid medical tags are returned.
 * Deduplicates and limits results to max 3 tags.
 * @param {object} patient - Normalized patient object
 * @param {number} maxTags - Maximum number of tags to return (default: 3)
 * @returns {array} - Array of condition tag strings (canonical labels only)
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

    // Skip duplicates
    if (seen.has(label)) continue;
    seen.add(label);

    tags.push(label);

    // Stop when we reach max tags
    if (tags.length >= maxTags) break;
  }

  return tags;
}

/**
 * Helper to check if a text is a valid condition (not a generic phrase or junk)
 * Uses the centralized medical taxonomy for validation.
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function isValidCondition(text) {
  const normalized = normalizeConditionLabel(text);
  return normalized !== null;
}
