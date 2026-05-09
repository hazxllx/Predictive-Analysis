const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    patient_id: { type: String, default: null }, // PMS patient ID for external assessments
    risk_score: { type: Number, required: true },
    risk_level: { type: String, required: true },
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

assessmentSchema.index({ patient_id: 1, createdAt: -1 });
assessmentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
