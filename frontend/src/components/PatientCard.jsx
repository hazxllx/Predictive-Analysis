import React from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, TriangleAlert } from "lucide-react";
import RiskBadge from "./RiskBadge";

export default function PatientCard({ patient, assessment }) {
  const navigate = useNavigate();

  const getRiskColor = (level) => {
    const map = {
      Critical: "#fef2f2",
      High: "#fff7ed",
      Moderate: "#fefce8",
      Low: "#f0fdf4",
    };
    return map[level] || "#f8fafc";
  };

  const missingProfileData = !patient.last_checkup || !patient.contact || !patient.address;
  const delayedData = patient.last_checkup
    ? ((Date.now() - new Date(patient.last_checkup).getTime()) / (1000 * 60 * 60 * 24)) > 180
    : true;

  const riskPercent = assessment?.risk_score ? Math.min(assessment.risk_score, 100) : 0;

  return (
    <div
      style={styles.card}
      onClick={() => navigate(`/patient/${patient.patient_id}`)}
    >
      <div style={styles.top}>
        <div style={styles.avatar}>
          {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div style={styles.info}>
          <p style={styles.name}>{patient.name}</p>
          <p style={styles.meta}>
            {patient.patient_id} · {patient.age}y · {patient.gender}
          </p>
          <p style={styles.location}>{patient.address}</p>
        </div>
      </div>

      <div style={styles.divider} />

      <div style={styles.feedbackRow}>
        {missingProfileData && <span style={styles.incompleteBadge}>Incomplete profile</span>}
        {delayedData && (
          <span style={styles.delayedBadge}>
            <TriangleAlert size={12} /> Data delayed
          </span>
        )}
      </div>

      <div style={styles.bottom}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Blood Type</span>
          <span style={styles.statVal}>{patient.blood_type}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Last Checkup</span>
          <span style={styles.statVal}>
            {new Date(patient.last_checkup).toLocaleDateString("en-PH", {
              month: "short", day: "numeric", year: "numeric"
            })}
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Medications</span>
          <span style={styles.statVal}>{patient.current_medications?.length || 0}</span>
        </div>
      </div>

      {assessment && (
        <>
          <div style={styles.progressWrap}>
            <div style={styles.progressHead}>
              <span style={styles.progressLabel}>Risk Score Progress</span>
              <span style={styles.progressVal}>{assessment.risk_score}%</span>
            </div>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${riskPercent}%` }} />
            </div>
          </div>

          <div
            style={{
              ...styles.riskBar,
              background: getRiskColor(assessment.risk_level),
            }}
          >
            <div style={styles.riskLeft}>
              <RiskBadge level={assessment.risk_level} />
              <span style={styles.riskScore}>Score: {assessment.risk_score}/100</span>
            </div>
            <span style={styles.viewBtn}>View</span>
          </div>

          <div style={styles.quickLinks}>
            <button
              style={styles.quickBtn}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/patient/${patient.patient_id}`);
              }}
            >
              View Recommendations
            </button>
            <button
              style={styles.quickBtnGhost}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/patient/${patient.patient_id}`);
              }}
            >
              <Stethoscope size={13} /> Suggested Specialist
            </button>
          </div>
        </>
      )}

      {!assessment && (
        <div style={styles.noAssessment}>
          <span>No assessment yet</span>
          <span style={styles.viewBtn}>Assess →</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "white",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    cursor: "pointer",
    transition: "box-shadow 0.2s, transform 0.15s",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  top: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    alignItems: "flex-start",
  },
  avatar: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "700",
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: "2px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  meta: { fontSize: "11px", color: "#64748b", marginBottom: "2px" },
  location: {
    fontSize: "10px",
    color: "#94a3b8",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  divider: { height: "1px", background: "#f1f5f9", margin: "0 16px" },
  bottom: {
    display: "flex",
    padding: "10px 16px",
    gap: "12px",
  },
  stat: { display: "flex", flexDirection: "column", gap: "2px", flex: 1 },
  statLabel: { fontSize: "9px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" },
  statVal: { fontSize: "11px", color: "#334155", fontWeight: "600" },
  feedbackRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    padding: "8px 16px 0",
  },
  incompleteBadge: {
    fontSize: "10px",
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: "999px",
    padding: "2px 8px",
    fontWeight: "600",
  },
  delayedBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "10px",
    color: "#9a3412",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "999px",
    padding: "2px 8px",
    fontWeight: "600",
  },
  progressWrap: {
    padding: "8px 16px",
  },
  progressHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "5px",
  },
  progressLabel: { fontSize: "10px", color: "#94a3b8", fontWeight: "600" },
  progressVal: { fontSize: "10px", color: "#334155", fontWeight: "700" },
  progressTrack: {
    width: "100%",
    height: "7px",
    borderRadius: "999px",
    background: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
  },
  riskBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderTop: "1px solid #f1f5f9",
  },
  riskLeft: { display: "flex", alignItems: "center", gap: "8px" },
  riskScore: { fontSize: "11px", color: "#64748b", fontWeight: "500" },
  quickLinks: {
    display: "flex",
    gap: "8px",
    padding: "8px 16px 12px",
  },
  quickBtn: {
    flex: 1,
    border: "none",
    borderRadius: "8px",
    background: "#e0f2fe",
    color: "#0284c7",
    fontSize: "11px",
    fontWeight: "700",
    padding: "8px 10px",
    cursor: "pointer",
  },
  quickBtnGhost: {
    flex: 1,
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "white",
    color: "#475569",
    fontSize: "11px",
    fontWeight: "700",
    padding: "8px 10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    cursor: "pointer",
  },
  noAssessment: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    background: "#f8fafc",
    borderTop: "1px solid #f1f5f9",
    fontSize: "11px",
    color: "#94a3b8",
  },
  viewBtn: {
    fontSize: "11px",
    color: "#0ea5e9",
    fontWeight: "600",
  },
};
