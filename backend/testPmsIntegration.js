require("dotenv").config();
const axios = require("axios");

const BASE_URL = "http://localhost:5000";
const API_KEY = process.env.API_KEY || "";
const SAFE_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
};

if (!process.env.API_KEY) {
  console.error("❌ API_KEY is not set in environment");
  process.exit(1);
}

function logResult(name, passed, details) {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (details) console.log(`   ${details}`);
}

async function runCase(name, fn) {
  try {
    await fn();
    return { name, passed: true };
  } catch (error) {
    return { name, passed: false, error: error.message };
  }
}

async function request(path, options = {}) {
  return axios({
    method: options.method || "post",
    url: `${BASE_URL}${path}`,
    headers: options.headers || SAFE_HEADERS,
    data: options.data || {},
    timeout: options.timeout || 7000,
    validateStatus: () => true,
  });
}

async function testNoApiKey() {
  const res = await request("/api/v1/predictive-analysis/pms/from-pms/123", {
    headers: { "Content-Type": "application/json" },
  });
  if (res.status !== 401) {
    throw new Error(`Expected 401, got ${res.status}`);
  }
}

async function testWrongApiKey() {
  const res = await request("/api/v1/predictive-analysis/pms/from-pms/123", {
    headers: { "Content-Type": "application/json", "x-api-key": "wrong-key" },
  });
  if (res.status !== 401) {
    throw new Error(`Expected 401, got ${res.status}`);
  }
}

async function testInvalidPatient() {
  const res = await request("/api/v1/predictive-analysis/pms/from-pms/__invalid_patient__");
  if (res.status !== 404 && res.status !== 500 && res.status !== 504) {
    throw new Error(`Expected 404/500/504, got ${res.status}`);
  }
}

async function testHappyPath() {
  const candidateIds = ["1", "123", "100", "patient-1"];
  let success = null;

  for (const id of candidateIds) {
    const res = await request(`/api/v1/predictive-analysis/pms/from-pms/${id}`);
    if (res.status === 200 && res.data?.status === "success" && res.data?.source === "PMS") {
      success = { id, data: res.data };
      break;
    }
  }

  if (!success) {
    throw new Error("No candidate patientId produced a 200 success response");
  }

  const data = success.data;
  if (!data.patientId || !data.data || typeof data.data.risk_score !== "number") {
    throw new Error("Success payload shape mismatch");
  }
}

async function testTimeoutPath() {
  try {
    await axios.post(
      `${BASE_URL}/api/v1/predictive-analysis/pms/from-pms/123`,
      {},
      { headers: SAFE_HEADERS, timeout: 1 }
    );
    throw new Error("Expected request timeout but request completed");
  } catch (error) {
    if (error.code !== "ECONNABORTED") {
      throw new Error(`Expected ECONNABORTED, got ${error.code || error.message}`);
    }
  }
}

async function main() {
  console.log("Running PMS integration test suite (API keys are never printed)...");
  if (!API_KEY) {
    console.log("⚠️ process.env.API_KEY is not set for this shell context.");
  }

  const tests = [
    { name: "No API key returns 401", fn: testNoApiKey },
    { name: "Wrong API key returns 401", fn: testWrongApiKey },
    { name: "Invalid patient handled (404/500/504)", fn: testInvalidPatient },
    { name: "Happy path success payload", fn: testHappyPath },
    { name: "Client timeout behavior observed", fn: testTimeoutPath },
  ];

  const results = [];
  for (const t of tests) {
    const r = await runCase(t.name, t.fn);
    results.push(r);
    logResult(t.name, r.passed, r.error);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log("\n=== TEST SUMMARY ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("Failed cases:");
    results.filter((r) => !r.passed).forEach((r) => console.log(`- ${r.name}: ${r.error}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test runner crashed:", error.message);
  process.exitCode = 1;
});
