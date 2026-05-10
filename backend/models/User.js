/**
 * User Model
 *
 * Defines the User schema for MongoDB with:
 * - Basic profile fields (name, email, username, password)
 * - Role-based access (patient | admin)
 * - PMS patient linking metadata
 * - Automatic password hashing on save
 * - Username uniqueness with sparse index (optional field)
 *
 * Performance: compound indexes on role+createdAt and email for fast auth lookups.
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },

    // Username-based auth (letters, numbers, underscores only)
    // Optional to preserve legacy accounts created before usernames were introduced.
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined || v === "") return true;
          return /^[a-z0-9_]+$/.test(String(v));
        },
        message: (props) => `Invalid username: use letters, numbers, and underscores only.`,
      },
    },

    password: { type: String, required: true },
    role: { type: String, enum: ["patient", "admin"], default: "patient", index: true },
    patient_id: { type: String, default: null },
    pms_linked_at: { type: Date, default: null },
    pms_matched_by: { type: String, enum: ["name", "patient_id", null], default: null },
    audit_uuid: {
      type: String,
      unique: true,
      sparse: true,
      default: uuidv4,
    },
  },
  { timestamps: true }
);

// Compound index for admin user listings ordered by recency
userSchema.index({ role: 1, createdAt: -1 });

// Enforce unique patient_id only when it is a non-empty string
userSchema.index(
  { patient_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      patient_id: { $type: "string", $gt: "" },
    },
  }
);

// Hash password before saving (only when modified)
// Generate audit_uuid if missing so legacy users get one on next save.
userSchema.pre("save", async function (next) {
  if (!this.audit_uuid) {
    this.audit_uuid = uuidv4();
  }
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Instance method to compare plaintext password with hashed password
userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);
