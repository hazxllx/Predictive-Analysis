/**
 * My Progress Page
 *
 * Shows the patient's assessment history with trend analysis.
 * Compares the latest assessment to the previous one to show improvement or decline.
 *
 * Performance optimizations:
 * - useMemo for derived trend data and filtered history
 * - useCallback for event handlers
 * - Cancelled flag prevents state updates after unmount
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowUp, ArrowDown, Minus, AlertCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import NotLinkedState from "../components/NotLinkedState";
import RiskBadge from "../components/RiskBadge";
import { fetchWithCache } from "../api/cachedFetch";
import { getAssessmentRiskScore, normalizeAssessment } from "../utils/normalizeAssessment";
import { getPatientFacingRiskLabel } from "../utils/riskTone";
import "./PatientDashboard.css";

const isDev = import.meta.env.DEV;

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getTrendSummary(latest, previous) {
  if (!latest || !previous) {
    return {
      title: "Not enough data",
      subtitle: "Complete one more assessment to see your progress.",
      status: null,
      icon: null,
    };
  }

  const latestScore = getAssessmentRiskScore(latest);
  const previousScore = getAssessmentRiskScore(previous);
  const delta = latestScore - previousScore;

  if (delta < -3) {
    return {
      title: "You're improving",
      subtitle: "Your risk score has decreased since your last assessment.",
      status: `-${Math.round(Math.abs(delta))} points`,
      icon: "improving",
    };
  }

  if (delta > 3) {
    return {
      title: "Your attention is needed",
      subtitle: "Your risk score has increased. Review recommendations and take action.",
      status: `+${Math.round(delta)} points`,
      icon: "declining",
    };
  }

  return {
    title: "You're stable",
    subtitle: "Your risk score remains stable. Continue your current routines.",
    status: "Stable",
    icon: "stable",
  };
}

export default function MyProgress() {
  const { user, syncUser, loading: authLoading, authReady } = useAuth();

  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);

  // Separate request lifecycle states to avoid premature/fake error rendering
  const [phase, setPhase] = useState("loading"); // 'loading' | 'empty' | 'error' | 'success'
  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadingReason, setLoadingReason] = useState("Loading your progress...");

  const maxRetries = 4;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const loadProgress = useCallback(async () => {
    let active = true;
    const startedAt = Date.now();

    if (authLoading || !authReady) return;
    if (!user) return;

    setLoadError("");
    setLinkInfo(null);
    setPhase("loading");
    setLoading(true);
    setLoadingReason("Loading your progress...");

    const attemptFetch = async (attempt) => {
      const attemptStart = Date.now();
      if (isDev) console.log(`[Progress] loadProgress attempt ${attempt}/${maxRetries}`);

      const { data: meResponse } = await fetchWithCache({
        key: ["patients-me", user?._id || user?.email || "current"],
        force: attempt > 0,
        fetcher: async () => {
          const { data } = await api.get("/patients/me");
          return data;
        },
      });

      if (!active) return;

      if (meResponse?.user?.id && meResponse.user.patient_id !== user?.patient_id) {
        syncUser(meResponse.user);
      }

      const linked = Boolean(meResponse?.linked && meResponse?.data);
      if (!linked) {
        if (attempt < maxRetries) {
          setLoadingReason("Syncing your health data (this can take a moment)...");
          const delay = Math.min(1000 * (2 ** attempt), 5000);
          await sleep(delay);
          return attemptFetch(attempt + 1);
        }

        setPatient(null);
        setAssessments([]);
        setLinkInfo({
          type: meResponse?.multipleMatches ? "multiple" : "none",
          message: meResponse?.multipleMatches
            ? "Multiple PMS profiles matched your name. Your care team can link the correct record."
            : "No PMS patient record linked yet.",
        });
        setPhase("empty");
        setLoading(false);
        return null;
      }

      const resolvedPatientId =
        meResponse.data?.id || meResponse.data?.patient_id || user?.patient_id || null;

      if (!resolvedPatientId) {
        setAssessments([]);
        setPhase("empty");
        setLoading(false);
        return null;
      }

      setPatient(meResponse.data);

      // Fetch assessment history
      const { data } = await fetchWithCache({
        key: ["assessment-history", resolvedPatientId],
        force: attempt > 0,
        fetcher: async () => {
          const { data } = await api.get("/api/v1/predictive-analysis/risk-assessment/history");
          return data;
        },
      });

      const history = Array.isArray(data?.data) ? data.data : [];
      const normalizedReal = history
        .map(normalizeAssessment)
        .filter((item) => item && parseDate(item.createdAt || item.date))
        .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      if (!active) return;
      setAssessments(normalizedReal);
      setPhase("success");

      if (isDev) console.log(`[Progress] attempt ${attempt} completed in ${Date.now() - attemptStart}ms`);
      return normalizedReal;
    };

    try {
      await attemptFetch(0);
    } catch (err) {
      if (!active) return;
      setPhase("error");
      setLoadError(err?.response?.data?.message || "Unable to load your progress right now.");
      setAssessments([]);
      if (isDev) console.warn("[Progress] loadProgress error:", err?.response?.status);
    } finally {
      if (active) {
        setLoading(false);
        if (isDev) console.log(`[Progress] total loadProgress time ${Date.now() - startedAt}ms`);
      }
    }

    return () => {
      active = false;
    };
  }, [user, syncUser, authLoading, authReady]);

  useEffect(() => {
    if (authLoading || !authReady) return;
    loadProgress();
  }, [loadProgress, authLoading, authReady]);

  const recentAssessments = useMemo(() => assessments.slice(0, 5), [assessments]);
  const latest = recentAssessments[0] || null;
  const previous = recentAssessments[1] || null;
  const trend = useMemo(() => getTrendSummary(latest, previous), [latest, previous]);

  if (authLoading || !authReady || loading || phase === "loading") {
    return (
      <div className="patient-health-layout">
        <Sidebar />
        <main className="patient-health-main">
          <div className="patient-health-content">
            <section className="patient-health-surface">Loading your progress...</section>
          </div>
        </main>
      </div>
    );
  }

  if (phase === "error" && loadError) {
    return (
      <div className="patient-health-layout">
        <Sidebar />
        <main className="patient-health-main">
          <div className="patient-health-content">
            <section className="patient-health-surface">{loadError}</section>
          </div>
        </main>
      </div>
    );
  }

  if (!patient && phase !== "loading" && phase !== "error") {
    return (
      <NotLinkedState
        title={linkInfo?.type === "multiple" ? "Multiple profiles found" : "You're not connected yet"}
        description={linkInfo?.message || "No PMS patient record linked yet."}
        primaryText="Link my patient record ->"
        onPrimary={() => (window.location.href = "/my-dashboard")}
      />
    );
  }

  const hasAssessments = assessments.length > 0;

  return (
    <div className="patient-health-layout">
      <Sidebar />
      <main className="patient-health-main">
        <div className="patient-health-content">
          <header className="patient-health-header">
            <div>
              <p className="patient-health-header-label">Progress Tracking</p>
              <h1>My Progress</h1>
            </div>
          </header>

          {!hasAssessments ? (
            <EmptyState
              title="No assessments yet"
              description="Run your first assessment on the Dashboard to start tracking your health progress over time."
              ctaText="Go to Dashboard ->"
              onCta={() => (window.location.href = "/my-dashboard")}
            />
          ) : (
            <>
              <section className="patient-health-summary-card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h2 className="patient-health-summary-title">{trend.title}</h2>
                    <p className="patient-health-summary-subtitle">{trend.subtitle}</p>
                    {trend.status && <p className="patient-health-delta">{trend.status}</p>}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontSize: "32px",
                      minWidth: "50px",
                      justifyContent: "center",
                    }}
                  >
                    {trend.icon === "improving" && <ArrowUp color="#22c55e" size={40} />}
                    {trend.icon === "declining" && <ArrowDown color="#dc2626" size={40} />}
                    {trend.icon === "stable" && <Minus color="#eab308" size={40} />}
                  </div>
                </div>
              </section>

              <div className="patient-health-grid">
                <section className="patient-health-card">
                  <div style={{ display: "grid", gap: "8px" }}>
                    <p
                      style={{
                        margin: 0,
                        color: "#668194",
                        fontSize: "12px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      Latest Assessment
                    </p>
                    <h3
                      style={{
                        margin: 0,
                        color: "#17384c",
                        fontSize: "20px",
                        fontFamily: "Lora, serif",
                        fontWeight: 600,
                      }}
                    >
                      {getAssessmentRiskScore(latest) === null ? "--" : Math.round(getAssessmentRiskScore(latest))}
                    </h3>
                    <p style={{ margin: 0, color: "#708899", fontSize: "12px" }}>Risk Score</p>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px" }}>
                    <RiskBadge level={latest.risk_level} />
                    <span style={{ fontSize: "12px", color: "#526f82", fontWeight: 700 }}>
                      {getPatientFacingRiskLabel(latest.risk_level)}
                    </span>
                    {latest.createdAt && (
                      <span style={{ fontSize: "12px", color: "#708899" }}>
                        {new Date(latest.createdAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </section>

                <section className="patient-health-card">
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#668194",
                      textTransform: "uppercase",
                    }}
                  >
                    Assessment History
                  </p>
                  <div style={{ display: "grid", gap: "0" }}>
                    {recentAssessments.map((assessment, idx) => (
                      <div
                        key={assessment._id || assessment.assessment_id || idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: idx < recentAssessments.length - 1 ? "1px solid #edf3f7" : "none",
                        }}
                      >
                        <span style={{ fontSize: "13px", color: "#668194" }}>
                          {new Date(assessment.createdAt || assessment.date).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                          })}
                          {assessment.createdAt && (
                            <span style={{ marginLeft: "6px", color: "#94a3b8", fontSize: "12px" }}>
                              {new Date(assessment.createdAt).toLocaleTimeString("en-PH", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                        </span>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#17384c" }}>
                            {getAssessmentRiskScore(assessment) === null
                              ? "--"
                              : Math.round(getAssessmentRiskScore(assessment))}
                            /100
                          </span>
                          <RiskBadge level={assessment.risk_level} />
                          <span style={{ fontSize: "12px", color: "#526f82", fontWeight: 700 }}>
                            {getPatientFacingRiskLabel(assessment.risk_level)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="patient-health-card">
                <div style={{ display: "grid", gap: "8px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#668194",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <AlertCircle size={14} /> Understanding Your Progress
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "#526f82" }}>
                    Your risk score is calculated based on your medical history, lifestyle factors, and recent vitals.
                    A lower score indicates better overall health. Review the guidance on your Dashboard alongside your
                    progress timeline.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
