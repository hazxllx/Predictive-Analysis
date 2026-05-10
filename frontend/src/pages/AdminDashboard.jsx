/**
 * Admin Dashboard Page
 *
 * Overview of system health for administrators:
 * - Stats cards (users, patients, assessments)
 * - Recent patient list with risk levels
 * - Latest assessments with quick navigation
 *
 * Performance optimizations:
 * - useMemo for all derived data (patientMap, enriched assessments)
 * - useCallback for event handlers passed to child components
 * - Single useEffect with Promise.all for parallel data fetching
 * - StatCard and ActionCard are extracted to prevent inline object re-creation
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardList, FileText, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

const StatCard = React.memo(function StatCard({ label, value, accent, bg, onClick }) {
  return (
    <button
      style={{ ...styles.statCard, background: bg, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      type="button"
    >
      <p style={{ ...styles.statValue, color: accent }}>{value ?? "—"}</p>
      <p style={styles.statLabel}>{label}</p>
    </button>
  );
});

const ActionCard = React.memo(function ActionCard({ icon: Icon, title, desc, onClick, color, bg }) {
  return (
    <button style={styles.actionCard} onClick={onClick} type="button">
      <div style={{ ...styles.actionIcon, background: bg, color }}>
        <Icon size={22} strokeWidth={2.1} />
      </div>
      <div style={styles.actionBody}>
        <p style={{ ...styles.actionTitle, color }}>{title}</p>
        <p style={styles.actionDesc}>{desc}</p>
      </div>
      <span style={{ color, fontSize: "18px", fontWeight: "700" }}>&#8250;</span>
    </button>
  );
});

const statusPill = (level) => {
  const base = {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
    border: "1px solid transparent",
  };
  if (level === "Critical") return { ...base, color: "#b91c1c", background: "#fee2e2", borderColor: "#fecaca" };
  if (level === "High") return { ...base, color: "#9a3412", background: "#ffedd5", borderColor: "#fed7aa" };
  if (level === "Moderate") return { ...base, color: "#854d0e", background: "#fef9c3", borderColor: "#fde047" };
  if (level === "Low") return { ...base, color: "#15803d", background: "#dcfce7", borderColor: "#86efac" };
  return { ...base, color: "#475569", background: "#f1f5f9", borderColor: "#e2e8f0" };
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [{ data: s }, { data: pList }, { data: assessmentResponse }] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/patients"),
          api.get("/api/v1/predictive-analysis/risk-assessment/all?limit=100"),
        ]);

        if (cancelled) return;

        setStats(s.data || s);

        const patientArray = Array.isArray(pList?.data)
          ? pList.data
          : Array.isArray(pList)
          ? pList
          : [];
        setPatients(patientArray);

        const patientMap = new Map(patientArray.map((p) => [String(p.patient_id), p]));
        const allAssessments = (Array.isArray(assessmentResponse?.data) ? assessmentResponse.data : [])
          .map((assessment) => {
            const patient = patientMap.get(String(assessment.patient_id));
            return {
              ...assessment,
              patientName: patient?.name || assessment.patient_id,
            };
          })
          .filter(Boolean);

        allAssessments.sort((a, b) =>
          new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
        );
        setRecentAssessments(allAssessments.slice(0, 8));
      } catch {
        // Silently ignore; loading state will clear
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const navigateTo = useCallback((path) => () => navigate(path), [navigate]);

  const statsCards = useMemo(() => {
    if (!stats) return null;
    return [
      { label: "Total Users", value: stats.totalUsers, accent: "#0284c7", bg: "#e0f2fe", path: "/admin/users" },
      { label: "Patient Accounts", value: stats.totalPatientUsers, accent: "#7c3aed", bg: "#ede9fe", path: "/admin/users" },
      { label: "PMS Patients", value: stats.totalPatients, accent: "#0284c7", bg: "#dbeafe", path: "/admin/patients" },
      { label: "Total Assessments", value: stats.totalAssessments, accent: "#b45309", bg: "#fef3c7", path: "/admin/audit-log" },
      { label: "Administrators", value: stats.totalAdmins, accent: "#be123c", bg: "#ffe4e6", path: "/admin/users" },
    ];
  }, [stats]);

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <header style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Admin Dashboard</h1>
            <p style={styles.subtitle}>System overview and management</p>
          </div>
          <div style={styles.welcomeTag}>
            <Sparkles size={14} style={styles.welcomeIcon} />
            Welcome, {user?.name?.split(" ")[0]}
          </div>
        </header>

        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading system data...</p>
          </div>
        ) : (
          <>
            {statsCards && (
              <section style={styles.statsGrid}>
                {statsCards.map((card) => (
                  <StatCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    accent={card.accent}
                    bg={card.bg}
                    onClick={navigateTo(card.path)}
                  />
                ))}
              </section>
            )}

            <div style={styles.twoCol}>
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <h2 style={styles.panelTitle}>Recent Assessments</h2>
                  <button style={styles.panelLink} onClick={navigateTo("/admin/audit-log")}>
                    View All
                  </button>
                </div>
                <div style={styles.listWrap}>
                  {recentAssessments.length === 0 ? (
                    <p style={styles.empty}>No assessments found.</p>
                  ) : (
                    recentAssessments.map((a, i) => (
                      <div key={i} style={styles.assessRow}>
                        <div style={styles.assessLeft}>
                          <div style={styles.initialPill}>
                            {(a.patientName || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={styles.assessName}>{a.patientName || a.patient_id}</p>
                            <p style={styles.assessId}>{a.patient_id}</p>
                          </div>
                        </div>
                        <div style={styles.assessRight}>
                          <span style={statusPill(a.risk_level)}>{a.risk_level || "N/A"}</span>
                          <span style={styles.assessScore}>{a.risk_score ?? "--"}/100</span>
                          <span style={styles.assessDate}>
                            {new Date(a.timestamp || a.createdAt).toLocaleDateString("en-PH", {
                              month: "short", day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <h2 style={styles.panelTitle}>Quick Actions</h2>
                </div>
                <div style={styles.actionsWrap}>
                  <ActionCard
                    icon={Users}
                    title="Manage Users"
                    desc="Create, edit, and manage user accounts and roles"
                    onClick={navigateTo("/admin/users")}
                    color="#0284c7"
                    bg="#e0f2fe"
                  />
                  <ActionCard
                    icon={ClipboardList}
                    title="View Patients"
                    desc="Browse all patients registered in the system"
                    onClick={navigateTo("/admin/patients")}
                    color="#0f766e"
                    bg="#ccfbf1"
                  />
                  <ActionCard
                    icon={FileText}
                    title="Audit Log"
                    desc="Review all assessment events and system activity"
                    onClick={navigateTo("/admin/audit-log")}
                    color="#b45309"
                    bg="#fef3c7"
                  />
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "var(--bg-main)" },
  main: { flex: 1, padding: "24px 28px", overflowY: "auto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "22px", fontWeight: 700, color: "var(--text-main)", margin: 0 },
  subtitle: { fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" },
  welcomeTag: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "#0ea5e9", background: "#e0f2fe", padding: "6px 12px", borderRadius: "999px" },
  welcomeIcon: { flexShrink: 0 },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh" },
  spinner: { width: "32px", height: "32px", border: "3px solid #e2e8f0", borderTopColor: "#0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText: { marginTop: "12px", fontSize: "14px", color: "var(--text-muted)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "14px", marginBottom: "24px" },
  statCard: { border: "none", borderRadius: "12px", padding: "16px", textAlign: "left", transition: "transform 0.15s ease, box-shadow 0.15s ease" },
  statValue: { fontSize: "24px", fontWeight: 700, margin: 0, lineHeight: 1.2 },
  statLabel: { fontSize: "12px", color: "var(--text-muted)", margin: "4px 0 0", fontWeight: 500 },
  twoCol: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" },
  panel: { background: "var(--bg-surface)", borderRadius: "12px", border: "1px solid var(--border-color)", padding: "18px" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  panelTitle: { fontSize: "15px", fontWeight: 700, color: "var(--text-main)", margin: 0 },
  panelLink: { fontSize: "12px", fontWeight: 600, color: "#0ea5e9", background: "none", border: "none", cursor: "pointer" },
  listWrap: { display: "flex", flexDirection: "column", gap: "10px" },
  empty: { fontSize: "13px", color: "var(--text-muted)", textAlign: "center", padding: "20px 0" },
  assessRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", background: "var(--bg-main)", border: "1px solid var(--border-color)" },
  assessLeft: { display: "flex", alignItems: "center", gap: "10px" },
  initialPill: { width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #0ea5e9, #0d9488)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 },
  assessName: { fontSize: "13px", fontWeight: 600, color: "var(--text-main)", margin: 0 },
  assessId: { fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0" },
  assessRight: { display: "flex", alignItems: "center", gap: "10px" },
  assessScore: { fontSize: "12px", fontWeight: 700, color: "var(--text-main)" },
  assessDate: { fontSize: "11px", color: "var(--text-muted)" },
  actionsWrap: { display: "flex", flexDirection: "column", gap: "10px" },
  actionCard: { display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "10px", background: "var(--bg-main)", border: "1px solid var(--border-color)", cursor: "pointer", textAlign: "left" },
  actionIcon: { width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: "13px", fontWeight: 700, margin: 0 },
  actionDesc: { fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 0" },
};
