const Appointment = require("../models/Appointment");
const User = require("../models/User");

const requestAppointment = async (req, res) => {
  try {
    if (!req.user || (req.user.role !== "staff" && req.user.role !== "admin")) {
      return res.status(403).json({ message: "Staff access only" });
    }

    const { patientId, scheduledDate } = req.body;

    if (!patientId || !scheduledDate) {
      return res.status(400).json({ message: "patientId and scheduledDate are required" });
    }

    const patientUser = await User.findOne({ patient_id: patientId, role: "patient" }).select("_id name");
    if (!patientUser) {
      return res.status(404).json({ message: "Patient user not found" });
    }

    const parsedDate = new Date(scheduledDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid scheduledDate" });
    }

    // connect here (future calendar integration)
    const appointment = await Appointment.create({
      doctorId: req.user._id,
      patientId: patientUser._id,
      status: "pending",
      scheduledDate: parsedDate,
    });

    // remove this in production
    console.log("Appointment requested:", {
      doctorId: String(req.user._id),
      patientId: String(patientUser._id),
      appointmentId: String(appointment._id),
    });

    const populated = await Appointment.findById(appointment._id)
      .populate("doctorId", "name email role")
      .populate("patientId", "name email patient_id role");

    return res.status(201).json(populated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to request appointment" });
  }
};

const respondToAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!["confirm", "decline"].includes(action)) {
      return res.status(400).json({ message: "action must be confirm or decline" });
    }

    const appointment = await Appointment.findById(id).populate("patientId", "_id");
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (!req.user || req.user.role !== "patient") {
      return res.status(403).json({ message: "Patient access only" });
    }

    if (String(appointment.patientId?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: "You can only respond to your own appointments" });
    }

    appointment.status = action === "confirm" ? "confirmed" : "declined";
    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate("doctorId", "name email role")
      .populate("patientId", "name email patient_id role");

    return res.json(populated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to respond to appointment" });
  }
};

const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patientUser = await User.findOne({ patient_id: patientId, role: "patient" }).select("_id");
    if (!patientUser) {
      return res.json([]);
    }

    const appointments = await Appointment.find({ patientId: patientUser._id })
      .sort({ scheduledDate: 1, createdAt: -1 })
      .populate("doctorId", "name email role")
      .populate("patientId", "name email patient_id role");

    return res.json(appointments);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch patient appointments" });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const appointments = await Appointment.find({ doctorId })
      .sort({ scheduledDate: 1, createdAt: -1 })
      .populate("doctorId", "name email role")
      .populate("patientId", "name email patient_id role");

    return res.json(appointments);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch doctor appointments" });
  }
};

module.exports = {
  requestAppointment,
  respondToAppointment,
  getPatientAppointments,
  getDoctorAppointments,
};
