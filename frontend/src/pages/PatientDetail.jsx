import React, { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import RiskBadge from "../components/RiskBadge";
import ConfidenceBadge from "../components/ConfidenceBadge";
import ResultTabs from "../components/ResultTabs";
import api from "../api/axios";
import { formatDateTime } from "../utils/formatDateTime";
import { fetchWithCache } from "../api/cachedFetch";

const PANEL_KEYS = {
  patientInfo: "patientInfo",
  vitals: "vitals",
  medicalHistory: "medicalHistory",
  familyHistory: "familyHistory",
};

export default function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState("");
  const [expandedPanels, setExpandedPanels] = useState({
    [PANEL_KEYS.patientInfo]: false,
    [PANEL_KEYS.vitals]: false,
    [PANEL_KEYS.medicalHistory]: false,
    [PANEL_KEYS.familyHistory]: false,
  });
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentDateTime, setAppointmentDateTime] = useState("");
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentFeedback, setAppointmentFeedback] = useState({ type: "", message: "" });

  const canRunAssessment = user?.role === "staff" || user?.role === "admin";
  const backPath = user?.role === "admin" ? "/admin-dashboard" : "/patients";

  useEffect(() => {
    console.log("ROUTE PARAM ID:", id);
    if (!id) return;

    const load = async () => {
      try {
        const { data: patientResponse } = await fetchWithCache({
          key: ["patient", id],
          fetcher: async () => {
            const res = await api.get(`/patients/${id}`);
            return res.data;
          },
        });
        console.log("FULL RESPONSE:", patientResponse);

        const payload = patientResponse?.data;

        if (!payload || !payload.patient_id || !payload.name) {
          throw new Error("Invalid response shape");
        }

        setPatient(payload);
      } catch (err) {
        console.error("PATIENT LOAD ERROR:", err);
        setError(err.response?.data?.message || "Failed to load patient");
      } finally {
        setLoading(false);
      }

      try {
        const riskRes = await api.get(`/api/v1/predictive-analysis/risk-assessment/user?id=${id}`);
        const riskData = riskRes?.data?.data || null;

        if (riskData) {
          setAssessment(riskData);
          setHistory([riskData]);
        } else {
          setAssessment(null);
          setHistory([]);
        }
      } catch (err) {
        console.warn("Risk not found or API failed:", err.message);
        setAssessment(null);
        setHistory([]);
      }
    };

    load();
  }, [id]);

  useEffect(() => {
    console.log("PATIENT STATE:", patient);
  }, [patient]);

  const runAssessment = async () => {
    setAssessing(true);
    setError("");
    try {
      const { data } = await api.post("/risk-assessment", { patient_id: id });
      setAssessment(data);

      const { data: h } = await api.get(`/api/v1/predictive-analysis/risk-assessment/user?id=${id}`);
      const list = Array.isArray(h?.data) ? h.data : [];
      const uniqueHistory = Array.from(
        new Map(
          list
            .sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp))
            .map((entry) => [
              `${entry.risk_level}-${entry.risk_score}-${new Date(entry.createdAt || entry.timestamp).toISOString()}`,
              entry,
            ])
        ).values()
      );
      setHistory(uniqueHistory);
    } catch (err) {
      setError(err.response?.data?.message || "Assessment failed");
    } finally {
      setAssessing(false);
    }
  };

  const initials = useMemo(() => {
    const name = patient?.name || "";
    return (
      name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "PT"
    );
  }, [patient?.name]);

  const displayedRecommendations = useMemo(() => {
    const list = Array.isArray(assessment?.recommendations) ? assessment.recommendations : [];
    if (showAllRecommendations) return list;
    return list.slice(0, 3);
  }, [assessment?.recommendations, showAllRecommendations]);

  const hasMoreRecommendations = (assessment?.recommendations?.length || 0) > 3;

  const togglePanel = (key) => {
    setExpandedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const requestAppointment = async () => {
    if (!appointmentDateTime || appointmentLoading) return;

    setAppointmentLoading(true);
    setAppointmentFeedback({ type: "", message: "" });

    try {
      await api.post("/api/v1/appointments/request", {
        patientId: id,
        scheduledDate: new Date(appointmentDateTime).toISOString(),
      });
      setAppointmentFeedback({ type: "success", message: "Request sent" });
      setTimeout(() => {
        setShowAppointmentModal(false);
        setAppointmentDateTime("");
      }, 700);
    } catch (err) {
      setAppointmentFeedback({
        type: "error",
        message: err.response?.data?.message || "Failed to request appointment",
      });
    } finally {
      setAppointmentLoading(false);
    }
  };

  const score = Number(assessment?.risk_score || 0);
  const gaugeColor = getScoreColor(score);
  const gaugeTrack = `conic-gradient(${gaugeColor} ${Math.min(score, 100) * 3.6}deg, #eef2f7 0deg)`;

  if (loading) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={styles.centerSub}>Loading patient assessment...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <div style={styles.center}>
          <p style={styles.centerSub}>Loading patient...</p>
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <div style={styles.center}>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.backBtn} onClick={() => navigate(backPath)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <Sidebar />

      <main style={styles.main}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => navigate(backPath)}>
            ← Back
          </button>

          <div style={styles.identity}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <h1 style={styles.pageTitle}>{patient?.name ?? "No Name"}</h1>
              <p style={styles.pageSubtitle}>
                {patient?.patient_id} · {patient?.age}y · {patient?.gender} · {patient?.blood_type}
              </p>
            </div>
          </div>

          {canRunAssessment && (
            <div style={styles.headerActions}>
              <button
                style={{ ...styles.ghostActionBtn }}
                onClick={() => {
                  setAppointmentFeedback({ type: "", message: "" });
                  setShowAppointmentModal(true);
                }}
              >
                Request Appointment
              </button>
              <button
                style={{ ...styles.assessBtn, opacity: assessing ? 0.75 : 1 }}
                onClick={runAssessment}
                disabled={assessing}
              >
                {assessing ? "Assessing..." : "Run Assessment"}
              </button>
            </div>
          )}
        </header>

        {error && <div style={styles.errorBar}>{error}</div>}

        {assessment ? (
          <div style={styles.content}>
            <section style={styles.summaryCard}>
              <div style={styles.gaugeBox}>
                <div style={{ ...styles.gauge, background: gaugeTrack }}>
                  <div style={styles.gaugeInner}>
                    <span style={{ ...styles.gaugeValue, color: gaugeColor }}>{score}</span>
                    <span style={styles.gaugeTotal}>/100</span>
                  </div>
                </div>
                <p style={styles.gaugeLabel}>Risk Score</p>
              </div>

              <div style={styles.summaryMeta}>
                <div style={styles.summaryBadges}>
                  <RiskBadge level={assessment.risk_level} large />
                  <ConfidenceBadge level={assessment.confidence} />
                </div>

                <p style={styles.timestamp}>
                  <span style={styles.timestampLabel}>Last assessed:</span>{" "}
                  {new Date(assessment.timestamp || assessment.createdAt).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {history.length > 1 && (
                  <div style={styles.historyBlock}>
                    <p style={styles.historyTitle}>Recent Assessment History</p>
                    <div style={styles.historyInline}>
                      {history.slice(0, 3).map((entry) => (
                        <div key={entry._id || `${entry.createdAt}-${entry.risk_score}`} style={styles.historyItem}>
                          <span style={styles.historyLevel}>{entry.risk_level}</span>
                          <span style={styles.historyScore}>{entry.risk_score}/100</span>
                          <span style={styles.historyDate}>
                            {new Date(entry.createdAt || entry.timestamp).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div style={styles.mainGrid}>
              <section style={styles.leftColumn}>
                <CollapsibleCard
                  title="Patient Info"
                  expanded={expandedPanels[PANEL_KEYS.patientInfo]}
                  onToggle={() => togglePanel(PANEL_KEYS.patientInfo)}
                >
                  <InfoList
                    rows={[
                      ["Address", patient?.address || "N/A"],
                      ["Contact", patient?.contact || "N/A"],
                      [
                        "Last Checkup",
                        patient?.last_checkup
                          ? new Date(patient.last_checkup).toLocaleDateString("en-PH", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "N/A",
                      ],
                      ["Last Visit", formatDateTime(patient?.last_visit_date, "N/A")],
                      ["Attending Physician", patient?.attending_physician || "N/A"],
                      ["Medications", patient?.current_medications?.join(", ") || "None"],
                    ]}
                  />
                </CollapsibleCard>

                <CollapsibleCard
                  title="Vitals"
                  expanded={expandedPanels[PANEL_KEYS.vitals]}
                  onToggle={() => togglePanel(PANEL_KEYS.vitals)}
                >
                  <ChipGrid
                    data={patient?.vitals}
                    positiveLabel="Value"
                    negativeLabel="N/A"
                    positiveTone="neutral"
                    negativeTone="neutral"
                    formatter={formatKey}
                  />
                </CollapsibleCard>

                <CollapsibleCard
                  title="Medical History"
                  expanded={expandedPanels[PANEL_KEYS.medicalHistory]}
                  onToggle={() => togglePanel(PANEL_KEYS.medicalHistory)}
                >
                  {Array.isArray(patient?.patient_record) && patient.patient_record.length > 0 ? (
                    <ul style={styles.previewList}>
                      {patient.patient_record.map((item, index) => (
                        <li key={`${item}-${index}`} style={styles.previewItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ChipGrid
                      data={patient?.medical_history}
                      positiveLabel="Yes"
                      negativeLabel="No"
                      positiveTone="warm"
                      negativeTone="cool"
                      formatter={formatKey}
                    />
                  )}
                </CollapsibleCard>

                <CollapsibleCard
                  title="Family History"
                  expanded={expandedPanels[PANEL_KEYS.familyHistory]}
                  onToggle={() => togglePanel(PANEL_KEYS.familyHistory)}
                >
                  <ChipGrid
                    data={patient?.family_history}
                    positiveLabel="Risk"
                    negativeLabel="None"
                    positiveTone="warm"
                    negativeTone="cool"
                    formatter={formatKey}
                  />
                </CollapsibleCard>
              </section>

              <section style={styles.rightColumn}>
                <div style={styles.recommendationPreview}>
                  <div style={styles.previewHeader}>
                    <h2 style={styles.previewTitle}>Key Recommendations</h2>
                    {hasMoreRecommendations && (
                      <button
                        style={styles.viewAllBtn}
                        onClick={() => setShowAllRecommendations((prev) => !prev)}
                      >
                        {showAllRecommendations ? "Show less" : "View all"}
                      </button>
                    )}
                  </div>

                  <ul style={styles.previewList}>
                    {displayedRecommendations.map((item, index) => (
                      <li key={`${index}-${item}`} style={styles.previewItem}>
                        {index + 1}. {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <ResultTabs data={assessment} />
              </section>
            </div>
          </div>
        ) : (
          <div style={styles.noAssessment}>
            <div style={styles.noAssessmentIcon}>
              <Activity size={34} />
            </div>
            <h2 style={styles.noAssessmentTitle}>No Assessment Yet</h2>
            <p style={styles.noAssessmentSub}>
              {canRunAssessment
                ? "Run an assessment to generate risk score, confidence, and care recommendations."
                : "Your care team has not generated an assessment yet."}
            </p>
            {canRunAssessment && (
              <button style={styles.assessBtn} onClick={runAssessment} disabled={assessing}>
                {assessing ? "Assessing..." : "Run Assessment"}
              </button>
            )}
          </div>
        )}
        {showAppointmentModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <h3 style={styles.modalTitle}>Request Appointment</h3>
              <p style={styles.modalSub}>Select a preferred date and time for this patient.</p>

              <input
                type="datetime-local"
                value={appointmentDateTime}
                onChange={(e) => setAppointmentDateTime(e.target.value)}
                style={styles.dateInput}
                disabled={appointmentLoading}
              />

              {appointmentFeedback.message && (
                <div
                  style={
                    appointmentFeedback.type === "success" ? styles.successNotice : styles.errorNotice
                  }
                >
                  {appointmentFeedback.message}
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  style={styles.modalCancelBtn}
                  onClick={() => {
                    if (appointmentLoading) return;
                    setShowAppointmentModal(false);
                    setAppointmentFeedback({ type: "", message: "" });
                  }}
                  disabled={appointmentLoading}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...styles.modalConfirmBtn,
                    opacity: appointmentLoading || !appointmentDateTime ? 0.7 : 1,
                    cursor: appointmentLoading || !appointmentDateTime ? "not-allowed" : "pointer",
                  }}
                  onClick={requestAppointment}
                  disabled={appointmentLoading || !appointmentDateTime}
                >
                  {appointmentLoading ? "Processing..." : "Confirm Request"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CollapsibleCard({ title, expanded, onToggle, children }) {
  return (
    <div style={styles.collapseCard}>
      <button style={styles.collapseHeader} onClick={onToggle}>
        <span style={styles.collapseTitle}>{title}</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {expanded && <div style={styles.collapseBody}>{children}</div>}
    </div>
  );
}

function InfoList({ rows }) {
  return (
    <div style={styles.infoList}>
      {rows.map(([label, value]) => (
        <div key={label} style={styles.infoRow}>
          <span style={styles.infoLabel}>{label}</span>
          <span style={styles.infoValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function ChipGrid({
  data,
  positiveLabel,
  negativeLabel,
  positiveTone = "neutral",
  negativeTone = "neutral",
  formatter = (value) => value,
}) {
  const entries = data ? Object.entries(data) : [];

  if (entries.length === 0) {
    return <p style={styles.emptyText}>No data available.</p>;
  }

  return (
    <div style={styles.chipGrid}>
      {entries.map(([key, rawValue]) => {
        const isBoolean = typeof rawValue === "boolean";
        const positive = isBoolean ? rawValue : rawValue !== null && rawValue !== undefined && String(rawValue) !== "";
        const tone = positive ? positiveTone : negativeTone;
        const valueLabel = isBoolean ? (positive ? positiveLabel : negativeLabel) : String(rawValue);

        return (
          <div key={key} style={{ ...styles.dataChip, ...toneStyle(tone) }}>
            <span style={styles.dataChipKey}>{formatter(key)}</span>
            <span style={styles.dataChipValue}>{valueLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function toneStyle(tone) {
  if (tone === "warm") {
    return { background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" };
  }
  if (tone === "cool") {
    return { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b" };
  }
  return { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" };
}

function getScoreColor(score) {
  if (score >= 70) return "#dc2626";
  if (score >= 50) return "#d97706";
  if (score >= 30) return "#ca8a04";
  return "#16a34a";
}

function formatKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#f7fbfd" },
  main: {
    flex: 1,
    padding: "18px 22px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "14px",
    padding: "12px 14px",
  },
  backBtn: {
    border: "1px solid #dbe7ee",
    background: "#ffffff",
    color: "#64748b",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 700,
    padding: "8px 12px",
  },
  identity: { display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "230px" },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "999px",
    background: "#eef9fb",
    color: "#1696a7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
  },
  pageTitle: { margin: 0, fontSize: "20px", color: "#123447" },
  pageSubtitle: { marginTop: "2px", color: "#6b8799", fontSize: "12px" },
  headerActions: { display: "inline-flex", alignItems: "center", gap: "8px" },
  assessBtn: {
    border: "none",
    borderRadius: "10px",
    background: "#1ea7b8",
    color: "white",
    fontSize: "12px",
    fontWeight: 700,
    padding: "9px 14px",
    transition: "opacity 180ms ease, transform 180ms ease",
  },
  ghostActionBtn: {
    border: "1px solid #d4e7ef",
    borderRadius: "10px",
    background: "#f8fcfe",
    color: "#24526b",
    fontSize: "12px",
    fontWeight: 700,
    padding: "9px 12px",
    boxShadow: "0 2px 8px rgba(21, 68, 97, 0.06)",
    transition: "all 180ms ease",
  },
  errorBar: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: "10px",
    color: "#be123c",
    fontSize: "12px",
    padding: "8px 12px",
  },
  content: { display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "14px",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: "16px",
    alignItems: "center",
  },
  gaugeBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
  gauge: {
    width: "96px",
    height: "96px",
    borderRadius: "50%",
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeInner: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
  },
  gaugeValue: { fontSize: "24px", lineHeight: 1, fontWeight: 800 },
  gaugeTotal: { fontSize: "10px", color: "#6b8799", fontWeight: 700 },
  gaugeLabel: { color: "#5f7685", fontSize: "12px", fontWeight: 700 },
  summaryMeta: { display: "flex", flexDirection: "column", gap: "10px" },
  summaryBadges: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  timestamp: { color: "#3f5666", fontSize: "12px" },
  timestampLabel: { color: "#6b8799", fontWeight: 700 },
  historyBlock: {
    marginTop: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  historyTitle: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 700,
    color: "#6b8799",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  historyInline: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "#f8fcfe",
    border: "1px solid #e5f0f5",
    borderRadius: "10px",
    padding: "8px",
    maxWidth: "360px",
  },
  historyItem: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px", fontSize: "11px" },
  historyLevel: { color: "#123447", fontWeight: 700 },
  historyScore: { color: "#0f766e", fontWeight: 700 },
  historyDate: { color: "#6b8799" },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 380px) 1fr",
    gap: "12px",
    minHeight: 0,
  },
  leftColumn: { display: "flex", flexDirection: "column", gap: "10px" },
  rightColumn: { display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 },
  collapseCard: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "12px",
    overflow: "hidden",
  },
  collapseHeader: {
    width: "100%",
    border: "none",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 12px",
    color: "#274355",
    fontWeight: 700,
    fontSize: "13px",
  },
  collapseTitle: { display: "inline-flex", alignItems: "center", gap: "6px" },
  collapseBody: { borderTop: "1px solid #edf3f7", padding: "10px" },
  infoList: { display: "flex", flexDirection: "column", gap: "8px" },
  infoRow: { display: "flex", flexDirection: "column", gap: "2px" },
  infoLabel: { color: "#6b8799", fontSize: "10px", textTransform: "uppercase", fontWeight: 700 },
  infoValue: { color: "#1f3543", fontSize: "12px", fontWeight: 600 },
  chipGrid: { display: "flex", flexWrap: "wrap", gap: "6px" },
  dataChip: {
    borderRadius: "8px",
    padding: "6px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: "108px",
  },
  dataChipKey: { fontSize: "10px", fontWeight: 700 },
  dataChipValue: { fontSize: "11px", fontWeight: 700 },
  emptyText: { color: "#94a3b8", fontSize: "12px" },
  recommendationPreview: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "12px",
    padding: "12px",
  },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
  previewTitle: { margin: 0, fontSize: "15px", color: "#17384c" },
  viewAllBtn: {
    border: "none",
    background: "transparent",
    color: "#1ea7b8",
    fontSize: "12px",
    fontWeight: 700,
    padding: 0,
  },
  previewList: { margin: "8px 0 0 16px", display: "flex", flexDirection: "column", gap: "6px" },
  previewItem: { color: "#2d4a5b", fontSize: "12px", lineHeight: 1.5 },
  noAssessment: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "14px",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "10px",
  },
  noAssessmentIcon: {
    width: "68px",
    height: "68px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eaf7fb",
    color: "#1ea7b8",
  },
  noAssessmentTitle: { margin: 0, fontSize: "20px", color: "#17384c" },
  noAssessmentSub: { color: "#5f7685", fontSize: "13px", maxWidth: "360px", lineHeight: 1.55 },
  center: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" },
  spinner: {
    width: "34px",
    height: "34px",
    border: "3px solid #dbe7ee",
    borderTop: "3px solid #1ea7b8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  centerSub: { marginTop: "10px", color: "#6b8799", fontSize: "12px" },
  errorText: { color: "#be123c", marginBottom: "10px" },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(10, 28, 43, 0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    padding: "16px",
  },
  modalCard: {
    width: "100%",
    maxWidth: "430px",
    background: "#ffffff",
    border: "1px solid #e2edf3",
    borderRadius: "16px",
    boxShadow: "0 18px 48px rgba(18, 49, 71, 0.16)",
    padding: "16px",
  },
  modalTitle: { margin: 0, fontSize: "18px", color: "#15384e" },
  modalSub: { margin: "6px 0 12px", fontSize: "13px", color: "#5f7685" },
  dateInput: {
    width: "100%",
    border: "1px solid #d8e6ef",
    borderRadius: "10px",
    padding: "10px 12px",
    fontSize: "13px",
    color: "#1f3543",
    background: "#fbfdff",
    outline: "none",
  },
  successNotice: {
    marginTop: "10px",
    background: "#ecfdf3",
    border: "1px solid #b7ebd0",
    color: "#166534",
    borderRadius: "9px",
    fontSize: "12px",
    padding: "8px 10px",
  },
  errorNotice: {
    marginTop: "10px",
    background: "#fff4f2",
    border: "1px solid #ffd8d2",
    color: "#b42318",
    borderRadius: "9px",
    fontSize: "12px",
    padding: "8px 10px",
  },
  modalActions: {
    marginTop: "14px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  modalCancelBtn: {
    border: "1px solid #d9e7ef",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#5e7688",
    fontSize: "12px",
    fontWeight: 700,
    padding: "8px 12px",
    cursor: "pointer",
  },
  modalConfirmBtn: {
    border: "none",
    borderRadius: "10px",
    background: "#1f6b93",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 700,
    padding: "8px 12px",
    boxShadow: "0 4px 14px rgba(22, 96, 135, 0.2)",
    transition: "opacity 180ms ease",
  },
};
