import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import { normalizePatients } from "../utils/normalizePatients";

/* ─── SVG Icons (inline, no library needed) ───────────────────── */
const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconActivity = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconLog = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

/* ─── Helpers ─────────────────────────────────────────────────── */
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function riskDot(status) {
  const colors = {
    Critical: "#ef4444",
    High: "#f97316",
    Moderate: "#eab308",
    Low: "#22c55e",
  };
  return (
    <span style={{
      display: "inline-block",
      width: "7px",
      height: "7px",
      borderRadius: "50%",
      background: colors[status] || "#cbd5e1",
      flexShrink: 0,
    }} />
  );
}

/* ─── Risk pill style ─────────────────────────────────────────── */
const riskPill = (status) => {
  const base = {
    display: "inline-block",
    padding: "2px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };
  if (status === "Critical") return { ...base, color: "#b91c1c", background: "#fee2e2", borderColor: "#fecaca" };
  if (status === "High")     return { ...base, color: "#c2410c", background: "#ffedd5", borderColor: "#fed7aa" };
  if (status === "Moderate") return { ...base, color: "#a16207", background: "#fef9c3", borderColor: "#fde68a" };
  if (status === "Low")      return { ...base, color: "#166534", background: "#dcfce7", borderColor: "#bbf7d0" };
  return { ...base, color: "#94a3b8", background: "#f8fafc", borderColor: "#e2e8f0" };
};

/* ─── Main Component ──────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/patients");
        const pList = normalizePatients(res);
        setPatients(pList);

        const allAssessments = [];
        await Promise.all(
          pList?.map(async (p) => {
            try {
              const { data } = await api.get(`/risk-assessment/user?id=${p.patient_id}`);
              if (Array.isArray(data)) {
                data.forEach((a) => allAssessments.push({ ...a, patient_id: p.patient_id }));
              }
            } catch {
              // ignore per-patient error
            }
          })
        );

        allAssessments.sort(
          (a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
        );
        setAssessments(allAssessments);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const patientMap = useMemo(() => {
    const map = {};
    patients?.forEach((p) => { map[p.patient_id] = p; });
    return map;
  }, [patients]);

  const latestByPatient = useMemo(() => {
    const map = {};
    assessments?.forEach((a) => {
      if (!map[a.patient_id]) map[a.patient_id] = a;
    });
    return map;
  }, [assessments]);

  const stats = useMemo(() => {
    const assessedCount = Object.keys(latestByPatient).length;
    const criticalCount = Object.values(latestByPatient).filter(
      (a) => a.risk_level === "Critical" || a.risk_score >= 70
    ).length;
    return {
      totalPatients: patients.length,
      assessed: assessedCount,
      critical: criticalCount,
      totalLogs: assessments.length,
    };
  }, [patients, latestByPatient, assessments]);

  /* Quick insight text */
  const insightText = useMemo(() => {
    if (loading) return null;
    if (stats.critical > 0)
      return `${stats.critical} patient${stats.critical > 1 ? "s" : ""} require${stats.critical === 1 ? "s" : ""} immediate attention`;
    const recentCount = assessments.filter((a) => {
      const ts = a.timestamp || a.createdAt;
      return ts && (new Date() - new Date(ts)) < 86400000;
    }).length;
    if (recentCount > 0)
      return `${recentCount} assessment${recentCount > 1 ? "s" : ""} recorded in the last 24 hours`;
    if (stats.assessed < stats.totalPatients && stats.totalPatients > 0)
      return `${stats.totalPatients - stats.assessed} patient${stats.totalPatients - stats.assessed > 1 ? "s" : ""} not yet assessed`;
    return "All patients have been reviewed";
  }, [loading, stats, assessments]);

  const query = search.trim().toLowerCase();

  /* Recent assessments — one per patient (latest only), capped at 6 */
  const recentAssessments = useMemo(() => {
    // latestByPatient is already deduplicated; convert to array sorted by timestamp
    const deduped = Object.values(latestByPatient).sort(
      (a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
    );
    return deduped
      .filter((a) => {
        if (!query) return true;
        const p = patientMap[a.patient_id];
        const name = (p?.name || "").toLowerCase();
        const id = (a.patient_id || "").toLowerCase();
        return name.includes(query) || id.includes(query);
      })
      .slice(0, 6);
  }, [latestByPatient, patientMap, query]);

  /* PMS patients list — filtered by search */
  const filteredPatients = useMemo(() => {
    return patients?.filter((p) => {
      if (!query) return true;
      return (
        (p.name || "").toLowerCase().includes(query) ||
        (p.patient_id || "").toLowerCase().includes(query)
      );
    });
  }, [patients, query]);

  const openPatient = (id) => navigate(`/patients/${id}`);

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        {/* ── Header ─────────────────────────────────────────── */}
        <header style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Patient Dashboard</h1>
            <p style={styles.subtitle}>Clinical overview — quick decisions at a glance</p>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.searchWrap}>
              <svg style={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search patient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>
          </div>
        </header>

        {/* ── Summary Cards ──────────────────────────────────── */}
        <section style={styles.statsGrid}>
          <MetricCard
            label="PMS Patients" value={stats.totalPatients}
            iconColor="#0284c7" icon={<IconUsers />}
            onClick={() => navigate("/patients")}
          />
          <MetricCard
            label="Assessed" value={stats.assessed}
            iconColor="#0d9488" icon={<IconActivity />}
          />
          <MetricCard
            label="Critical" value={stats.critical}
            iconColor="#94a3b8" icon={<IconAlert />}
            isCritical={stats.critical > 0}
          />
          <MetricCard
            label="Total Logs" value={stats.totalLogs}
            iconColor="#7c3aed" icon={<IconLog />}
            onClick={() => navigate("/audit-log")}
          />
        </section>

        {/* ── Quick Insight Strip ────────────────────────────── */}
        {insightText && !loading && (
          <div style={styles.insightStrip}>
            <span style={{
              ...styles.insightDot,
              background: stats.critical > 0 ? "#f87171" : "#6ee7b7",
            }} />
            <span style={styles.insightText}>{insightText}</span>
          </div>
        )}

        {/* ── Two-column content ─────────────────────────────── */}
        <div style={styles.columns}>

          {/* LEFT — Recent Assessments */}
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitleGroup}>
                <h2 style={styles.panelTitle}>Recent Assessments</h2>
                <span style={styles.countBadge}>{recentAssessments.length}</span>
              </div>
            </div>

            <div style={styles.listArea}>
              {loading ? (
                <div style={styles.empty}>Loading…</div>
              ) : recentAssessments.length === 0 ? (
                <div style={styles.empty}>No assessments found.</div>
              ) : (
                recentAssessments.map((a) => {
                  const p = patientMap[a.patient_id] || {};
                  const name = p.name || a.patient_id || "Unknown";
                  const level = a.risk_level || "Unknown";
                  const score = typeof a.risk_score === "number" ? a.risk_score : null;
                  const ts = formatTime(a.timestamp || a.createdAt);
                  return (
                    <AssessmentCard
                      key={a.patient_id}
                      name={name}
                      patientId={a.patient_id}
                      level={level}
                      score={score}
                      ts={ts}
                      onOpen={() => openPatient(a.patient_id)}
                    />
                  );
                })
              )}
            </div>
          </section>

          {/* RIGHT — PMS Patients */}
          <section style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitleGroup}>
                <h2 style={styles.panelTitle}>PMS Patients</h2>
                <span style={styles.countBadge}>{filteredPatients.length}</span>
              </div>
            </div>

            <div style={styles.listArea}>
              {loading ? (
                <div style={styles.empty}>Loading…</div>
              ) : filteredPatients.length === 0 ? (
                <div style={styles.empty}>No patients found.</div>
              ) : (
                filteredPatients.map((p, idx) => {
                  const latest = latestByPatient[p.patient_id];
                  const level = latest?.risk_level || null;
                  const score = typeof latest?.risk_score === "number" ? latest.risk_score : null;
                  return (
                    <PatientListRow
                      key={p.patient_id}
                      patient={p}
                      level={level}
                      score={score}
                      isLast={idx === filteredPatients.length - 1}
                      onOpen={() => openPatient(p.patient_id)}
                    />
                  );
                })
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

/* ─── Assessment Card (left panel) ───────────────────────────── */
function AssessmentCard({ name, patientId, level, score, ts, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const isCritical = level === "Critical";
  return (
    <div
      style={{
        ...styles.assessCard,
        background: hovered ? "#f8fafc" : "white",
        boxShadow: hovered
          ? "0 2px 8px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left: avatar + info */}
      <div style={styles.assessLeft}>
        <div style={styles.assessAvatar}>
          {(name || "U").charAt(0).toUpperCase()}
        </div>
        <div style={styles.assessInfo}>
          <div style={styles.assessName}>{name}</div>
          <div style={styles.assessMeta}>
            <span style={{ color: "#94a3b8" }}>{patientId}</span>
            {ts && <span style={{ color: "#cbd5e1", margin: "0 5px" }}>·</span>}
            {ts && <span style={{ color: "#94a3b8" }}>{ts}</span>}
          </div>
        </div>
      </div>

      {/* Right: badge + score + action */}
      <div style={styles.assessRight}>
        <div style={styles.assessBadgeRow}>
          {isCritical && (
            <span style={styles.criticalDot} title="Critical" />
          )}
          <span style={riskPill(level)}>{level}</span>
          {score !== null && (
            <span style={styles.assessScore}>{score}/100</span>
          )}
        </div>
        <button
          style={styles.viewBtn}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          View Result →
        </button>
      </div>
    </div>
  );
}

/* ─── Patient List Row (right panel) ─────────────────────────── */
function PatientListRow({ patient, level, score, isLast, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const name = patient.name || "Unknown";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      style={{
        ...styles.patientRow,
        borderBottom: isLast ? "none" : "1px solid #f1f5f9",
        background: hovered ? "#f8fafc" : "transparent",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar + name */}
      <div style={styles.patientLeft}>
        <div style={styles.patientAvatar}>{initial}</div>
        <div>
          <div style={styles.patientName}>{name}</div>
          <div style={styles.patientMeta}>
            {patient.patient_id}
            {patient.age && <span style={{ color: "#e2e8f0", margin: "0 4px" }}>·</span>}
            {patient.age && <span>{patient.age}y</span>}
            {patient.gender && <span style={{ color: "#e2e8f0", margin: "0 4px" }}>·</span>}
            {patient.gender && <span>{patient.gender}</span>}
          </div>
        </div>
      </div>

      {/* Risk status */}
      <div style={styles.patientRight}>
        {level ? (
          <div style={styles.patientRiskGroup}>
            {riskDot(level)}
            <span style={riskPill(level)}>{level}</span>
            {score !== null && <span style={styles.patientScore}>{score}</span>}
          </div>
        ) : (
          <span style={styles.notAssessed}>Not Assessed</span>
        )}
      </div>
    </div>
  );
}

/* ─── Metric Card ─────────────────────────────────────────────── */
function MetricCard({ label, value, iconColor, icon, onClick, isCritical = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      style={{
        ...styles.metricCard,
        boxShadow: hovered && onClick
          ? "0 6px 18px rgba(0,0,0,0.09)"
          : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hovered && onClick ? "translateY(-2px)" : "none",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Number left, label+icon right */}
      <div style={styles.metricInner}>
        {/* Left: big number */}
        <p style={styles.metricValue}>{value ?? "—"}</p>

        {/* Right: label + icon stack */}
        <div style={styles.metricRight}>
          <span style={{ color: iconColor, opacity: 0.7, lineHeight: 0 }}>{icon}</span>
          <p style={styles.metricLabel}>{label}</p>
          {isCritical && value > 0 && (
            <span style={styles.criticalPip} title="Requires attention" />
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = {
  layout: { display: "flex", height: "100vh", overflow: "hidden" },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px 24px",
    background: "#f8fafc",
    minWidth: 0,
    overflowY: "auto",
  },

  /* Header */
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexShrink: 0,
  },
  title: { fontFamily: "Lora, serif", fontSize: "22px", color: "#1e293b", fontWeight: "600", margin: 0 },
  subtitle: { fontSize: "12px", color: "#94a3b8", marginTop: "3px", margin: 0 },
  headerRight: { display: "flex", alignItems: "center" },
  searchWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    width: "14px",
    height: "14px",
    pointerEvents: "none",
  },
  searchInput: {
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "8px 16px 8px 34px",
    fontSize: "12px",
    color: "#334155",
    background: "white",
    outline: "none",
    minWidth: "220px",
  },

  /* Stats */
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "10px",
    flexShrink: 0,
  },
  metricCard: {
    background: "white",
    border: "1px solid #e8edf2",
    borderRadius: "14px",
    padding: "18px 20px",
    textAlign: "left",
    transition: "box-shadow 0.18s, transform 0.18s",
  },
  metricInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  metricValue: {
    fontSize: "32px",
    fontWeight: "800",
    color: "#1e293b",
    lineHeight: 1,
    margin: 0,
    letterSpacing: "-0.5px",
  },
  metricRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "5px",
  },
  metricLabel: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    margin: 0,
    whiteSpace: "nowrap",
  },
  criticalPip: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#f87171",
    alignSelf: "flex-end",
  },

  /* Insight strip */
  insightStrip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    flexShrink: 0,
  },
  insightDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  insightText: {
    fontSize: "12px",
    color: "#475569",
    fontWeight: "500",
  },

  /* Two column layout */
  columns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    flex: 1,
    minHeight: 0,
  },

  /* Shared panel */
  panel: {
    background: "white",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 0,
  },
  panelHeader: {
    padding: "13px 18px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  panelTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  panelTitle: {
    fontFamily: "Lora, serif",
    fontSize: "14px",
    color: "#1e293b",
    fontWeight: "600",
    margin: 0,
  },
  countBadge: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "1px 9px",
  },

  /* Scrollable list area */
  listArea: {
    overflowY: "auto",
    flex: 1,
    padding: "8px 10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  empty: {
    textAlign: "center",
    padding: "28px",
    color: "#94a3b8",
    fontSize: "13px",
  },

  /* Assessment card */
  assessCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 12px 12px 14px",
    borderRadius: "12px",
    border: "1px solid #f1f5f9",
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s",
    gap: "10px",
  },
  assessLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
  },
  assessAvatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    flexShrink: 0,
  },
  assessInfo: { minWidth: 0, flex: 1 },
  assessName: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  assessMeta: {
    fontSize: "11px",
    color: "#94a3b8",
    marginTop: "2px",
    display: "flex",
    alignItems: "center",
  },
  assessRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "6px",
    flexShrink: 0,
  },
  assessBadgeRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  criticalDot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#ef4444",
    flexShrink: 0,
  },
  assessScore: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "600",
  },
  viewBtn: {
    padding: "4px 12px",
    background: "transparent",
    color: "#0284c7",
    border: "1px solid #bae6fd",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s, color 0.15s",
  },

  /* Patient list row */
  patientRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 10px",
    cursor: "pointer",
    transition: "background 0.15s",
    borderRadius: "8px",
    gap: "8px",
  },
  patientLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
  },
  patientAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "700",
    flexShrink: 0,
  },
  patientName: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  patientMeta: {
    fontSize: "11px",
    color: "#94a3b8",
    marginTop: "1px",
    display: "flex",
    alignItems: "center",
  },
  patientRight: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  patientRiskGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  patientScore: {
    fontSize: "11px",
    color: "#64748b",
    fontWeight: "700",
  },
  notAssessed: {
    fontSize: "11px",
    color: "#cbd5e1",
    fontStyle: "italic",
  },
};
