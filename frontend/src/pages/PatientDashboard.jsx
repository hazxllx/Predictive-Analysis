import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, HeartPulse, RefreshCw, ShieldCheck, Stethoscope } from "lucide-react";
import Sidebar from "../components/Sidebar";
import RiskBadge from "../components/RiskBadge";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import NotLinkedState from "../components/NotLinkedState";
import { fetchWithCache } from "../api/cachedFetch";
import { invalidateCachedQuery, setCachedQuery } from "../api/queryCache";
import { normalizeAssessment } from "../utils/normalizeAssessment";
import { normalizePatient } from "../utils/normalizePatients";
import "./PatientDashboard.css";

const RISK_TONE = {
  Critical: { stroke: "#dc2626", soft: "#fef2f2", text: "#991b1b" },
  High: { stroke: "#f97316", soft: "#fff7ed", text: "#9a3412" },
  Moderate: { stroke: "#eab308", soft: "#fefce8", text: "#854d0e" },
  Low: { stroke: "#22c55e", soft: "#f0fdf4", text: "#166534" },
};

function getPatientFirstName(name = "") {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function formatDate(value) {
  if (!value) return "No assessment yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No assessment yet";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function getPatientId(patient, user) {
  return patient?.patient_id || patient?.id || user?.patient_id || null;
}

function getHealthScore(riskScore) {
  if (!Number.isFinite(Number(riskScore))) return null;
  return Math.max(0, Math.min(100, 100 - Number(riskScore)));
}

function getTopRiskFactor(assessment, patient) {
  const breakdown = Array.isArray(assessment?.breakdown) ? assessment.breakdown : [];
  const topContribution = [...breakdown]
    .filter((item) => Number(item?.points) > 0)
    .sort((a, b) => Number(b.points) - Number(a.points))[0];

  if (topContribution?.label) return topContribution.label;

  const bp = parseBloodPressure(patient?.vitals?.blood_pressure);
  if (bp.status !== "Normal" && bp.status !== "No recent reading") return "Blood pressure";
  if (patient?.lifestyle?.smoking) return "Smoking";
  if (patient?.lifestyle?.alcohol) return "Alcohol use";
  if (patient?.lifestyle?.physical_activity) return "Physical activity";
  return "Recent health markers";
}

function getSummary(level, hasAssessment) {
  if (!hasAssessment) return "Run an assessment to create your first personalized health view.";
  if (level === "Critical") return "Your profile needs prompt clinical attention.";
  if (level === "High") return "A few markers need closer follow-up soon.";
  if (level === "Moderate") return "Some markers are worth improving this week.";
  if (level === "Low") return "Most recent markers are in a reassuring range.";
  return "Your latest assessment is ready.";
}

function getRecommendations(assessment) {
  const list = Array.isArray(assessment?.recommendations) ? assessment.recommendations : [];
  return [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 3);
}

function parseBloodPressure(value) {
  const [systolic, diastolic] = String(value || "")
    .split("/")
    .map((part) => Number(part));

  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return { status: "No recent reading", tone: "muted" };
  }

  if (systolic >= 140 || diastolic >= 90) return { status: "High", tone: "danger" };
  if (systolic >= 130 || diastolic >= 85) return { status: "Slightly elevated", tone: "watch" };
  return { status: "Normal", tone: "good" };
}

function getVitalCards(patient) {
  const vitals = patient?.vitals || {};
  const bpStatus = parseBloodPressure(vitals.blood_pressure);
  const heartRate = Number(vitals.heart_rate);
  const temp = Number(vitals.temperature);

  return [
    {
      key: "bp",
      label: "Blood Pressure",
      value: vitals.blood_pressure || "No recent reading",
      status: bpStatus.status,
      tone: bpStatus.tone,
    },
    {
      key: "hr",
      label: "Heart Rate",
      value: vitals.heart_rate ? `${vitals.heart_rate} bpm` : "No recent reading",
      status:
        Number.isFinite(heartRate) && (heartRate > 100 || heartRate < 50)
          ? "Needs review"
          : Number.isFinite(heartRate)
          ? "Normal"
          : "No recent reading",
      tone: Number.isFinite(heartRate) && (heartRate > 100 || heartRate < 50) ? "watch" : "good",
    },
    {
      key: "temp",
      label: "Temperature",
      value: vitals.temperature ? `${vitals.temperature} F` : "No recent reading",
      status:
        Number.isFinite(temp) && temp >= 100.4
          ? "Elevated"
          : Number.isFinite(temp)
          ? "Normal"
          : "No recent reading",
      tone: Number.isFinite(temp) && temp >= 100.4 ? "watch" : "good",
    },
  ];
}

function buildMissingDataMessage(error) {
  const fields = error?.response?.data?.missing_fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    return error?.response?.data?.message || "Assessment could not be completed.";
  }

  return `PMS data is missing: ${fields.join(", ")}. Please ask your care team to update your profile.`;
}

