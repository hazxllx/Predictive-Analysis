/**
 * Patient Routes
 *
 * Endpoints for fetching patient data from the PMS:
 * - GET /me    — resolve current user's PMS patient link
 * - GET /      — list patients (patients see themselves, admins see all)
 * - GET /:id   — fetch a specific patient by ID
 *
 * Business logic is handled by patientController.
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getPatientMe,
  listPatients,
  getPatientById,
} = require("../controllers/patientController");
const { getPatientByIdValidators } = require("../middleware/validate");

router.get("/me", protect, getPatientMe);
router.get("/", protect, listPatients);
router.get("/:id", protect, getPatientByIdValidators, getPatientById);

module.exports = router;
