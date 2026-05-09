import React, { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, Minus, AlertCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import NotLinkedState from "../components/NotLinkedState";
import RiskBadge from "../components/RiskBadge";
import { fetchWithCache } from "../api/cachedFetch";
import { normalizeAssessment } from "../utils/normalizeAssessment";
import "./PatientDashboard.css";

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getHealthScore(riskScore) {
  if (!Number.isFinite(Number(riskScore))) return null;
  return Math.max(0, Math.min(100, 100 - Number(riskScore)));
}

/**
 * Interpretative summary based on REAL historical data only.
 * No fake trend generation - only based on actual assessments.
 */
function getTrendSummary(latest, previous) {
  if (!latest || !previous) {
    return {
      title: "Not enough data",
      subtitle: "Complete one more assessment to see your progress.",
      status: null,
      icon: null,
    };
  }

  const latestScore = getHealthScore(latest.risk_score);
  const previousScore = getHealthScore(previous.risk_score);
  const delta = latestScore - previousScore;

  if (delta > 3) {
    return {
      title: "You're improving",
      subtitle: "Your health score has improved since your last assessment.",
      status: `+${Math.round(delta)} points`,
      icon: "improving",
    };
  }

  if (delta < -3) {
    return {
      title: "Your attention is needed",
      subtitle: "Your health score has declined. Review recommendations and take action.",
      status: `${Math.round(delta)} points`,
      icon: "declining",
    };
  }

  return {
    title: "You're stable",
    subtitle: "Your health score remains stable. Continue your current routines.",
    status: "Stable",
    icon: "stable",
  };
}

export default function MyProgress() {
  const { user, syncUser } = useAuth();
  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;

        const { data: meResponse } = await fetchWithCache({
          key: ["patients-me", user?._id || user?.email || "current"],
          fetcher: async () => {
            const { data } = await api.get("/patients/me");
            return data;
          },
        });

        if (meResponse?.user?.id && meResponse.user.patient_id !== user?.patient_id) {
          syncUser(meResponse.user);
        }

        if (!(meResponse?.linked && meResponse?.data)) {
          setPatient(null);
          setAssessments([]);

          if (meResponse?.multipleMatches) {
            setLinkInfo({
              type: "multiple",
              message: "Multiple PMS profiles matched your name. Please contact support to link the correct patient profile.",
            });
          } else {
            setLinkInfo({
              type: "none",
              message: "No PMS patient record linked yet.",
            });
          }
          return;
        }

        setLinkInfo(null);
        const resolvedPatient = meResponse.data;
        setPatient(resolvedPatient);

        const resolvedPatientId = resolvedPatient.id || resolvedPatient.patient_id || user?.patient_id || null;
        if (!resolvedPatientId) {
          setAssessments([]);
          return;
        }

        try {
          const { data } = await fetchWithCache({
            key: ["assessment-history", resolvedPatientId],
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

          setAssessments(normalizedReal);
        } catch (err) {
          if (err?.response?.status === 404) {
            setAssessments([]);
          } else {
            throw err;
          }
        }
      } catch (err) {
        console.error("MyProgress load error:", err);
        setLoadError(err?.response?.data?.message || "Something went wrong. Please try again.");
        setAssessments([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, syncUser]);

  const recentAssessments = useMemo(() => assessments.slice(0, 5), [assessments]);
  const latest = recentAssessments[0] || null;
  const previous = recentAssessments[1] || null;
  const trend = useMemo(() => getTrendSummary(latest, previous), [latest, previous]);

  if (loading) {
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

  if (loadError) {
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

  if (!patient) {
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
              {/* Trend Summary */}
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

              {/* Latest Assessment & History */}
              <div className="patient-health-grid">
                {/* Latest Assessment */}
                <section className="patient-health-card">
                  <div style={{ display: "grid", gap: "8px" }}>
                    <p style={{ margin: 0, color: "#668194", fontSize: "12px", fontWeight: 800, textTransform: "uppercase" }}>
                      Latest Assessment
                    </p>
                    <h3 style={{ margin: 0, color: "#17384c", fontSize: "20px", fontFamily: "Lora, serif", fontWeight: 600 }}>
                      {Math.round(getHealthScore(latest.risk_score))}
                    </h3>
                    <p style={{ margin: 0, color: "#708899", fontSize: "12px" }}>
                      Health Score
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px" }}>
                    <RiskBadge level={latest.risk_level} />
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

                  {latest.recommendations && latest.recommendations.length > 0 && (
                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #e6eef3" }}>
                      <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 800, color: "#668194", textTransform: "uppercase" }}>
                        Top Recommendation
                      </p>
                      <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "#2f556d", fontWeight: 600 }}>
                        {latest.recommendations[0]}
                      </p>
                    </div>
                  )}
                </section>

                {/* History List */}
                <section className="patient-health-card">
                  <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 800, color: "#668194", textTransform: "uppercase" }}>
                    Assessment History
                  </p>
                  <div style={{ display: "grid", gap: "0" }}>
                    {recentAssessments.map((assessment, idx) => (
                      <div
                        key={idx}
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
                        </span>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#17384c" }}>
                            {Math.round(getHealthScore(assessment.risk_score))}
                          </span>
                          <RiskBadge level={assessment.risk_level} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Understanding Progress */}
              <section className="patient-health-card">
                <div style={{ display: "grid", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "#668194", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertCircle size={14} /> Understanding Your Progress
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "#526f82" }}>
                    Your health score is calculated based on your medical history, lifestyle factors, and recent vitals. A score
                    closer to 100 indicates better overall health. Focus on the recommendations from your latest assessment to
                    continue improving your health.
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
