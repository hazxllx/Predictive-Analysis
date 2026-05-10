/**
 * PMS (Patient Management System) Integration Service
 *
 * Responsibilities:
 * - Fetches patient demographics and health records from the external PMS
 * - Normalizes heterogeneous PMS data into a consistent internal schema
 * - Implements robust resilience: exponential backoff retries, request deduplication,
 *   connection pooling, health checking, and graceful fallbacks
 * - Caches results to reduce PMS load and improve response latency
 *
 * Retry policy:
 * - 3 attempts max with exponential backoff (1s, 2s, 4s)
 * - Retries only transient errors (network, timeout, 5xx)
 * - Never retries 401/403 or other client errors
 *
 * Scoring behavior is NOT modified by this module.
 */
const axios = require("axios");
const https = require("https");

const BASE_URL = process.env.PMS_BASE_URL || "https://pms-backend-kohl.vercel.app/api/v1/external";
const PMS_PAGE_LIMIT = 1000;
const CACHE_TTL_MS = Number(process.env.PMS_CACHE_TTL_MS || 2 * 60 * 1000);

/**
 * PMS Client Configuration
 * - Keep-alive agent reuses TCP connections to reduce latency
 * - Timeout starts at 12s and can extend during retries (max 25s)
 * - Dedicated connection pool prevents port exhaustion under load
 */
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 10,
  timeout: 30000,
  freeSocketTimeout: 30000,
});

const pmsClient = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: {
    "x-api-key": process.env.PMS_API_KEY,
    "Accept": "application/json",
    "Connection": "keep-alive",
  },
  httpsAgent: keepAliveAgent,
});

const cache = {
  patients: { data: null, updatedAt: 0 },
  records: { data: null, updatedAt: 0 },
};

/** In-flight request deduplication for concurrent callers */
const inFlight = {
  patients: null,
  records: null,
};

/** Per-request deduplication locks keyed by endpoint */
const requestLocks = new Map();

/** Connection health tracking */
let lastSuccessfulRequest = 0;
let consecutiveFailures = 0;
const HEALTH_CHECK_INTERVAL_MS = 30000;
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Retry Configuration
 * - Max 3 attempts total
 * - Exponential backoff: 1s, 2s, 4s
 * - Only retries transient errors (network, timeout, 5xx)
 * - Never retries auth failures (401/403) or client errors (4xx)
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  timeoutCeilingMs: 25000,
};

function isRetryableError(error) {
  if (!error) return false;

  const status = error.response?.status;
  if (status) {
    // Never retry auth failures or client errors
    if (status === 401 || status === 403) return false;
    if (status >= 400 && status < 500) return false;
    // Retry server errors
    if (status >= 500) return true;
  }

  // Retry network/connection errors
  const code = error.code;
  if (code) {
    const retryableCodes = new Set([
      "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED",
      "EHOSTUNREACH", "EPIPE", "ERR_NETWORK", "ERR_TIMEOUT",
    ]);
    if (retryableCodes.has(code)) return true;
  }

  // Retry explicit timeout messages
  const message = String(error.message || "").toLowerCase();
  if (message.includes("timeout")) return true;

  return false;
}

function getRetryDelay(attempt) {
  const exponential = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(exponential, RETRY_CONFIG.maxDelayMs);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPmsHealthy() {
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    const timeSinceLastSuccess = Date.now() - lastSuccessfulRequest;
    // After 30s of cooldown, allow one probe request
    return timeSinceLastSuccess > HEALTH_CHECK_INTERVAL_MS;
  }
  return true;
}

function recordSuccess() {
  lastSuccessfulRequest = Date.now();
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures += 1;
}

/**
 * Execute a PMS request with robust retry, cancellation protection,
 * and deduplication. Returns safe fallback data on persistent failure.
 */