export default function PatientDashboard() {
  const { user, syncUser } = useAuth();
  const [patient, setPatient] = useState(null);
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningAssessment, setRunningAssessment] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [assessmentError, setAssessmentError] = useState("");
  const [linkInfo, setLinkInfo] = useState(null);

  // The patient dashboard uses /patients/me as the single PMS link source of truth.
  const loadDashboard = useCallback(
    async ({ force = false } = {}) => {
      if (!user) return;

      try {
        setDashboardError("");
        setAssessmentError("");

        const cacheKey = ["patients-me", user?.id || user?.email || "current"];
        const { data: linkResponse } = await fetchWithCache({
          key: cacheKey,
          force,
          fetcher: async () => {
            const { data } = await api.get("/patients/me");
            return data;
          },
        });

        if (linkResponse?.user?.id && linkResponse.user.patient_id !== user?.patient_id) {
          syncUser(linkResponse.user);
        }

        if (!(linkResponse?.linked && linkResponse?.data)) {
          setPatient(null);
          setLatestAssessment(null);
          setHistory([]);
          setLinkInfo({
            type: linkResponse?.multipleMatches ? "multiple" : "none",
            message: linkResponse?.multipleMatches
              ? "Multiple PMS profiles matched your name. Your care team can link the correct record."
              : "No PMS patient profile matched your account name yet.",
          });
          return;
        }

        const normalizedPatient = normalizePatient(linkResponse.data);
        const patientId = getPatientId(normalizedPatient, user);
        setPatient(normalizedPatient);
        setLinkInfo(null);
        setCachedQuery(cacheKey, linkResponse);

        if (!patientId) {
          setLatestAssessment(null);
          setHistory([]);
          return;
        }

        const { data: historyResponse } = await fetchWithCache({
          key: ["assessment-history", patientId],
          force,
          fetcher: async () => {
            const { data } = await api.get("/api/v1/predictive-analysis/risk-assessment/history");
            return data;
          },
        });

        const normalizedHistory = (Array.isArray(historyResponse?.data) ? historyResponse.data : [])
          .map(normalizeAssessment)
          .filter(Boolean)
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        setHistory(normalizedHistory);
        setLatestAssessment(normalizedHistory[0] || null);
      } catch (err) {
        console.error("Patient dashboard load error:", err);
        setDashboardError(err.response?.data?.message || "Unable to load your dashboard right now.");
        setPatient(null);
        setLatestAssessment(null);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    },
    [syncUser, user]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Assessments are created from hydrated PMS data on the backend, then refetched for consistency.
  const runAssessment = async () => {
    if (runningAssessment) return;

    const patientId = getPatientId(patient, user);
    if (!patientId) {
      setAssessmentError("Your PMS profile is not linked yet.");
      return;
    }

    try {
      setRunningAssessment(true);
      setAssessmentError("");

      const { data } = await api.post("/api/v1/predictive-analysis/risk-assessment", {
        patient_id: patientId,
      });
      const normalized = normalizeAssessment(data);

      if (normalized) {
        setLatestAssessment(normalized);
        setHistory((prev) => [normalized, ...prev.filter((item) => item?._id !== normalized?._id)]);
        setCachedQuery(["assessment", patientId], normalized);
      }

      invalidateCachedQuery(["assessment-history", patientId]);
      await loadDashboard({ force: true });
    } catch (err) {
      setAssessmentError(buildMissingDataMessage(err));
    } finally {
      setRunningAssessment(false);
    }
  };

  const hasAssessment = Boolean(latestAssessment);
  const riskScore = Number(latestAssessment?.risk_score);
  const healthScore = hasAssessment ? getHealthScore(riskScore) : null;
  const riskLevel = latestAssessment?.risk_level || "Low";
  const tone = RISK_TONE[riskLevel] || RISK_TONE.Low;
  const topRiskFactor = getTopRiskFactor(latestAssessment, patient);
  const recommendations = getRecommendations(latestAssessment);
  const primaryAction = recommendations[0] || "Keep your next preventive checkup on schedule.";
  const vitals = useMemo(() => getVitalCards(patient), [patient]);
  const previous = history[1] || null;
  const previousHealthScore = previous ? getHealthScore(previous.risk_score) : null;
  const healthScoreDelta =
    previousHealthScore !== null && healthScore !== null ? healthScore - previousHealthScore : null;

  if (loading) {
    return (
      <div className="dashboard-shell patient-dashboard-page">
        <Sidebar />
        <main className="dashboard-main patient-dashboard-main">
          <section className="patient-dashboard-surface">Loading your dashboard...</section>
        </main>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="dashboard-shell patient-dashboard-page">
        <Sidebar />
        <main className="dashboard-main patient-dashboard-main">
          <section className="patient-dashboard-surface">
            <p>{dashboardError}</p>
            <button type="button" className="patient-dashboard-secondary" onClick={() => loadDashboard({ force: true })}>
              Try again
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!patient) {
    return (
      <NotLinkedState
        title={linkInfo?.type === "multiple" ? "Multiple profiles found" : "You're not connected yet"}
        description={linkInfo?.message || "No PMS patient profile is linked to this account."}
        primaryText="Check again"
        onPrimary={() => loadDashboard({ force: true })}
      />
    );
  }

  return (
    <div className="dashboard-shell patient-dashboard-page">
      <Sidebar />

      <main className="dashboard-main patient-dashboard-main">
        <header className="patient-dashboard-header">
          <div>
            <p className="patient-dashboard-kicker">Hello, {getPatientFirstName(patient?.name)}</p>
            <h1>Your Health Score</h1>
          </div>
          <button
            type="button"
            className="patient-dashboard-secondary"
            onClick={() => loadDashboard({ force: true })}
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </header>

        <section className="patient-dashboard-hero">
          <div className="patient-dashboard-score-panel">
            <RadialScore score={healthScore} color={tone.stroke} />
            <div className="patient-dashboard-risk-row">
              <RiskBadge level={riskLevel} large />
              {hasAssessment && <span className="patient-dashboard-date">Assessed {formatDate(latestAssessment?.createdAt)}</span>}
            </div>
          </div>

          <div className="patient-dashboard-focus">
            <div className="patient-dashboard-summary">
              <p className="patient-dashboard-label">What matters most</p>
              <h2>{hasAssessment ? topRiskFactor : "First assessment"}</h2>
              <p>{getSummary(riskLevel, hasAssessment)}</p>
            </div>

            <div className="patient-dashboard-action" style={{ background: tone.soft, color: tone.text }}>
              <ShieldCheck size={18} />
              <span>{primaryAction}</span>
            </div>

            {healthScoreDelta !== null && (
              <p className="patient-dashboard-delta">
                {healthScoreDelta > 0
                  ? `Improved by ${healthScoreDelta} points since your last assessment.`
                  : healthScoreDelta < 0
                  ? `Down ${Math.abs(healthScoreDelta)} points since your last assessment.`
                  : "Stable since your last assessment."}
              </p>
            )}

            <button
              type="button"
              className="patient-dashboard-primary"
              onClick={runAssessment}
              disabled={runningAssessment}
            >
              {runningAssessment ? "Analyzing..." : hasAssessment ? "Update Assessment" : "Run Assessment"}
              <ArrowRight size={15} />
            </button>

            {assessmentError && <div className="patient-dashboard-error">{assessmentError}</div>}
          </div>
        </section>

        {!hasAssessment ? (
          <EmptyState
            compact
            title="No assessment yet"
            description="Run your first assessment to see your health score, top risk factor, and next best action."
            ctaText={runningAssessment ? "Analyzing..." : "Run Assessment"}
            onCta={runAssessment}
          />
        ) : (
          <section className="patient-dashboard-grid">
            <article className="patient-dashboard-card patient-dashboard-card-span">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Recommended next steps</p>
                  <h3>Small actions with the most value</h3>
                </div>
                <HeartPulse size={18} />
              </div>

              <div className="patient-dashboard-actions-list">
                {recommendations.map((item, index) => (
                  <div key={item} className="patient-dashboard-action-item">
                    <span>{index + 1}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="patient-dashboard-card">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Core vitals</p>
                  <h3>Recent readings</h3>
                </div>
                <Activity size={18} />
              </div>

              <div className="patient-dashboard-vitals">
                {vitals.map((vital) => (
                  <div key={vital.key} className="patient-dashboard-vital">
                    <div>
                      <p>{vital.label}</p>
                      <strong>{vital.value}</strong>
                    </div>
                    <span className={`patient-dashboard-vital-status patient-dashboard-vital-status-${vital.tone}`}>
                      {vital.status}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="patient-dashboard-card">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Care guidance</p>
                  <h3>Who can help</h3>
                </div>
                <Stethoscope size={18} />
              </div>

              <div className="patient-dashboard-chips">
                {(latestAssessment?.suggested_specialist || []).slice(0, 3).map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {(latestAssessment?.suggested_specialist || []).length === 0 && <p>No specialist suggestion yet.</p>}
              </div>
            </article>
          </section>
        )}

        {latestAssessment?.disclaimer && <p className="patient-dashboard-disclaimer">{latestAssessment.disclaimer}</p>}
      </main>
    </div>
  );
}

function RadialScore({ score, color }) {
  // SVG keeps the score visualization lightweight and avoids dashboard chart dependencies.
  const normalized = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="patient-dashboard-radial" style={{ "--score-color": color }}>
      <svg viewBox="0 0 120 120" role="img" aria-label="Health score">
        <circle className="patient-dashboard-radial-track" cx="60" cy="60" r={radius} />
        <circle
          className="patient-dashboard-radial-progress"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="patient-dashboard-radial-text">
        <strong>{score === null || score === undefined ? "--" : normalized}</strong>
        <span>Health Score</span>
      </div>
    </div>
  );
}
