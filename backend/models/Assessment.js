/**
 * Assessment Model
 *
 * Stores patient risk assessment results including:
 * - Risk score (0-100) and risk level classification
 * - Assessment inputs (lifestyle, vitals, history)
 * - Generated insights: recommendations, specialists, lab tests
 * - Compound indexes for efficient lookup by patient_id, userId, risk_level, and recency
 */
const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    patient_id: { type: String, default: null, index: true }, // PMS patient ID for external assessments
    risk_score: { type: Number, required: true, index: true },
    risk_level: { type: String, required: true, index: true },
    inputs: { type: Object, required: true },
    insights: {
      recommendations: { type: [String], default: [] },
      suggested_specialist: { type: [String], default: [] },
      optional_lab_tests: { type: [String], default: [] },
      disclaimer: { type: String, required: true },
      breakdown: { type: mongoose.Schema.Types.Mixed, default: [] }, // Score breakdown for transparency
    },
  },
  { timestamps: true }
);

// Compound index for fetching a patient's assessment history in chronological order
assessmentSchema.index({ patient_id: 1, createdAt: -1 });
// Compound index for fetching a user's assessment history
assessmentSchema.index({ userId: 1, createdAt: -1 });
// Compound index for admin dashboard risk-level filtering and sorting
assessmentSchema.index({ risk_level: 1, createdAt: -1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
