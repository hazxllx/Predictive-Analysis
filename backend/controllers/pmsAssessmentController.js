const { scorePatient } = require("../services/scoring");
const { fetchPatient, fetchHealthRecords } = require("../services/pmsService");

async function runPmsAssessment(req, res) {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: "Missing patientId" });
    }

    const patient = await fetchPatient(patientId);
    const records = await fetchHealthRecords(patientId);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found in PMS" });
    }

    const recordsArr = Array.isArray(records)
      ? records
      : Array.isArray(records?.data)
      ? records.data
      : [];

    const patient_record =
      records?.conditions ||
      recordsArr.map((r) => r?.condition || r?.type).filter(Boolean) ||
      [];

    if (!recordsArr.length && !records?.conditions?.length) {
      console.warn("⚠️ No health records found for patient:", patientId);
    }

    const mappedData = {
      age: patient?.age || 0,
      lifestyle: {
        smoking: patient?.lifestyle?.smoking ?? false,
        alcohol: patient?.lifestyle?.alcohol ?? false,
        diet: patient?.lifestyle?.diet ?? "average",
        physical_activity: patient?.lifestyle?.physical_activity ?? "light",
      },
      patient_record,
    };

    const result = scorePatient(mappedData);

    return res.json({
      status: "success",
      source: "PMS",
      patientId,
      data: result,
    });
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      return res.status(504).json({
        message: "PMS request timeout",
      });
    }

    console.error("🔥 PMS INTEGRATION ERROR:", error);

    return res.status(500).json({
      message: "Failed PMS integration",
      error: error.message,
    });
  }
}

module.exports = {
  runPmsAssessment,
};
