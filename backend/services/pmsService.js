
const axios = require("axios");

const BASE_URL = process.env.PMS_BASE_URL || "https://pms-backend-kohl.vercel.app/api/v1/external";

const pmsClient = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: {
    "x-api-key": process.env.PMS_API_KEY,
  },
});

function assertPmsKey() {
  if (!process.env.PMS_API_KEY) {
    throw new Error("Missing PMS_API_KEY in environment");
  }
}

const calculateAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  return today.getFullYear() - birth.getFullYear();
};

function mapPatient(p = {}, records = []) {
  const fullName = p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim();

  if (!p?.patient_id || !fullName) {
    throw new Error("Invalid PMS patient shape");
  }

  return {
    patient_id: String(p.patient_id),
    name: fullName,
    gender: p.gender || null,
    age: p.age ?? calculateAge(p.date_of_birth) ?? null,
    last_visit_date: deriveLastVisitDate(p, records),
    attending_physician: deriveAttendingPhysician(p, records),
    patient_record: [],
  };
}

const CONDITION_PATTERNS = {
  cardiovascular: /\b(hypertension|heart|cardio|stroke|arrhythmia|coronary|angina|myocardial)\b/i,
  metabolic: /\b(diabetes|metabolic|glucose|insulin|obesity|hyperlipidemia|cholesterol)\b/i,
  respiratory: /\b(asthma|copd|respiratory|bronchitis|pneumonia|lung)\b/i,
  renal: /\b(renal|kidney|nephro|ckd|dialysis)\b/i,
  mental: /\b(anxiety|depression|mental|psychiatric|bipolar|stress)\b/i,
  cancer: /\b(cancer|oncology|tumou?r|malignan)\b/i,
};

const extractRecordText = (record = {}) => {
  return String(
    record?.summary ||
      record?.diagnosis ||
      record?.condition ||
      record?.details?.visitAssessment ||
      record?.details?.diagnosis ||
      record?.details?.summary ||
      record?.noteContent ||
      record?.notes ||
      record?.chiefComplaint ||
      ""
  ).trim();
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const deriveLastVisitDate = (patient = {}, records = []) => {
  const direct =
    patient?.last_visit_date ||
    patient?.lastVisitDate ||
    patient?.last_checkup ||
    patient?.lastCheckup ||
    null;

  const directIso = toIsoOrNull(direct);
  if (directIso) return directIso;

  const recordDates = records
    .map(
      (record) =>
        record?.last_visit_date ||
        record?.visit_date ||
        record?.visitDate ||
        record?.date ||
        record?.createdAt ||
        record?.timestamp ||
        record?.details?.visitDate ||
        null
    )
    .map(toIsoOrNull)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));

  return recordDates[0] || null;
};

const deriveAttendingPhysician = (patient = {}, records = []) => {
  const direct =
    patient?.attending_physician ||
    patient?.attendingPhysician ||
    patient?.physician ||
    patient?.doctor_name ||
    patient?.doctorName ||
    null;

  if (direct) return String(direct).trim() || null;

  const physicianFromRecord = records
    .map(
      (record) =>
        record?.attending_physician ||
        record?.attendingPhysician ||
        record?.physician ||
        record?.doctor_name ||
        record?.doctorName ||
        record?.details?.attendingPhysician ||
        record?.details?.doctor ||
        null
    )
    .find((value) => String(value || "").trim().length > 0);

  return physicianFromRecord ? String(physicianFromRecord).trim() : null;
};

const normalizeConditions = (texts = []) => {
  const combined = texts.join(" \n ").toLowerCase();
  const categories = Object.entries(CONDITION_PATTERNS)
    .filter(([, pattern]) => pattern.test(combined))
    .map(([category]) => category);

  return [...new Set(categories)];
};

const withPatientRecords = (patient, allRecords = []) => {
  const pid = String(patient?.patient_id || "");
  const patientRecords = allRecords.filter((record) => {
    return String(record?.patient_id || "") === String(pid);
  });

  const medicalNotes = patientRecords.map(extractRecordText).filter(Boolean);
  const normalizedConditions = normalizeConditions(medicalNotes);

  return {
    ...patient,
    patient_record: normalizedConditions,
    medical_notes: medicalNotes,
    medical_history_message:
      normalizedConditions.length === 0 ? "No medical history available" : null,
  };
};

async function fetchAllPatients() {
  assertPmsKey();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const [response, records] = await Promise.all([pmsClient.get("/patients"), fetchHealthRecords()]);

      const rawPatients = Array.isArray(response?.data?.data?.patients)
        ? response.data.data.patients
        : Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
        ? response.data
        : [];

      return rawPatients
        .map((rawPatient) => {
          try {
            return withPatientRecords(
              mapPatient(
                rawPatient,
                records.filter(
                  (record) => String(record?.patient_id || "") === String(rawPatient?.patient_id || "")
                )
              ),
              records
            );
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      console.error(`🔥 PMS ERROR (attempt ${attempt}):`, error.response?.data || error.message);

      if (attempt === 2) {
        return [];
      }
    }
  }

  return [];
}

async function fetchPatient(patient_id) {
  assertPmsKey();

  if (!patient_id) {
    throw new Error("Missing patient_id input");
  }

  console.log("CALLING PMS PATIENT:", patient_id);

  const res = await axios.get(`${BASE_URL}/patients/${patient_id}`, {
    headers: {
      "x-api-key": process.env.PMS_API_KEY,
    },
    timeout: 8000,
  });

  console.log("PMS RAW RESPONSE:", JSON.stringify(res.data, null, 2));

  const container = res.data?.data;
  const raw =
    container?.patient ||
    (Array.isArray(container?.patients) ? container.patients[0] : null) ||
    container;

  if (!raw || typeof raw !== "object") {
    throw new Error("PMS response missing data object");
  }

  const patientId = String(raw.patient_id || "").trim();
  const fullName = String(raw.name || `${raw.first_name || ""} ${raw.last_name || ""}`.trim()).trim();

  if (!patientId) {
    throw new Error("Invalid PMS patient_id");
  }

  if (!fullName) {
    throw new Error("Invalid PMS patient name");
  }

  let records = [];
  try {
    records = await fetchHealthRecords(patientId);
  } catch (recordError) {
    console.error("Health records fetch failed:", recordError.message);
  }

  const patientRecords = Array.isArray(records) ? records : [];

  const normalized = {
    patient_id: patientId,
    name: fullName,
    gender: raw.gender ?? null,
    age: raw.age ?? calculateAge(raw.date_of_birth) ?? null,
    last_visit_date: deriveLastVisitDate(raw, patientRecords),
    attending_physician: deriveAttendingPhysician(raw, patientRecords),
    patient_record: [],
  };

  return withPatientRecords(normalized, records);
}

async function fetchHealthRecords(patientId = null) {
  assertPmsKey();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await pmsClient.get("/health-records");
      let records = [];
      if (Array.isArray(response.data)) {
        records = response.data;
      } else if (Array.isArray(response.data?.data)) {
        records = response.data.data;
      } else if (Array.isArray(response.data?.data?.records)) {
        records = response.data.data.records;
      } else if (Array.isArray(response.data?.data?.healthRecords)) {
        records = response.data.data.healthRecords;
      }

      if (!patientId) return records;

      return records.filter((record) => String(record?.patient_id || "") === String(patientId));
    } catch (error) {
      console.error(`🔥 PMS ERROR health-records (attempt ${attempt}):`, error.response?.data || error.message);

      if (attempt === 2) {
        return [];
      }
    }
  }

  return [];
}

module.exports = {
  fetchAllPatients,
  fetchPatient,
  fetchHealthRecords,
};
