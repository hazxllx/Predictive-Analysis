/**
 * Predictive Analysis Subsystem Scoring Engine
 * Thin wrapper around the centralized scoring engine.
 * All scoring logic lives in backend/utils/scoringEngine.js.
 */

const { scorePatient: newScorePatient, DISCLAIMER } = require("../utils/scoringEngine");

/**
 * Delegates to the centralized scoringEngine.
 */
function scorePatient(data = {}) {
  return newScorePatient(data);
}

module.exports = { scorePatient, DISCLAIMER };
