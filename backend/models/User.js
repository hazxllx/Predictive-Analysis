const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["patient", "admin"], default: "patient" },
    patient_id: { type: String, default: null },
    pms_linked_at: { type: Date, default: null },
    pms_matched_by: { type: String, enum: ["name", "patient_id", null], default: null },
  },
  { timestamps: true }
);

userSchema.index(
  { patient_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      patient_id: { $type: "string", $gt: "" },
    },
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);
