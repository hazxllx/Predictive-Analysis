/**
 * Patient Detail Page
 *
 * Displays a comprehensive patient profile with:
 * - Risk score and breakdown
 * - Assessment history
 * - Vitals and lifestyle summary
 * - Ability to run a new assessment
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Cigarette,
  HeartPulse,
  Stethoscope,
  Utensils,
  Wine,
  Zap,
} from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/Sidebar";
import RiskBadge from "../components/RiskBadge";
import ConfidenceBadge from "../components/ConfidenceBadge";
import ResultTabs from "../components/ResultTabs";
import RadialHealthScore from "../components/RadialHealthScore";
import api from "../api/axios";
import { formatDateTime } from "../utils/formatDateTime";
import { fetchWithCache } from "../api/cachedFetch";
import { invalidateCachedQuery, setCachedQuery } from "../api/queryCache";
import { normalizePatient, normalizePatientResponse, cleanText } from "../utils/normalizePatients";
import {
  getAssessmentRiskLevel,
  getAssessmentRiskScore,
  normalizeAssessment,
} from "../utils/normalizeAssessment";
import { extractConditionTags } from "../utils/conditionExtraction";
import { getPatientFacingRiskLabel } from "../utils/riskTone";

const PANEL_KEYS = {
  patientInfo: "patientInfo",
  lifestyle: "lifestyle",
  vitals: "vitals",
  medicalHistory: "medicalHistory",
  familyHistory: "familyHistory",
};

export default function PatientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initialPatient = normalizePatient(location.state?.patient);
  const initialAssessment = normalizeAssessment(location.state?.assessment);

  const [patient, setPatient] = useState(initialPatient);
  const [assessment, setAssessment] = useState(initialAssessment);
  const [history, setHistory] = useState(initialAssessment ? [initialAssessment] : []);
  const [loading, setLoading] = useState(!initialPatient);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState("");
  const [expandedPanels, setExpandedPanels] = useState({
    [PANEL_KEYS.patientInfo]: true,
    [PANEL_KEYS.lifestyle]: true,
    [PANEL_KEYS.vitals]: true,
    [PANEL_KEYS.medicalHistory]: true,
    [PANEL_KEYS.familyHistory]: false,
  });
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);

  const canRunAssessment = user?.role === "admin";
  const backPath = "/admin/patients";

  useEffect(() => {
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

        const normalizedPatient = normalizePatientResponse(patientResponse);
        if (!normalizedPatient?.patient_id) {
          throw new Error("Invalid response shape");
        }

        setPatient(normalizedPatient);
        setCachedQuery(["patient", id], normalizedPatient);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Failed to load patient");
      } finally {
        setLoading(false);
      }

      try {
        const riskRes = await fetchWithCache({
          key: ["assessment", id],
          fetcher: async () => {
            const res = await api.get(`/api/v1/predictive-analysis/risk-assessment/user?id=${id}`);
            return res.data;
          },
        });

        const normalizedAssessment = normalizeAssessment(riskRes?.data ?? riskRes);
        if (normalizedAssessment) {
          setAssessment(normalizedAssessment);
          setHistory([normalizedAssessment]);
          setCachedQuery(["assessment", id], normalizedAssessment);
        } else {
          setAssessment(null);
          setHistory([]);
        }
      } catch {
        setAssessment(null);
        setHistory([]);
      }
    };

    load();
  }, [id]);

  const runAssessment = useCallback(async () => {
    setAssessing(true);
    setError("");

    try {
      const { data } = await api.post("/api/v1/predictive-analysis/risk-assessment", { patient_id: id });
      const normalized = normalizeAssessment(data);

      if (!normalized) {
        throw new Error("Assessment response was empty");
      }

      setAssessment(normalized);
      setHistory([normalized]);
      setCachedQuery(["assessment", id], normalized);

      /**
       * Admin sync: invalidate cached assessment views used by the admin subsystem
       * so patient reruns immediately reflect on admin lists/dashboard.
       */
      invalidateCachedQuery(["patients"]);
      invalidateCachedQuery(["assessments", "latest-by-patient"]);
      invalidateCachedQuery(["assessments", "all"]);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Assessment failed");
    } finally {
      setAssessing(false);
    }
  }, [id]);

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
    return showAllRecommendations ? list : list.slice(0, 3);
  }, [assessment?.recommendations, showAllRecommendations]);

  const hasMoreRecommendations = (assessment?.recommendations?.length || 0) > 3;
  const hasAssessment = Boolean(assessment);

  const patientInfoRows = useMemo(
    () =>
      [
        patient?.address ? ["Address", patient.address] : null,
        patient?.contact ? ["Contact", patient.contact] : null,
        patient?.last_visit_date ? ["Last Visit", formatDateTime(patient.last_visit_date)] : null,
        patient?.attending_physician ? ["Attending Physician", patient.attending_physician] : null,
        Array.isArray(patient?.current_medications) && patient.current_medications.length > 0
          ? ["Medications", patient.current_medications.join(", ")]
          : null,
      ].filter(Boolean),
    [patient]
  );


  const lifestyleData = useMemo(() => {
    if (!patient?.lifestyle) return null;
    const data = {};
    if (patient.lifestyle.smoking) data.smoking = true;
    if (patient.lifestyle.alcohol) data.alcohol = true;
    if (patient.lifestyle.diet) data.diet = patient.lifestyle.diet;
    if (patient.lifestyle.physical_activity) data.physical_activity = patient.lifestyle.physical_activity;
    return Object.keys(data).length > 0 ? data : null;
  }, [patient?.lifestyle]);

  const medicalHistoryItems = useMemo(() => {
    return extractConditionTags(patient, 6);
  }, [patient]);

  const familyHistory = useMemo(() => compactRecord(patient?.family_history), [patient?.family_history]);
  const vitals = useMemo(() => compactRecord(patient?.vitals), [patient?.vitals]);

  const riskScore = getAssessmentRiskScore(assessment);
  const riskLevel = getAssessmentRiskLevel(assessment) || "Low";
  const patientRiskLabel = getPatientFacingRiskLabel(riskLevel);
  const topRiskFactor = useMemo(() => {
    const breakdown = Array.isArray(assessment?.breakdown) ? assessment.breakdown : [];
    const top = [...breakdown].sort((a, b) => Number(b?.points || 0) - Number(a?.points || 0))[0];
    return top?.label || "Recent health markers";
  }, [assessment?.breakdown]);

  const togglePanel = (key) => {
    setExpandedPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading && !patient) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={styles.centerSub}>Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <div style={styles.center}>
          <p style={styles.errorText}>{error || "Patient not found."}</p>
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
            {"<- Back"}
          </button>

          <div style={styles.identity}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <h1 style={styles.pageTitle}>{patient?.name ?? "No Name"}</h1>
              <p style={styles.pageSubtitle}>
                {[
                  patient?.patient_id,
                  patient?.age !== undefined && patient?.age !== null ? `${patient.age}y` : null,
                  patient?.gender || null,
                  patient?.blood_type || null,
                ]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            </div>
          </div>

          {canRunAssessment && (
            <div style={styles.headerActions}>
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

        {assessment?.disclaimer && (
          <div style={styles.disclaimerBox}>
            <p style={styles.disclaimerText}>{assessment.disclaimer}</p>
          </div>
        )}

        {hasAssessment && (
          <section style={styles.scoreCard}>
            <div style={styles.scoreLeft}>
              <div style={styles.scoreRadialWrap}>
                <RadialHealthScore score={riskScore} riskLevel={riskLevel} size={90} strokeWidth={7} />
              </div>
              <span style={styles.scoreRadialLabel}>Risk Score {riskScore ?? "--"}/100</span>
            </div>

            <div style={styles.scoreRight}>
              <div style={styles.scoreBadges}>
                <RiskBadge level={riskLevel} large />
                {assessment?.confidence && <ConfidenceBadge level={assessment.confidence} />}
              </div>

              <div style={styles.scoreMeta}>
                <div style={styles.scoreMetaItem}>
                  <span style={styles.scoreMetaLabel}>Risk Status</span>
                  <span style={styles.scoreMetaValue}>{patientRiskLabel}</span>
                </div>
                <div style={styles.scoreMetaItem}>
                  <span style={styles.scoreMetaLabel}>Top Risk Factor</span>
                  <span style={styles.scoreMetaValue}>{topRiskFactor}</span>
                </div>
                {assessment?.createdAt && (
                  <div style={styles.scoreMetaItem}>
                    <span style={styles.scoreMetaLabel}>Last Assessed</span>
                    <span style={styles.scoreMetaValue}>
                      {new Date(assessment.createdAt).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {history.length > 1 && (
                <div style={styles.scoreHistory}>
                  <h4 style={styles.scoreHistoryTitle}>Recent History</h4>
                  <div style={styles.historyInline}>
                    {history.slice(0, 3).map((entry) => (
                      <div key={entry._id || `${entry.createdAt}-${entry.risk_score}`} style={styles.historyItem}>
                        <span style={styles.historyLevel}>{entry.risk_level}</span>
                        <span style={styles.historyScore}>{getAssessmentRiskScore(entry) ?? "--"}/100</span>
                        <span style={styles.historyDate}>
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                              })
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <div style={styles.mainGrid}>
          <section style={styles.leftColumn}>
            <CollapsibleCard
              title="Patient Info"
              expanded={expandedPanels[PANEL_KEYS.patientInfo]}
              onToggle={() => togglePanel(PANEL_KEYS.patientInfo)}
            >
              <InfoList rows={patientInfoRows} emptyText="No patient information available." />
            </CollapsibleCard>

            {lifestyleData && (
              <div style={styles.lifestyleCard}>
                <h3 style={styles.lifestyleTitle}>Lifestyle & Habits</h3>
                <div style={styles.lifestyleBadges}>
                  {lifestyleData.smoking && (
                    <div style={styles.lifestyleBadge}>
                      <Cigarette size={14} />
                      <span>Smoking</span>
                    </div>
                  )}
                  {lifestyleData.alcohol && (
                    <div style={styles.lifestyleBadge}>
                      <Wine size={14} />
                      <span>Alcohol Use</span>
                    </div>
                  )}
                  {lifestyleData.diet && (
                    <div style={{ ...styles.lifestyleBadge, ...styles.lifestyleBadgeAlt }}>
                      <Utensils size={14} />
                      <span>{lifestyleData.diet}</span>
                    </div>
                  )}
                  {lifestyleData.physical_activity && (
                    <div style={{ ...styles.lifestyleBadge, ...styles.lifestyleBadgeAlt }}>
                      <Zap size={14} />
                      <span>{lifestyleData.physical_activity}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <CollapsibleCard
              title="Vitals"
              expanded={expandedPanels[PANEL_KEYS.vitals]}
              onToggle={() => togglePanel(PANEL_KEYS.vitals)}
            >
              <ChipGrid data={vitals} formatter={formatKey} emptyText="No vitals available." />
            </CollapsibleCard>

            <CollapsibleCard
              title="Medical History"
              expanded={expandedPanels[PANEL_KEYS.medicalHistory]}
              onToggle={() => togglePanel(PANEL_KEYS.medicalHistory)}
            >
              {medicalHistoryItems.length > 0 ? (
                <div style={styles.historyTagGrid}>
                  {medicalHistoryItems.map((item) => (
                    <div key={item} style={styles.historyTag}>
                      {item}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.emptyText}>No medical history available.</p>
              )}
            </CollapsibleCard>

            {Object.keys(familyHistory).length > 0 && (
              <CollapsibleCard
                title="Family History"
                expanded={expandedPanels[PANEL_KEYS.familyHistory]}
                onToggle={() => togglePanel(PANEL_KEYS.familyHistory)}
              >
                <ChipGrid
                  data={familyHistory}
                  positiveLabel="Risk"
                  negativeLabel="None"
                  positiveTone="warm"
                  negativeTone="cool"
                  formatter={formatKey}
                />
              </CollapsibleCard>
            )}
          </section>

          <section style={styles.rightColumn}>
            {hasAssessment ? (
              <>
                <div style={styles.recommendationPreview}>
                  <div style={styles.previewHeader}>
                    <h2 style={styles.previewTitle}>
                      <Stethoscope size={15} /> Immediate Recommendations
                    </h2>
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

                <div style={styles.secondaryInsightsCard}>
                  <p style={styles.secondaryInsightsTitle}>
                    <AlertCircle size={14} /> Predictive Interpretation
                  </p>
                  <p style={styles.secondaryInsightsBody}>
                    {assessment?.structured_insights?.progress_interpretation ||
                      "Risk interpretation is based on deterministic scoring from lifestyle, vitals, and medical history signals."}
                  </p>
                  <p style={styles.secondaryInsightsBody}>
                    {assessment?.structured_insights?.predictive_outlook ||
                      "Continue preventive actions and routine monitoring to improve long-term outcomes."}
                  </p>
                </div>

                <ResultTabs data={assessment} />
              </>
            ) : (
              <div style={styles.noAssessment}>
                <div style={styles.noAssessmentIcon}>
                  <Activity size={34} />
                </div>
                <h2 style={styles.noAssessmentTitle}>No Assessment Yet</h2>
                <p style={styles.noAssessmentSub}>
                  {canRunAssessment
                    ? "This patient profile is fully available. Run an assessment to generate the risk score, breakdown, and care guidance."
                    : "Your care team has not generated an assessment yet."}
                </p>
                {canRunAssessment && (
                  <button style={styles.assessBtn} onClick={runAssessment} disabled={assessing}>
                    {assessing ? "Assessing..." : "Run Assessment"}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

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

function InfoList({ rows, emptyText = "No data available." }) {
  if (!rows.length) {
    return <p style={styles.emptyText}>{emptyText}</p>;
  }

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
  emptyText = "No data available.",
}) {
  const entries = Object.entries(data || {});

  if (entries.length === 0) {
    return <p style={styles.emptyText}>{emptyText}</p>;
  }

  return (
    <div style={styles.chipGrid}>
      {entries.map(([key, rawValue]) => {
        const isBoolean = typeof rawValue === "boolean";
        const positive = isBoolean ? rawValue : true;
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

function compactRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record || {}).filter(([, value]) => {
      if (typeof value === "boolean") return true;
      return Boolean(cleanText(value));
    })
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


function formatKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#f7fbfd" },
  main: {
    flex: 1,
    minWidth: 0,
    padding: "18px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
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
  scoreCard: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "14px",
    padding: "16px",
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: "16px",
    alignItems: "center",
  },
  scoreLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
  },
  scoreRadialWrap: {
    width: "110px",
    height: "110px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scoreRadialLabel: {
    color: "#5f7685",
    fontSize: "11px",
    fontWeight: 700,
    textAlign: "center",
  },
  scoreRight: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
  },
  scoreBadges: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  scoreMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "10px",
  },
  scoreMetaItem: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    background: "#f8fcfe",
    border: "1px solid #e5f0f5",
    borderRadius: "10px",
    padding: "10px 12px",
  },
  scoreMetaLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#6b8799",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
  scoreMetaValue: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#123447",
    lineHeight: 1.3,
  },
  scoreHistory: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  scoreHistoryTitle: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 700,
    color: "#6b8799",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
  },
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
    gridTemplateColumns: "minmax(280px, 360px) 1fr",
    gap: "14px",
    minHeight: 0,
    marginTop: "6px",
  },
  leftColumn: { display: "flex", flexDirection: "column", gap: "12px" },
  rightColumn: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
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
  emptyText: { color: "#94a3b8", fontSize: "12px", margin: 0 },
  recommendationPreview: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "12px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" },
  previewTitle: { margin: 0, fontSize: "15px", color: "#17384c", display: "flex", alignItems: "center", gap: "8px" },
  viewAllBtn: {
    border: "none",
    background: "transparent",
    color: "#1ea7b8",
    fontSize: "12px",
    fontWeight: 700,
    padding: 0,
  },
  previewList: { margin: "4px 0 0 18px", display: "flex", flexDirection: "column", gap: "6px", padding: 0 },
  previewItem: { color: "#2d4a5b", fontSize: "13px", lineHeight: 1.55 },
  historyTagGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  historyTag: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "30px",
    padding: "6px 12px",
    borderRadius: "999px",
    background: "#eaf6fb",
    color: "#123f5a",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.2,
    boxShadow: "inset 0 0 0 1px #d8eaf3",
  },
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
    minHeight: "240px",
    justifyContent: "center",
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
  disclaimerBox: {
    marginBottom: "12px",
    padding: "10px 12px",
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: "10px",
  },
  disclaimerText: {
    margin: 0,
    fontSize: "12px",
    color: "#92400e",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  secondaryInsightsCard: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "12px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  secondaryInsightsTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    color: "#17384c",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  secondaryInsightsBody: {
    margin: 0,
    fontSize: "13px",
    color: "#526f82",
    lineHeight: 1.55,
  },
  lifestyleCard: {
    background: "#ffffff",
    border: "1px solid #dbe7ee",
    borderRadius: "12px",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  lifestyleTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    color: "#274355",
  },
  lifestyleBadges: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  lifestyleBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "8px",
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
    fontSize: "12px",
    fontWeight: 600,
  },
  lifestyleBadgeAlt: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },
};
