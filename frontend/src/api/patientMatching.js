import api from "./axios";

/**
 * Normalize a patient name for comparison
 * Handles: trimming, lowercasing, normalizing spaces
 * @param {string} name - Patient name
 * @returns {string} - Normalized name
 */
export const normalizeName = (name) => {
  if (!name) return "";
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

/**
 * Attempt to auto-link user to PMS patient record
 * Uses the backend /patients/me endpoint which:
 * 1. Matches by normalized full name (primary)
 * 2. Falls back to ID matching for duplicates
 * 3. Auto-updates user.patient_id if single match found
 * 
 * @returns {Promise<object>} - Link result object:
 *   - linked: boolean - whether a patient is linked
 *   - autoLinked: boolean - whether auto-linking just happened
 *   - linkedPatientId: string - the linked patient ID
 *   - data: object - the linked patient data
 *   - multipleMatches: boolean - multiple name matches found
 *   - options: array - options if multiple matches
 */
export const autoLinkPatient = async () => {
  try {
    const { data } = await api.get("/patients/me");
    return data;
  } catch (error) {
    console.error("Auto-link failed:", error.response?.data || error.message);
    // Return graceful error state - don't crash UI
    return {
      linked: false,
      error: error.response?.data?.message || "Failed to auto-link patient",
    };
  }
};

/**
 * Check if a user is already linked to a patient
 * @param {object} user - User object from auth
 * @returns {boolean}
 */
export const isPatientLinked = (user) => {
  return Boolean(user?.patient_id);
};
