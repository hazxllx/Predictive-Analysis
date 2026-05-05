const express = require("express");
const { protect } = require("../middleware/auth");
const {
  requestAppointment,
  respondToAppointment,
  getPatientAppointments,
  getDoctorAppointments,
} = require("../controllers/appointmentController");

const router = express.Router();

router.post("/request", protect, requestAppointment);
router.patch("/:id/respond", protect, respondToAppointment);
router.get("/patient/:patientId", protect, getPatientAppointments);
router.get("/doctor/:doctorId", protect, getDoctorAppointments);

module.exports = router;
