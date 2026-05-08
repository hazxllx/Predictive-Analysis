const toTitleCase = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const cleanText = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";

  const normalized = text.toLowerCase();
  if (normalized === "n/a" || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return text;
};

const pushUnique = (arr, value) => {
  const text = cleanText(value);
  if (!text) return;

  if (!arr.some((item) => item.toLowerCase() === text.toLowerCase())) {
    arr.push(text);
  }
};

const normalizeCategory = (value = "") => {
  const normalized = cleanText(value).replace(/[_-]+/g, " ");
  return normalized ? toTitleCase(normalized) : "";
};

const parseSummaryEntries = (value) =>
  cleanText(value)
    .split(/[.\n]/)
    .map((part) => cleanText(part))
    .filter(Boolean);

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return undefined;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return undefined;
};

const parseArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
};

const normalizeLifestyle = (lifestyle = {}) => {
  const smoking = parseBoolean(lifestyle?.smoking);
  const alcohol = parseBoolean(lifestyle?.alcohol);
  const diet = cleanText(lifestyle?.diet);
  const physicalActivity = cleanText(lifestyle?.physical_activity || lifestyle?.physicalActivity);

  const normalized = {};
  if (smoking !== undefined) normalized.smoking = smoking;
  if (alcohol !== undefined) normalized.alcohol = alcohol;
  if (diet) normalized.diet = diet;
  if (physicalActivity) normalized.physical_activity = physicalActivity;

  return normalized;
};

const normalizeVitals = (patient = {}) => {
  const vitals = {
    ...(patient?.vitals && typeof patient.vitals === "object" ? patient.vitals : {}),
  };
  const details = patient?.details || {};

  const systolic = cleanText(details.visitBpSystolic);
  const diastolic = cleanText(details.visitBpDiastolic);
  if (systolic && diastolic && !cleanText(vitals.blood_pressure)) {
    vitals.blood_pressure = `${systolic}/${diastolic}`;
  }

  [
    ["heart_rate", details.visitHeartRate],
    ["respiratory_rate", details.visitRespiratoryRate],
    ["temperature", details.visitTemperature],
    ["weight", details.visitWeight],
    ["height", details.visitHeight],
  ].forEach(([key, value]) => {
    const normalized = cleanText(value);
    if (normalized && !cleanText(vitals[key])) {
      vitals[key] = normalized;
    }
  });

  return Object.fromEntries(
    Object.entries(vitals).filter(([, value]) => cleanText(value))
  );
};

export const normalizePatient = (patient) => {
  if (!patient || typeof patient !== "object") return null;

  const normalizedPatient = { ...patient };
  normalizedPatient.patient_id = cleanText(patient?.patient_id);
  normalizedPatient.name =
    cleanText(patient?.name) ||
    cleanText(`${cleanText(patient?.first_name)} ${cleanText(patient?.last_name)}`.trim());
  normalizedPatient.gender = cleanText(patient?.gender) || null;
  normalizedPatient.address = cleanText(patient?.address) || null;
  normalizedPatient.contact = cleanText(patient?.contact) || null;
  normalizedPatient.last_visit_date = cleanText(patient?.last_visit_date) || null;
  normalizedPatient.attending_physician = cleanText(patient?.attending_physician) || null;

  const conditionCategories = parseArray(patient?.condition_categories);
  const patientRecord = parseArray(patient?.patient_record);
  const medicalSummaries = parseArray(patient?.medical_summaries);
  const visitReasons = parseArray(patient?.visit_reasons);

  const rawCategory = normalizeCategory(patient?.condition_category);
  if (rawCategory) pushUnique(conditionCategories, rawCategory);

  [
    patient?.summary,
    patient?.details?.summary,
    patient?.details?.visitAssessment,
    patient?.diagnosis,
    patient?.condition,
  ].forEach((value) => {
    parseSummaryEntries(value).forEach((entry) => {
      pushUnique(patientRecord, entry);
      pushUnique(medicalSummaries, entry);
    });
  });

  parseSummaryEntries(patient?.details?.visitReason).forEach((entry) => {
    pushUnique(visitReasons, entry);
    pushUnique(patientRecord, `Visit reason: ${entry}`);
  });

  normalizedPatient.condition_categories = conditionCategories;
  normalizedPatient.patient_record = patientRecord;
  normalizedPatient.medical_summaries = medicalSummaries;
  normalizedPatient.visit_reasons = visitReasons;
  normalizedPatient.lifestyle = normalizeLifestyle(patient?.lifestyle || {});
  normalizedPatient.vitals = normalizeVitals(patient);

  if (normalizedPatient.age === undefined || normalizedPatient.age === null || normalizedPatient.age === "") {
    normalizedPatient.age = null;
  } else {
    const age = Number(normalizedPatient.age);
    normalizedPatient.age = Number.isFinite(age) ? age : null;
  }

  return normalizedPatient;
};

export const normalizePatientResponse = (res) => {
  const payload = res?.data?.data ?? res?.data ?? res;
  if (!payload || Array.isArray(payload)) return null;
  return normalizePatient(payload);
};

export const normalizePatients = (res) => {
  if (!res) return [];

  const payload = res?.data?.data ?? res?.data ?? res;
  let patients = [];

  if (Array.isArray(payload)) {
    patients = payload;
  } else if (Array.isArray(payload?.patients)) {
    patients = payload.patients;
  } else if (Array.isArray(res?.data?.data?.patients)) {
    patients = res.data.data.patients;
  }

  return patients.map((patient) => normalizePatient(patient)).filter(Boolean);
};
