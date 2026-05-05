const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    risk_score: { type: Number, required: true },
    risk_level: { type: String, required: true },
    inputs: { type: Object, required: true },
    insights: {
      recommendations: { type: [String], default: [] },
      suggested_specialist: { type: [String], default: [] },
      optional_lab_tests: { type: [String], default: [] },
      disclaimer: { type: String, required: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assessment", assessmentSchema);
