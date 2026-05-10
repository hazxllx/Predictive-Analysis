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
import {
  getAssessmentRiskLevel,
  getAssessmentRiskScore,
  normalizeAssessment,
} from "../utils/normalizeAssessment";
import { cleanText, normalizePatient } from "../utils/normalizePatients";
import { getPatientFacingRiskLabel } from "../utils/riskTone";
import ResultTabs from "../components/ResultTabs";
import RadialHealthScore from "../components/RadialHealthScore";
import RecommendationList from "../components/RecommendationList";
import { generateRecommendations } from "../utils/recommendationEngine";
import "./PatientDashboard.css";

const isDev = import.meta.env.DEV;

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
  const { user, syncUser, loading: authLoading, authReady } = useAuth();

  const [patient, setPatient] = useState(null);
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [linkInfo, setLinkInfo] = useState(null);

  // Separate request lifecycle states to avoid premature/fake error rendering
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("loading"); // 'loading' | 'empty' | 'error' | 'success'
  const [dashboardError, setDashboardError] = useState("");
  const [loadingReason, setLoadingReason] = useState("Loading your health data...");

  const [runningAssessment, setRunningAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");

  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 4;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const loadDashboard = useCallback(
    async ({ force = false } = {}) => {
      if (!authReady || authLoading) return;
      if (!user) return;

      const startedAt = Date.now();

      setDashboardError("");
      setAssessmentError("");
      setLinkInfo(null);

      // If we are retrying, keep phase as loading (never render error prematurely)
      setPhase("loading");
      setLoading(true);
      setLoadingReason("Loading your health data...");
      setRetryCount((c) => (force ? 0 : c));

      const cacheKey = ["patients-me", user?.id || user?.email || "current"];

      const attemptFetch = async (attempt) => {
        const attemptStart = Date.now();
        if (isDev) console.log(`[Dashboard] loadDashboard attempt ${attempt}/${maxRetries}`);

        // 1) fetch patient profile (PMS sync may be delayed)
        const { data: linkResponse } = await fetchWithCache({
          key: cacheKey,
          force: force || attempt > 0,
          fetcher: async () => {
            const { data } = await api.get("/patients/me");
            return data;
          },
        });

        if (linkResponse?.user?.id && linkResponse.user.patient_id !== user?.patient_id) {
          syncUser(linkResponse.user);
        }

        const linked = Boolean(linkResponse?.linked && linkResponse?.data);
        if (!linked) {
          // Treat as "not ready yet" rather than fatal error to prevent false error flashes.
          // Backoff + retry in case PMS sync is still catching up.
          if (attempt < maxRetries) {
            setLoadingReason(
              linkResponse?.multipleMatches
                ? "Finalizing your patient profile link..."
                : "Syncing your health data (this can take a moment)..."
            );
            setRetryCount(attempt + 1);
            const delay = Math.min(1000 * (2 ** attempt), 5000);
            await sleep(delay);
            return attemptFetch(attempt + 1);
          }

          // Retries exhausted -> now we can show real "not linked" state.
          setPatient(null);
          setLatestAssessment(null);
          setHistory([]);
          setLinkInfo({
            type: linkResponse?.multipleMatches ? "multiple" : "none",
            message: linkResponse?.multipleMatches
              ? "Multiple PMS profiles matched your name. Your care team can link the correct record."
              : "No PMS patient profile matched your account name yet.",
          });
          setPhase("empty");
          setLoading(false);
          return null;
        }

        const normalizedPatient = normalizePatient(linkResponse.data);
        const patientId = getPatientId(normalizedPatient, user);

        setPatient(normalizedPatient);
        setLinkInfo(null);
        setCachedQuery(cacheKey, linkResponse);

        if (!patientId) {
          setLatestAssessment(null);
          setHistory([]);
          setPhase("empty");
          setLoading(false);
          return null;
        }

        // 2) fetch assessment history
        const { data: historyResponse } = await fetchWithCache({
          key: ["assessment-history", patientId],
          force: force || attempt > 0,
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

        setPhase("success");
        if (isDev) console.log(`[Dashboard] attempt ${attempt} completed in ${Date.now() - attemptStart}ms`);
        return normalizedHistory;
      };

      try {
        await attemptFetch(0);
      } catch (err) {
        // Retries cover most "PMS delayed" scenarios; if we still land here, it's real failure.
        setPhase("error");
        setDashboardError(err?.response?.data?.message || "Unable to load your dashboard right now.");
        setPatient(null);
        setLatestAssessment(null);
        setHistory([]);
      } finally {
        setLoading(false);
        if (isDev) console.log(`[Dashboard] total loadDashboard time ${Date.now() - startedAt}ms`);
      }
    },
    [authReady, authLoading, user, syncUser]
  );

  useEffect(() => {
    if (authLoading || !authReady) return;
    loadDashboard();
  }, [loadDashboard, authLoading, authReady]);

  const runAssessment = useCallback(async () => {
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
  }, [runningAssessment, patient, user, loadDashboard]);

  const hasAssessment = Boolean(latestAssessment);
  const riskScore = getAssessmentRiskScore(latestAssessment);
  const riskLevel = getAssessmentRiskLevel(latestAssessment) || "Low";
  const patientFacingRiskLabel = getPatientFacingRiskLabel(riskLevel);
  const tone = RISK_TONE[riskLevel] || RISK_TONE.Low;
  const topRiskFactor = useMemo(() => getTopRiskFactor(latestAssessment, patient), [latestAssessment, patient]);
  const summaryText = useMemo(() => getSummary(riskLevel, hasAssessment), [riskLevel, hasAssessment]);
  const recommendations = useMemo(
    () => generateRecommendations({ patient, assessment: latestAssessment }),
    [patient, latestAssessment]
  );

  const primaryAction = recommendations[0]?.title || "Keep your next preventive checkup on schedule.";
  const vitals = useMemo(() => getVitalCards(patient), [patient]);
  const specialists = useMemo(
    () => (Array.isArray(latestAssessment?.suggested_specialist) ? latestAssessment.suggested_specialist : []),
    [latestAssessment]
  );
  const labTests = useMemo(
    () => (Array.isArray(latestAssessment?.lab_tests) ? latestAssessment.lab_tests : []),
    [latestAssessment]
  );
  const lifestyleChips = useMemo(() => {
    const lifestyle = patient?.lifestyle || {};
    const chips = [];
    if (lifestyle.smoking) chips.push("Smoking");
    if (lifestyle.alcohol) chips.push("Alcohol use");
    if (cleanText(lifestyle.diet)) chips.push(cleanText(lifestyle.diet));
    if (cleanText(lifestyle.physical_activity)) chips.push(cleanText(lifestyle.physical_activity));
    if (cleanText(lifestyle.sodium_intake)) chips.push(`Sodium: ${cleanText(lifestyle.sodium_intake)}`);
    if (cleanText(lifestyle.sleep_quality)) chips.push(`Sleep: ${cleanText(lifestyle.sleep_quality)}`);
    if (cleanText(lifestyle.sedentary_behavior)) chips.push(`Sedentary: ${cleanText(lifestyle.sedentary_behavior)}`);
    return chips;
  }, [patient]);

  const familyHistoryItems = useMemo(() => {
    const historyMap = patient?.family_history || {};
    return Object.entries(historyMap)
      .filter(([, value]) => (typeof value === "boolean" ? value : Boolean(cleanText(value))))
      .map(([key]) =>
        String(key)
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      );
  }, [patient]);

  const previous = history[1] || null;
  const previousRiskScore = previous ? getAssessmentRiskScore(previous) : null;
  const riskScoreDelta =
    previousRiskScore !== null && riskScore !== null ? riskScore - previousRiskScore : null;

  // While auth is hydrating, always show loading UI (no fake errors)
  if (authLoading || !authReady || loading || phase === "loading") {
    return (
      <div className="dashboard-shell patient-dashboard-page">
        <Sidebar />
        <main className="dashboard-main patient-dashboard-main">
          <section className="patient-dashboard-surface">Loading your dashboard...</section>
        </main>
      </div>
    );
  }

  if (phase === "error" && dashboardError) {
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

  // Only show NotLinked when we have definitively finished loading and have no patient profile.
  if (!patient && phase !== "loading" && phase !== "error") {
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
            <h1>Your Risk Assessment</h1>
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
            <RadialHealthScore score={riskScore} riskLevel={riskLevel} size={92} strokeWidth={7} />
            <div className="patient-dashboard-risk-row">
              <RiskBadge level={riskLevel} large />
              {hasAssessment && (
                <span className="patient-dashboard-date">Assessed {formatDate(latestAssessment?.createdAt)}</span>
              )}
            </div>
          </div>

          <div className="patient-dashboard-focus">
            <div className="patient-dashboard-summary">
              <p className="patient-dashboard-label">What matters most</p>
              <h2>{hasAssessment ? topRiskFactor : "First assessment"}</h2>
              <p>{summaryText}</p>
              {hasAssessment && <p className="patient-dashboard-label">Current Status: {patientFacingRiskLabel}</p>}
            </div>

            <div className="patient-dashboard-action" style={{ color: tone.text }}>
              <ShieldCheck size={18} />
              <span>{primaryAction}</span>
            </div>

            {riskScoreDelta !== null && (
              <p className="patient-dashboard-delta">
                {riskScoreDelta < 0
                  ? `Risk decreased by ${Math.abs(riskScoreDelta)} points since your last assessment.`
                  : riskScoreDelta > 0
                  ? `Risk increased by ${riskScoreDelta} points since your last assessment.`
                  : "Risk is stable since your last assessment."}
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
            description="Run your first assessment to see your risk score, top risk factor, and next best action."
            ctaText={runningAssessment ? "Analyzing..." : "Run Assessment"}
            onCta={runAssessment}
          />
        ) : (
          <section className="patient-dashboard-grid">
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
                    <span
                      className={`patient-dashboard-vital-status patient-dashboard-vital-status-${vital.tone}`}
                    >
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
                {specialists.slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {specialists.length === 0 && <p>No specialist suggestion yet.</p>}
              </div>
              <div className="patient-dashboard-card-head" style={{ marginTop: "10px" }}>
                <div>
                  <p className="patient-dashboard-label">Suggested lab tests</p>
                </div>
              </div>
              <div className="patient-dashboard-chips">
                {labTests.slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {labTests.length === 0 && <p>No lab test suggestions yet.</p>}
              </div>
            </article>

            <article className="patient-dashboard-card">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Lifestyle & habits</p>
                  <h3>Daily patterns</h3>
                </div>
                <ShieldCheck size={18} />
              </div>
              <div className="patient-dashboard-chips">
                {lifestyleChips.slice(0, 8).map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {lifestyleChips.length === 0 && <p>No lifestyle information available yet.</p>}
              </div>
            </article>

            <article className="patient-dashboard-card">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Family history</p>
                  <h3>Inherited risk context</h3>
                </div>
                <HeartPulse size={18} />
              </div>
              <div className="patient-dashboard-chips">
                {familyHistoryItems.slice(0, 10).map((item) => (
                  <span key={item}>{item}</span>
                ))}
                {familyHistoryItems.length === 0 && <p>No family history risk markers recorded.</p>}
              </div>
            </article>

            <article className="patient-dashboard-card patient-dashboard-card-span">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Personalized guidance</p>
                  <h3>Recommended Actions</h3>
                </div>
                <ShieldCheck size={18} />
              </div>
              <div className="patient-dashboard-recs-body">
                {recommendations.length > 0 ? (
                  <RecommendationList recommendations={recommendations} title="" maxPerCategory={4} />
                ) : (
                  <p style={{ margin: 0, color: "var(--text-muted)", fontWeight: 700 }}>
                    No recommendations available yet. Run an assessment to generate guidance.
                  </p>
                )}
              </div>
            </article>

            <article className="patient-dashboard-card patient-dashboard-card-span">
              <div className="patient-dashboard-card-head">
                <div>
                  <p className="patient-dashboard-label">Score breakdown</p>
                  <h3>Why your score looks this way</h3>
                </div>
                <Activity size={18} />
              </div>
              <ResultTabs data={latestAssessment} initialTab="Breakdown" />
            </article>
          </section>
        )}

        {latestAssessment?.disclaimer && <p className="patient-dashboard-disclaimer">{latestAssessment.disclaimer}</p>}
      </main>
    </div>
  );
}
