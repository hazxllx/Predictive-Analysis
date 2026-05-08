import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ChevronDown } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import NotLinkedState from "../components/NotLinkedState";
import { fetchWithCache } from "../api/cachedFetch";

function displayDate(value) {
  if (!value) return "No recent update";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No recent update";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function statusFromLevel(level) {
  if (level === "Low" || level === "Moderate") return "Good";
  return "Needs Attention";
}

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function heroMessage(level, hasAssessment) {
  if (!hasAssessment) return "Take your first assessment to see your personalized health score.";
  if (level === "Critical" || level === "High") return "Let’s focus on small improvements today.";
  if (level === "Moderate") return "Let’s focus on small improvements today.";
  return "You're doing well. Keep maintaining your habits.";
}

function normalizeAssessment(item) {
  return {
    risk_score: Number(item?.risk_score ?? item?.score ?? 0) || 0,
    risk_level: item?.risk_level || "Unknown",
    recommendations: Array.isArray(item?.recommendations) ? item.recommendations : [],
    createdAt: item?.createdAt || item?.created_at || item?.timestamp || item?.date || null,
    timestamp: item?.timestamp || item?.createdAt || item?.created_at || item?.date || null,
  };
}

function extractHealthRecords(data) {
  if (Array.isArray(data?.data?.records)) return data.data.records;
  if (Array.isArray(data?.data?.healthRecords)) return data.data.healthRecords;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

export default function PatientDashboard() {
  const { user, syncUser } = useAuth();

  const [patient, setPatient] = useState(null);
  const [latestAssessment, setLatestAssessment] = useState(null);
  const [assessmentHistory, setAssessmentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWhyScore, setShowWhyScore] = useState(false);

  const [runningAssessment, setRunningAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");

  const [showSuccess, setShowSuccess] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentActionLoading, setAppointmentActionLoading] = useState(false);
  const [resolvedPatientId, setResolvedPatientId] = useState(null);
  const [linkInfo, setLinkInfo] = useState(null);
  const [dashboardError, setDashboardError] = useState("");

  const loadAppointments = useCallback(async () => {
    try {
      const pid = resolvedPatientId || user?.patient_id;
      if (!pid) return;
      setAppointmentsLoading(true);
      const { data } = await fetchWithCache({
        key: ["appointments", pid],
        fetcher: async () => {
          const { data } = await api.get(`/api/v1/appointments/patient/${pid}`);
          return data;
        },
      });
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Patient appointments load error:", err);
    } finally {
      setAppointmentsLoading(false);
    }
  }, [resolvedPatientId, user?.patient_id]);

  const respondToAppointment = async (appointmentId, action) => {
    if (appointmentActionLoading) return;

    try {
      setAppointmentActionLoading(true);
      await api.patch(`/api/v1/appointments/${appointmentId}/respond`, { action });
      await loadAppointments();
    } catch (err) {
      console.error("Appointment response error:", err);
    } finally {
      setAppointmentActionLoading(false);
    }
  };

  const loadDashboard = useCallback(async () => {
    try {
      if (!user) return;

      setDashboardError("");
      setAssessmentError("");

      const { data: meResponse } = await fetchWithCache({
        key: ["patients-me", user?._id || user?.email || "current"],
        fetcher: async () => {
          const { data } = await api.get("/patients/me");
          return data;
        },
      });
      console.log("[PatientDashboard] /patients/me response:", meResponse);

      if (meResponse?.user?.id && meResponse.user.patient_id !== user?.patient_id) {
        syncUser(meResponse.user);
      }

      if (meResponse?.linked && meResponse?.data) {
        setPatient(meResponse.data);
        const pid = meResponse.data.id || meResponse.data.patient_id || user?.patient_id || null;
        setResolvedPatientId(pid);
        setLinkInfo(null);

        if (pid) {
          try {
            const { data } = await fetchWithCache({
              key: ["health-records"],
              fetcher: async () => {
                const { data } = await api.get("/api/v1/external/health-records");
                return data;
              },
            });
            const records = extractHealthRecords(data);
            const assessments = records
              .filter((item) => String(item?.patient_id || item?.id || "") === String(pid))
              .map(normalizeAssessment);

            const sorted = [...assessments].sort(
              (a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0)
            );

            setAssessmentHistory(sorted);
            setLatestAssessment(sorted[0] || null);
            setLastUpdatedAt(sorted[0]?.createdAt || sorted[0]?.timestamp || null);
          } catch (err) {
            if (err?.response?.status === 404) {
              setAssessmentHistory([]);
              setLatestAssessment(null);
              setLastUpdatedAt(null);
            } else {
              throw err;
            }
          }
        } else {
          setAssessmentHistory([]);
          setLatestAssessment(null);
          setLastUpdatedAt(null);
        }

        return;
      }

      setPatient(null);
      setResolvedPatientId(null);
      setAssessmentHistory([]);
      setLatestAssessment(null);
      setLastUpdatedAt(null);

      if (meResponse?.multipleMatches) {
        setLinkInfo({
          type: "multiple",
          message:
            "Multiple PMS profiles matched your name. Please contact support to link the correct patient profile.",
        });
      } else {
        setLinkInfo({
          type: "none",
          message: "No PMS patient record linked yet.",
        });
      }
    } catch (err) {
      console.error("Patient dashboard load error:", err);
      setDashboardError(err.response?.data?.message || "Something went wrong. Please try again.");
      setPatient(null);
      setResolvedPatientId(null);
      setAssessmentHistory([]);
      setLatestAssessment(null);
      setLastUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const runAssessment = async () => {
    if (runningAssessment) return;
    const pid = resolvedPatientId || user?.patient_id;
    if (!pid) {
      setAssessmentError("Unable to run assessment. Missing patient information.");
      return;
    }

    setRunningAssessment(true);
    setAssessmentError("");

    try {
      const { data } = await api.post("/risk-assessment", { patient_id: pid });

      setLatestAssessment((prev) => ({
        ...(prev || {}),
        risk_score: data?.risk_score ?? prev?.risk_score ?? 0,
        risk_level: data?.risk_level ?? prev?.risk_level ?? null,
        recommendations: Array.isArray(data?.recommendations)
          ? data.recommendations
          : Array.isArray(prev?.recommendations)
          ? prev.recommendations
          : [],
        confidence: data?.confidence ?? prev?.confidence,
        createdAt: data?.timestamp || new Date().toISOString(),
        timestamp: data?.timestamp || new Date().toISOString(),
      }));

      setLastUpdatedAt(data?.timestamp || new Date().toISOString());

      try {
        const { data: recordsData } = await fetchWithCache({
          key: ["health-records"],
          force: true,
          fetcher: async () => {
            const { data } = await api.get("/api/v1/external/health-records");
            return data;
          },
        });
        const records = extractHealthRecords(recordsData);
        const assessments = records
          .filter((item) => String(item?.patient_id || item?.id || "") === String(pid))
          .map(normalizeAssessment);

        const sorted = [...assessments].sort(
          (a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0)
        );

        setAssessmentHistory(sorted);
        setLatestAssessment(sorted[0] || null);
        setLastUpdatedAt(sorted[0]?.createdAt || sorted[0]?.timestamp || data?.timestamp || new Date().toISOString());
      } catch (err) {
        if (err?.response?.status === 404) {
          setAssessmentHistory([]);
          setLatestAssessment(null);
          setLastUpdatedAt(null);
        } else {
          throw err;
        }
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setAssessmentError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setRunningAssessment(false);
    }
  };

  const hasAssessment = Boolean(latestAssessment);
  const previousAssessment = assessmentHistory.length >= 2 ? assessmentHistory[1] : null;
  const previousScore =
    previousAssessment && Number.isFinite(Number(previousAssessment?.risk_score))
      ? Number(previousAssessment.risk_score)
      : null;
  const currentScore =
    hasAssessment && Number.isFinite(Number(latestAssessment?.risk_score))
      ? Number(latestAssessment.risk_score)
      : null;
  const comparisonDelta =
    previousScore !== null && currentScore !== null ? currentScore - previousScore : null;

  const score = currentScore;
  const level = hasAssessment ? latestAssessment?.risk_level || null : null;
  const status = hasAssessment ? statusFromLevel(level) : "No assessment yet";
  const greeting = `${timeGreeting()}, ${patient?.name?.split(" ")[0] || "Patient"}`;

  const hasVitals = useMemo(() => {
    const v = patient?.vitals || {};
    return Boolean(v.blood_pressure || v.heart_rate || v.blood_glucose);
  }, [patient]);

  const vitals = useMemo(() => {
    const v = patient?.vitals || {};
    return [
      { key: "bp", icon: Activity, label: "Blood Pressure", value: v.blood_pressure || "No recent record", tone: "#6caeb0" },
      { key: "hr", icon: Activity, label: "Heart Rate", value: v.heart_rate ? `${v.heart_rate} bpm` : "No recent record", tone: "#74b7c1" },
      { key: "bg", icon: Activity, label: "Blood Sugar", value: v.blood_glucose ? `${v.blood_glucose} mg/dL` : "No recent record", tone: "#7fc7bb" },
    ];
  }, [patient]);

  const scoreInsights = useMemo(() => {
    if (!hasAssessment) {
      return {
        reasons: ["No assessment yet. Your score details will appear after your first assessment."],
        improvements: ["Start your first assessment to get personalized guidance."],
        mainFactor: null,
      };
    }

    const reasons = [];
    const improvements = [];

    const bpValue = String(patient?.vitals?.blood_pressure || "");
    const bpTop = Number(bpValue.split("/")[0]);
    if (!Number.isNaN(bpTop) && bpTop >= 130) {
      reasons.push("Blood pressure is slightly elevated.");
      improvements.push("Reduce salty foods and check blood pressure this week.");
    }

    const sugarValue = Number(patient?.vitals?.blood_glucose);
    if (!Number.isNaN(sugarValue) && sugarValue >= 126) {
      reasons.push("Blood sugar is above the usual range.");
      improvements.push("Monitor blood sugar regularly and avoid sugary drinks.");
    }

    const hrValue = Number(patient?.vitals?.heart_rate);
    if (!Number.isNaN(hrValue) && hrValue > 100) {
      reasons.push("Heart rate has been a bit higher than expected.");
      improvements.push("Take short rest breaks and stay hydrated.");
    }

    if (level === "High" || level === "Critical") reasons.push("Recent risk markers suggest higher short-term risk.");
    else if (level === "Moderate") reasons.push("Some health markers need closer attention.");
    else if (level === "Low") reasons.push("Most of your recent markers are in a safer range.");

    const recSource = Array.isArray(latestAssessment?.recommendations) ? latestAssessment.recommendations : [];
    if (recSource.some((r) => /alcohol/i.test(r))) {
      reasons.push("Lifestyle habits may be increasing your risk.");
      improvements.push("Reduce alcohol intake this week.");
    }
    if (recSource.some((r) => /exercise|activity|walk/i.test(r))) improvements.push("Walk 15 minutes daily.");
    if (recSource.some((r) => /sugar|glucose/i.test(r))) improvements.push("Track your meals and reduce sugar portions.");

    if (reasons.length === 0) reasons.push("A few recent readings were outside your healthy target.");
    if (improvements.length === 0) improvements.push("Walk 15 minutes daily.", "Keep taking medication as advised.");

    const cleanReasons = [...new Set(reasons)].slice(0, 4);
    const cleanImprovements = [...new Set(improvements)].slice(0, 3);

    return { reasons: cleanReasons, improvements: cleanImprovements, mainFactor: cleanReasons[0] || null };
  }, [hasAssessment, latestAssessment, patient, level]);

  const pendingAppointment = useMemo(
    () =>
      appointments
        .filter((a) => a?.status === "pending")
        .sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0))
        .at(-1) || null,
    [appointments]
  );

  const confirmedAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a?.status === "confirmed")
        .sort((a, b) => new Date(a?.scheduledDate || 0) - new Date(b?.scheduledDate || 0)),
    [appointments]
  );

  const tomorrowReminder = useMemo(() => {
    if (!confirmedAppointments.length) return null;
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    return (
      confirmedAppointments.find((a) => {
        const dt = new Date(a?.scheduledDate);
        return (
          dt.getFullYear() === tomorrow.getFullYear() &&
          dt.getMonth() === tomorrow.getMonth() &&
          dt.getDate() === tomorrow.getDate()
        );
      }) || null
    );
  }, [confirmedAppointments]);

  const updatedLabel = (() => {
    if (!lastUpdatedAt) return null;
    const dt = new Date(lastUpdatedAt);
    if (Number.isNaN(dt.getTime())) return null;
    const diffMs = Date.now() - dt.getTime();
    if (diffMs < 2 * 60 * 1000) return "Updated just now";
    return `Updated ${dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <main className="dashboard-main" style={{ padding: "1rem 1.15rem" }}>
          <div className="hero-card">Loading your dashboard...</div>
        </main>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <main className="dashboard-main" style={{ padding: "1rem 1.15rem" }}>
          <div className="hero-card">{dashboardError}</div>
        </main>
      </div>
    );
  }

  if (!patient) {
    return (
      <NotLinkedState
        title={linkInfo?.type === "multiple" ? "Multiple profiles found" : "You're not connected yet"}
        description={linkInfo?.message || "Start assessment to create your profile"}
        primaryText={runningAssessment ? "Analyzing your health..." : "Start assessment to create your profile"}
        onPrimary={runAssessment}
      />
    );
  }

  if (!hasAssessment) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <main
          className="dashboard-main"
          style={{ padding: "1rem 1.15rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}
        >
          <section
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #e5edf3",
              boxShadow: "0 2px 10px rgba(10,40,70,0.04)",
              padding: "0.95rem",
              marginBottom: "0.85rem",
              transition: "box-shadow 180ms ease, border-color 180ms ease",
            }}
          >
            <div style={{ fontSize: "0.95rem", color: "#355069", marginBottom: "0.3rem" }}>{greeting}</div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "#1e3a56",
                marginBottom: "0.15rem",
                fontFamily: "Lora, serif",
              }}
            >
              Your Health Score
            </div>
            <div style={{ fontSize: "0.86rem", color: "#5f7488", marginBottom: "0.75rem" }}>
              {heroMessage(level, hasAssessment)}
            </div>

            <EmptyState
              compact
              title="No progress yet"
              description="Start assessment to create your profile"
              ctaText={runningAssessment ? "Analyzing your health..." : "Start assessment to create your profile"}
              onCta={runAssessment}
            />
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <style>
        {`
          @keyframes scorePulseIn {
            0% { opacity: 0.92; transform: scale(1.02); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>

      <Sidebar />
      <main
        className="dashboard-main"
        style={{ padding: "1rem 1.15rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}
      >
        <section
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e5edf3",
            boxShadow: "0 2px 10px rgba(10,40,70,0.04)",
            padding: "0.95rem",
            marginBottom: "0.85rem",
            transition: "box-shadow 180ms ease, border-color 180ms ease",
          }}
        >
          <div style={{ fontSize: "0.95rem", color: "#355069", marginBottom: "0.3rem" }}>{greeting}</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1e3a56", marginBottom: "0.15rem", fontFamily: "Lora, serif" }}>
            Your Health Score
          </div>
          <div style={{ fontSize: "0.86rem", color: "#5f7488", marginBottom: "0.75rem" }}>{heroMessage(level, hasAssessment)}</div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 330px) 1fr", gap: "0.75rem", alignItems: "start" }}>
            <div
              style={{
                background: "#f8fbfd",
                border: "1px solid #dce9f2",
                borderRadius: "12px",
                padding: "0.85rem",
                animation: showSuccess ? "scorePulseIn 220ms ease-out" : "none",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#5f7488", marginBottom: "0.28rem", fontWeight: 600 }}>
                Your latest assessment result
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color: "#1f4f73" }}>{hasAssessment ? score : "--"}</div>

              <div
                style={{
                  marginTop: "0.52rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  borderRadius: "999px",
                  padding: "0.2rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: status === "Good" ? "#e8f6ef" : hasAssessment ? "#fff3ea" : "#ecf4fb",
                  color: status === "Good" ? "#1d7a4f" : hasAssessment ? "#a45b22" : "#335d7a",
                }}
              >
                {status}
              </div>

              {showSuccess && (
                <div
                  style={{
                    marginTop: "0.45rem",
                    fontSize: "0.76rem",
                    color: "#166534",
                    background: "#ecfdf3",
                    border: "1px solid #ccebd8",
                    borderRadius: "8px",
                    padding: "0.28rem 0.45rem",
                  }}
                >
                  Your health score has been updated
                </div>
              )}

              <div style={{ fontSize: "0.79rem", color: "#5f7488", marginTop: "0.55rem" }}>
                {updatedLabel ||
                  (hasAssessment
                    ? `You completed your last assessment on ${displayDate(latestAssessment?.createdAt || latestAssessment?.timestamp)}.`
                    : "You haven’t taken your assessment yet.")}
              </div>

              {hasAssessment && previousScore !== null && (
                <div style={{ marginTop: "0.4rem", fontSize: "0.77rem", color: "#48657a" }}>
                  Previous: {previousScore} → Now: {currentScore}
                  <span style={{ marginLeft: "0.35rem", fontWeight: 700, color: "#2f5f7f" }}>
                    {comparisonDelta > 0 ? "↑ improving" : comparisonDelta < 0 ? "↓ needs attention" : "→ no change"}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={runAssessment}
                disabled={runningAssessment}
                style={{
                  marginTop: "0.72rem",
                  border: "none",
                  background: hasAssessment ? "#2b6b8d" : "#1f5c84",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "0.44rem 0.84rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: runningAssessment ? "not-allowed" : "pointer",
                  opacity: runningAssessment ? 0.75 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                {runningAssessment ? "Analyzing your health..." : hasAssessment ? "Run New Assessment" : "Start Assessment"}
                <ArrowRight size={14} />
              </button>

              {assessmentError && (
                <div
                  style={{
                    marginTop: "0.45rem",
                    fontSize: "0.76rem",
                    color: "#b42318",
                    background: "#fff4f2",
                    border: "1px solid #ffd6d1",
                    borderRadius: "8px",
                    padding: "0.32rem 0.48rem",
                  }}
                >
                  {assessmentError}
                </div>
              )}
            </div>

            <div style={{ background: "#f9fbfd", border: "1px solid #e3edf4", borderRadius: "12px", overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setShowWhyScore((prev) => !prev)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  padding: "0.8rem 0.9rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: "#2a4963",
                }}
              >
                <span>Why this score?</span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: showWhyScore ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                />
              </button>

              <div
                style={{
                  maxHeight: showWhyScore ? "320px" : "0px",
                  opacity: showWhyScore ? 1 : 0,
                  transition: "max-height 180ms ease, opacity 180ms ease",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    borderTop: "1px solid #e3edf4",
                    padding: showWhyScore ? "0.8rem 0.9rem" : "0 0.9rem",
                    transition: "padding 180ms ease",
                  }}
                >
                  {scoreInsights.mainFactor && (
                    <div
                      style={{
                        marginBottom: "0.65rem",
                        background: "#edf6fb",
                        border: "1px solid #d6e9f4",
                        borderRadius: "10px",
                        padding: "0.5rem 0.65rem",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "#537089", marginBottom: "0.2rem", fontWeight: 600 }}>
                        Main factor
                      </div>
                      <div style={{ fontSize: "0.83rem", color: "#24465f" }}>{scoreInsights.mainFactor}</div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#355069", marginBottom: "0.35rem" }}>
                        What affected your score
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1rem", color: "#516b7f", fontSize: "0.8rem", lineHeight: 1.5 }}>
                        {scoreInsights.reasons.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#355069", marginBottom: "0.35rem" }}>
                        What you can improve
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1rem", color: "#516b7f", fontSize: "0.8rem", lineHeight: 1.5 }}>
                        {scoreInsights.improvements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            border: "1px solid #e5edf3",
            boxShadow: "0 2px 10px rgba(10,40,70,0.04)",
            padding: "0.85rem 0.95rem",
            marginBottom: "0.85rem",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1f3f5a", marginBottom: "0.55rem" }}>
            Upcoming Appointments
          </div>

          {appointmentsLoading ? (
            <div style={{ fontSize: "0.82rem", color: "#5f7488" }}>Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "#6b8093" }}>No appointments yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.45rem" }}>
              {appointments.map((appt) => (
                <div
                  key={appt._id}
                  style={{
                    border: "1px solid #e5edf3",
                    borderRadius: "10px",
                    padding: "0.52rem 0.62rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#fcfeff",
                  }}
                >
                  <div style={{ fontSize: "0.82rem", color: "#2d4b63" }}>
                    {new Date(appt.scheduledDate).toLocaleString("en-PH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <span
                    style={{
                      fontSize: "0.73rem",
                      fontWeight: 700,
                      borderRadius: "999px",
                      padding: "0.2rem 0.55rem",
                      background:
                        appt.status === "confirmed" ? "#e8f6ef" : appt.status === "declined" ? "#fff1f2" : "#eef5fb",
                      color:
                        appt.status === "confirmed" ? "#1d7a4f" : appt.status === "declined" ? "#9f1239" : "#355d7a",
                      textTransform: "capitalize",
                    }}
                  >
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {hasVitals ? (
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.7rem",
              marginBottom: "0.85rem",
            }}
          >
            {vitals.map((v) => (
              <article
                key={v.key}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e4edf4",
                  borderRadius: "12px",
                  padding: "0.8rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.25rem" }}>
                  <v.icon size={14} color={v.tone} />
                  <div style={{ fontSize: "0.8rem", color: "#557086" }}>{v.label}</div>
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#223f57" }}>{v.value}</div>
              </article>
            ))}
          </section>
        ) : (
          <div style={{ marginBottom: "0.85rem" }}>
            <EmptyState compact title="No vitals yet" description="Your health data will appear here once recorded." />
          </div>
        )}
      </main>
    </div>
  );
}