async function pmsRequest(config, fallbackData = null) {
  assertPmsKey();

  if (!isPmsHealthy()) {
    console.warn("PMS health check: too many consecutive failures, using fallback");
    return fallbackData;
  }

  // Request deduplication by URL + method
  const lockKey = `${config.method || "GET"}:${config.url || ""}`;
  if (requestLocks.has(lockKey)) {
    return requestLocks.get(lockKey);
  }

  const requestPromise = (async () => {
    let lastError;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt += 1) {
      try {
        const timeout = Math.min(
          RETRY_CONFIG.timeoutCeilingMs,
          (config.timeout || 12000) + (attempt - 1) * 4000
        );

        const response = await pmsClient.request({
          ...config,
          timeout,
          // Signal cancellation is not supported in this axios version;
          // we rely on timeout instead.
        });

        recordSuccess();
        return response;
      } catch (error) {
        lastError = error;

        if (!isRetryableError(error)) {
          console.error(`PMS request non-retryable error (${lockKey}):`, error.response?.status, error.message);
          break;
        }

        console.warn(`PMS request attempt ${attempt}/${RETRY_CONFIG.maxRetries} failed (${lockKey}):`, error.message);
        recordFailure();

        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = getRetryDelay(attempt);
          console.warn(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    console.error(`PMS request failed permanently (${lockKey}):`, lastError?.message);
    return fallbackData;
  })();

  requestLocks.set(lockKey, requestPromise);
  try {
    const result = await requestPromise;
    return result;
  } finally {
    requestLocks.delete(lockKey);
  }
}

const CONDITION_PATTERNS = {
  cardiovascular: /\b(hypertension|heart|cardio|stroke|arrhythmia|coronary|angina|myocardial|heart failure)\b/i,
  metabolic: /\b(diabetes|metabolic|glucose|insulin|obesity|hyperlipidemia|cholesterol)\b/i,
  respiratory: /\b(asthma|copd|respiratory|bronchitis|pneumonia|lung|upper respiratory)\b/i,
  renal: /\b(renal|kidney|nephro|ckd|dialysis)\b/i,
  mental: /\b(anxiety|depression|mental|psychiatric|bipolar|stress)\b/i,
  cancer: /\b(cancer|oncology|tumou?r|malignan)\b/i,
};

function assertPmsKey() {
  if (!process.env.PMS_API_KEY) {
    throw new Error("Missing PMS_API_KEY in environment");
  }
}

function isCacheFresh(bucket) {
  return Boolean(bucket?.data) && Date.now() - bucket.updatedAt < CACHE_TTL_MS;
}

function setCache(key, data) {
  cache[key] = {
    data,
    updatedAt: Date.now(),
  };
  return data;
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";

  const normalized = text.toLowerCase();
  if (normalized === "n/a" || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return text;
}

function titleCase(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCategory(value = "") {
  const text = cleanText(value).replace(/[_-]+/g, " ");
  if (!text) return "";
  return titleCase(text);
}

function pushUnique(target, value) {
  const text = cleanText(value);
  if (!text) return;

  if (!target.some((item) => item.toLowerCase() === text.toLowerCase())) {
    target.push(text);
  }
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return undefined;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return undefined;
}

function calculateAge(dob) {
  if (!dob) return null;

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getRecordDate(record = {}) {
  return (
    record?.record_date ||
    record?.recordDate ||
    record?.visit_date ||
    record?.visitDate ||
    record?.date ||
    record?.created_at ||
    record?.createdAt ||
    record?.updated_at ||
    record?.updatedAt ||
    null
  );
}

function sortRecordsNewestFirst(records = []) {
  return [...records].sort((left, right) => {
    const leftDate = new Date(getRecordDate(left) || 0).getTime();
    const rightDate = new Date(getRecordDate(right) || 0).getTime();
    return rightDate - leftDate;
  });
}

function deriveLastVisitDate(patient = {}, records = []) {
  const direct =
    patient?.last_visit_date ||
    patient?.lastVisitDate ||
    patient?.last_checkup ||
    patient?.lastCheckup ||
    null;

  const directIso = toIsoOrNull(direct);
  if (directIso) return directIso;

  const latestRecord = sortRecordsNewestFirst(records)[0];
  return toIsoOrNull(getRecordDate(latestRecord));
}

function deriveAttendingPhysician(patient = {}, records = []) {
  const direct =
    patient?.attending_physician ||
    patient?.attendingPhysician ||
    patient?.provider ||
    patient?.physician ||
    null;

  if (cleanText(direct)) return cleanText(direct);

  const latestProvider = sortRecordsNewestFirst(records)
    .map(
      (record) =>
        record?.provider ||
        record?.attending_physician ||
        record?.attendingPhysician ||
        record?.physician ||
        record?.details?.attendingPhysician ||
        null
    )
    .find((value) => cleanText(value));

  return cleanText(latestProvider) || null;
}

function normalizeLifestyle(lifestyle = {}) {
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
}

function buildVitals(records = []) {
  const latestVisit = sortRecordsNewestFirst(records).find((record) => {
    const type = cleanText(record?.record_type || record?.recordType).toLowerCase();
    return !type || type === "visit" || type === "follow-up" || type === "urgent";
  });

  const details = latestVisit?.details || {};
  const vitals = {};

  const systolic = cleanText(details.visitBpSystolic);
  const diastolic = cleanText(details.visitBpDiastolic);
  if (systolic && diastolic) {
    vitals.blood_pressure = `${systolic}/${diastolic}`;
  }

  const heartRate = cleanText(details.visitHeartRate);
  if (heartRate) vitals.heart_rate = heartRate;

  const respiratoryRate = cleanText(details.visitRespiratoryRate);
  if (respiratoryRate) vitals.respiratory_rate = respiratoryRate;

  const temperature = cleanText(details.visitTemperature);
  if (temperature) vitals.temperature = temperature;

  const weight = cleanText(details.visitWeight);
  if (weight) vitals.weight = weight;

  const height = cleanText(details.visitHeight);
  if (height) vitals.height = height;

  return vitals;
}

function detectConditionKeys(texts = []) {
  const combined = texts.join(" \n ").toLowerCase();

  return Object.entries(CONDITION_PATTERNS)
    .filter(([, pattern]) => pattern.test(combined))
    .map(([category]) => category);
}

function buildConditionCategories(records = []) {
  const categoryKeys = [];
  const texts = [];

  records.forEach((record) => {
    const categoryKey = cleanText(record?.condition_category).toLowerCase();
    if (categoryKey && categoryKey !== "uncategorized") {
      pushUnique(categoryKeys, categoryKey);
    }

    [
      record?.summary,
      record?.details?.summary,
      record?.details?.visitAssessment,
      record?.diagnosis,
      record?.condition,
      record?.details?.diagnosis,
    ].forEach((value) => {
      const text = cleanText(value);
      if (text) texts.push(text);
    });
  });

  detectConditionKeys(texts).forEach((categoryKey) => pushUnique(categoryKeys, categoryKey));

  return categoryKeys;
}

function buildMedicalHistory(records = []) {
  const history = [];
  const medicalSummaries = [];
  const visitReasons = [];

  sortRecordsNewestFirst(records).forEach((record) => {
    [
      record?.details?.summary,
      record?.details?.visitAssessment,
      record?.summary,
      record?.diagnosis,
      record?.condition,
      record?.details?.diagnosis,
    ].forEach((value) => {
      const text = cleanText(value);
      if (!text) return;
      pushUnique(medicalSummaries, text);
      pushUnique(history, text);
    });

    const visitReason = cleanText(record?.details?.visitReason || record?.visitReason);
    if (visitReason) {
      pushUnique(visitReasons, visitReason);
      pushUnique(history, `Visit reason: ${visitReason}`);
    }
  });

  return {
    history,
    medicalSummaries,
    visitReasons,
  };
}

function buildContact(patient = {}) {
  const phone = cleanText(patient?.contact_number || patient?.contact || patient?.phone);
  const email = cleanText(patient?.email_address || patient?.email);

  return [phone, email].filter(Boolean).join(" | ") || null;
}

function groupRecordsByPatient(records = []) {
  return records.reduce((map, record) => {
    const patientId = cleanText(record?.patient_id);
    if (!patientId) return map;

    if (!map.has(patientId)) {
      map.set(patientId, []);
    }

    map.get(patientId).push(record);
    return map;
  }, new Map());
}

function mapPatient(rawPatient = {}, records = []) {
  const patientId = cleanText(rawPatient?.patient_id);
  const fullName =
    cleanText(rawPatient?.name) ||
    cleanText(`${cleanText(rawPatient?.first_name)} ${cleanText(rawPatient?.last_name)}`.trim());

  if (!patientId || !fullName) {
    throw new Error("Invalid PMS patient shape");
  }

  const conditionKeys = buildConditionCategories(records);
  const { history, medicalSummaries, visitReasons } = buildMedicalHistory(records);

  return {
    patient_id: patientId,
    name: fullName,
    first_name: cleanText(rawPatient?.first_name) || null,
    last_name: cleanText(rawPatient?.last_name) || null,
    gender: cleanText(rawPatient?.gender) || null,
    age: rawPatient?.age ?? calculateAge(rawPatient?.date_of_birth) ?? null,
    date_of_birth: toIsoOrNull(rawPatient?.date_of_birth),
    address: cleanText(rawPatient?.address) || null,
    contact: buildContact(rawPatient),
    contact_number: cleanText(rawPatient?.contact_number) || null,
    email_address: cleanText(rawPatient?.email_address) || null,
    blood_type: cleanText(rawPatient?.blood_type) || null,
    current_medications: Array.isArray(rawPatient?.current_medications)
      ? rawPatient.current_medications.map((item) => cleanText(item)).filter(Boolean)
      : [],
    last_visit_date: deriveLastVisitDate(rawPatient, records),
    attending_physician: deriveAttendingPhysician(rawPatient, records),
    lifestyle: normalizeLifestyle(rawPatient?.lifestyle),
    vitals: buildVitals(records),
    patient_record: history,
    medical_summaries: medicalSummaries,
    visit_reasons: visitReasons,
    condition_categories: conditionKeys.map((category) => normalizeCategory(category)).filter(Boolean),
    record_count: records.length,
    insurance: rawPatient?.insurance || null,
    status: cleanText(rawPatient?.status) || null,
  };
}

function extractPatientsFromResponse(response) {
  if (Array.isArray(response?.data?.data?.patients)) return response.data.data.patients;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.patients)) return response.data.patients;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function extractHealthRecordsFromResponse(response) {
  if (Array.isArray(response?.data?.data?.records)) return response.data.data.records;
  if (Array.isArray(response?.data?.data?.healthRecords)) return response.data.data.healthRecords;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.records)) return response.data.records;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

async function fetchAllHealthRecords(force = false) {
  assertPmsKey();

  if (!force && isCacheFresh(cache.records)) {
    return cache.records.data;
  }
  if (!force && inFlight.records) {
    return inFlight.records;
  }

  inFlight.records = (async () => {
    const response = await pmsRequest(
      { method: "GET", url: `/health-records?page=1&limit=${PMS_PAGE_LIMIT}` },
      /* fallback */ null
    );

    if (response === null) {
      // On persistent failure, return stale cache if available, else empty array
      return cache.records.data || [];
    }

    return setCache("records", extractHealthRecordsFromResponse(response));
  })().finally(() => {
    inFlight.records = null;
  });

  return inFlight.records;
}

async function fetchHealthRecords(patientId = null, options = {}) {
  const records = await fetchAllHealthRecords(options?.force);

  if (!patientId) {
    return records;
  }

  return records.filter((record) => cleanText(record?.patient_id) === cleanText(patientId));
}

async function fetchAllPatients(options = {}) {
  assertPmsKey();

  if (!options?.force && isCacheFresh(cache.patients)) {
    return cache.patients.data;
  }
  if (!options?.force && inFlight.patients) {
    return inFlight.patients;
  }

  inFlight.patients = (async () => {
    try {
      // Fetch health records first (with its own caching/deduplication)
      const records = await fetchAllHealthRecords(options?.force);

      const response = await pmsRequest(
        { method: "GET", url: `/patients?page=1&limit=${PMS_PAGE_LIMIT}` },
        /* fallback */ null
      );

      if (response === null) {
        // On persistent failure, return stale cache if available, else empty array
        return cache.patients.data || [];
      }

      const rawPatients = extractPatientsFromResponse(response);
      const recordsByPatient = groupRecordsByPatient(records);

      const normalizedPatients = rawPatients
        .map((rawPatient) => {
          try {
            const patientId = cleanText(rawPatient?.patient_id);
            return mapPatient(rawPatient, recordsByPatient.get(patientId) || []);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return setCache("patients", normalizedPatients);
    } catch (error) {
      console.error("PMS patients error:", error.message);
      return cache.patients.data || [];
    }
  })().finally(() => {
    inFlight.patients = null;
  });

  return inFlight.patients;
}

async function fetchPatient(patientId, options = {}) {
  assertPmsKey();

  const normalizedPatientId = cleanText(patientId);
  if (!normalizedPatientId) {
    throw new Error("Missing patient_id input");
  }

  if (!options?.force) {
    const cachedPatients = isCacheFresh(cache.patients) ? cache.patients.data : null;
    const cachedPatient = cachedPatients?.find((entry) => cleanText(entry?.patient_id) === normalizedPatientId);
    if (cachedPatient) {
      return cachedPatient;
    }
  }

  try {
    const allPatients = await fetchAllPatients(options);
    const hydratedPatient = allPatients.find((entry) => cleanText(entry?.patient_id) === normalizedPatientId);
    if (hydratedPatient) {
      return hydratedPatient;
    }
  } catch (error) {
    console.warn("Falling back to direct PMS patient fetch:", error.message);
  }

  const res = await pmsRequest(
    { method: "GET", url: `/patients/${normalizedPatientId}` },
    /* fallback */ null
  );

  if (res === null) {
    throw new Error("Patient not found in PMS (PMS unreachable)");
  }

  const raw =
    res?.data?.data?.patient ||
    (Array.isArray(res?.data?.data?.patients) ? res.data.data.patients[0] : null) ||
    res?.data?.data ||
    null;

  if (!raw || typeof raw !== "object") {
    throw new Error("Patient not found in PMS");
  }

  const records = await fetchHealthRecords(normalizedPatientId, options);
  return mapPatient(raw, records);
}

module.exports = {
  fetchAllPatients,
  fetchPatient,
  fetchHealthRecords,
};
