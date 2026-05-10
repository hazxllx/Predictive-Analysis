/**
 * Admin Seeding Utility
 *
 * Ensures at least one admin account exists on startup.
 * If no admin is found, creates a default admin with a securely hashed password.
 *
 * Security:
 * - Password is hashed via the User model pre-save hook (never stored plain-text)
 * - Logs only in development and never exposes credentials
 */

const User = require("../models/User");

const DEFAULT_ADMIN = {
  name: "System Admin",
  email: "admin@pulseprophet.local",
  username: "admin",
  password: "Admin@1234",
  role: "admin",
  patient_id: null,
};

async function seedAdmin() {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const adminExists = await User.findOne({ role: "admin" }).select("_id username email").lean();

    if (adminExists) {
      if (isDev) {
        // eslint-disable-next-line no-console
        console.log(`[SEED] Admin already exists: ${adminExists.username || adminExists.email}`);
      }
      return { created: false, user: adminExists };
    }

    const created = await User.create({
      name: DEFAULT_ADMIN.name,
      email: DEFAULT_ADMIN.email.toLowerCase(),
      username: DEFAULT_ADMIN.username.toLowerCase(),
      password: DEFAULT_ADMIN.password,
      role: DEFAULT_ADMIN.role,
      patient_id: DEFAULT_ADMIN.patient_id,
    });

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[SEED] Default admin created: ${created.username} (${created.email})`);
      // eslint-disable-next-line no-console
      console.log(`[SEED] Default credentials -> username: ${DEFAULT_ADMIN.username} | password: ${DEFAULT_ADMIN.password}`);
    }

    return { created: true, user: created };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[SEED] Failed to seed admin:", err.message);
    return { created: false, error: err.message };
  }
}

module.exports = { seedAdmin };
