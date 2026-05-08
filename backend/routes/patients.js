const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { fetchAllPatients, fetchPatient } = require("../services/pmsService");
const { resolvePatientLink } = require("../services/patientLinkingService");

const serializeUser = (user) => ({
  id: user?._id || user?.id || null,
  name: user?.name || null,
  email: user?.email || null,
  role: user?.role || null,
  patient_id: user?.patient_id || null,
});

router.get("/me", protect, async (req, res) => {
  try {
    const linkResult = await resolvePatientLink(req.user, { persist: true });
    const user = linkResult?.user || req.user;

    console.log("[/patients/me] user:", {
      id: user?._id,
      role: user?.role,
      name: user?.name,
      patient_id: user?.patient_id || null,
    });

    if (linkResult?.linked && linkResult?.data) {
      console.log("[/patients/me] linked patient:", {
        patient_id: linkResult.linkedPatientId,
        autoLinked: linkResult.autoLinked,
        matchedBy: linkResult.matchedBy,
      });

      return res.json({
        linked: true,
        autoLinked: Boolean(linkResult.autoLinked),
        linkedPatientId: linkResult.linkedPatientId,
        matchedBy: linkResult.matchedBy || null,
        user: serializeUser(user),
        data: linkResult.data,
      });
    }

    if (linkResult?.multipleMatches) {
      return res.json({
        linked: false,
        multipleMatches: true,
        user: serializeUser(user),
        options: Array.isArray(linkResult.options) ? linkResult.options : [],
      });
    }

    return res.json({
      linked: false,
      noMatch: Boolean(linkResult?.noMatch),
      staleLink: Boolean(linkResult?.staleLink),
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("AUTO-LINK ERROR:", error.message);
    return res.status(500).json({ message: "Failed to resolve patient link" });
  }
});

// GET /patients - admin/staff sees all, patient sees own
router.get("/", protect, async (req, res) => {
  try {
    const patients = await fetchAllPatients();

    if (req.user.role === "patient") {
      const pid = req.user.patient_id;
      if (!pid) return res.status(403).json({ message: "No patient ID linked" });

      const patient = patients.find((p) => String(p.patient_id) === String(pid));

      return res.json({
        source: "pms",
        count: patient ? 1 : 0,
        data: patient ? [patient] : [],
      });
    }

    return res.json({
      source: "pms",
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// GET /patients/:id
router.get("/:id", protect, async (req, res) => {
  try {
    if (req.user.role === "patient" && String(req.user.patient_id) !== String(req.params.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const patient = await fetchPatient(req.params.id);

    if (!patient?.name || !patient?.patient_id) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.json({ data: patient });
  } catch (error) {
    console.error("PATIENT FETCH ERROR:", error.message);

    const status = error.message === "Patient not found in PMS" ? 404 : 500;
    return res.status(status).json({
      message: status === 404 ? "Patient not found" : "Failed to fetch patient",
    });
  }
});

module.exports = router;
