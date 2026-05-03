const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    patient_id: { type: String, required: true },
    risk_score: { type: Number, required: true },
    risk_level: { type: String, required: true },
    confidence: { type: String, required: true },
    recommendations: [String],
    specialists: [String],
    lab_tests: [String],
    score_breakdown: { type: Object, required: true },
    assessed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);