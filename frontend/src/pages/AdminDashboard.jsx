import React, { useEffect, useState } from "react";
import { ClipboardList, FileText, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [recentAssessments, setRecentAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: s }, { data: pList }, { data: assessmentResponse }] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/patients"),
          api.get("/api/v1/predictive-analysis/risk-assessment/all?limit=100"),
        ]);
        setStats(s);

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
            {/* Stats Grid */}
            {stats && (
              <section style={styles.statsGrid}>
                <StatCard label="Total Users" value={stats.totalUsers} accent="#0284c7" bg="#e0f2fe" onClick={() => navigate("/admin/users")} />
                <StatCard label="Patient Accounts" value={stats.totalPatientUsers} accent="#7c3aed" bg="#ede9fe" onClick={() => navigate("/admin/users")} />
                <StatCard label="PMS Patients" value={stats.totalPatients} accent="#0284c7" bg="#dbeafe" onClick={() => navigate("/admin/patients")} />
                <StatCard label="Total Assessments" value={stats.totalAssessments} accent="#b45309" bg="#fef3c7" onClick={() => navigate("/admin/audit-log")} />
                <StatCard label="Administrators" value={stats.totalAdmins} accent="#be123c" bg="#ffe4e6" onClick={() => navigate("/admin/users")} />
              </section>
            )}

            <div style={styles.twoCol}>
              {/* Recent Assessments */}
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <h2 style={styles.panelTitle}>Recent Assessments</h2>
                  <button style={styles.panelLink} onClick={() => navigate("/admin/audit-log")}>
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
                          <span style={styles.assessScore}>{a.risk_score}/100</span>
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

              {/* Quick Actions */}
              <section style={styles.panel}>
                <div style={styles.panelHeader}>
                  <h2 style={styles.panelTitle}>Quick Actions</h2>
                </div>
                <div style={styles.actionsWrap}>
                  <ActionCard
                    icon={Users}
                    title="Manage Users"
                    desc="Create, edit, and manage user accounts and roles"
                    onClick={() => navigate("/admin/users")}
                    color="#0284c7"
                    bg="#e0f2fe"
                  />
                  <ActionCard
                    icon={ClipboardList}
                    title="View Patients"
                    desc="Browse all patients registered in the system"
                    onClick={() => navigate("/admin/patients")}
                    color="#0f766e"
                    bg="#ccfbf1"
                  />
                  <ActionCard
                    icon={FileText}
                    title="Audit Log"
                    desc="Review all assessment events and system activity"
                    onClick={() => navigate("/admin/audit-log")}
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

function StatCard({ label, value, accent, bg, onClick }) {
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
}

function ActionCard({ icon: Icon, title, desc, onClick, color, bg }) {
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
}

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
  if (level === "High") return { ...base, color: "#c2410c", background: "#ffedd5", borderColor: "#fed7aa" };
  if (level === "Moderate") return { ...base, color: "#a16207", background: "#fef9c3", borderColor: "#fde68a" };
  if (level === "Low") return { ...base, color: "#166534", background: "#dcfce7", borderColor: "#bbf7d0" };
  return { ...base, color: "#475569", background: "#f1f5f9", borderColor: "#e2e8f0" };
};

const styles = {
  layout: { display: "flex", height: "100vh", overflow: "hidden" },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "20px 24px",
    overflowY: "auto",
    background: "#f8fafc",
    minWidth: 0,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  title: { fontFamily: "Lora, serif", fontSize: "22px", color: "#1e293b", fontWeight: "600" },
  subtitle: { fontSize: "12px", color: "#64748b", marginTop: "3px" },
  welcomeTag: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "6px 14px",
    fontSize: "13px",
    fontWeight: "600",
    color: "#334155",
  },
  welcomeIcon: { color: "#f59e0b" },

  center: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  spinner: {
    width: "32px", height: "32px",
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #0ea5e9",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: { fontSize: "13px", color: "#94a3b8" },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    flexShrink: 0,
  },
  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "14px 16px",
    textAlign: "left",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  statValue: { fontSize: "28px", fontWeight: "800", lineHeight: 1.1 },
  statLabel: { marginTop: "4px", fontSize: "12px", color: "#64748b", fontWeight: "500" },

  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    flex: 1,
    minHeight: 0,
  },
  panel: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  panelHeader: {
    padding: "12px 16px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  panelTitle: { fontFamily: "Lora, serif", fontSize: "15px", color: "#1e293b", fontWeight: "600" },
  panelLink: {
    background: "none",
    border: "none",
    color: "#0ea5e9",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    padding: 0,
  },
  listWrap: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: "8px",
  },
  assessRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 10px",
    borderRadius: "10px",
    transition: "background 0.14s",
  },
  assessLeft: { display: "flex", alignItems: "center", gap: "10px" },
  initialPill: {
    width: "32px", height: "32px",
    borderRadius: "50%",
    background: "#e0f2fe",
    color: "#0369a1",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "13px", fontWeight: "700", flexShrink: 0,
    border: "1px solid #bae6fd",
  },
  assessName: { fontSize: "13px", fontWeight: "600", color: "#1e293b" },
  assessId: { fontSize: "10px", color: "#94a3b8", marginTop: "1px" },
  assessRight: { display: "flex", alignItems: "center", gap: "8px" },
  assessScore: { fontSize: "12px", fontWeight: "700", color: "#334155" },
  assessDate: { fontSize: "11px", color: "#94a3b8" },
  empty: { fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" },

  actionsWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
  },
  actionCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px 16px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "left",
    transition: "box-shadow 0.15s, border-color 0.15s",
    flex: 1,
  },
  actionIcon: {
    width: "44px", height: "44px",
    borderRadius: "12px",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  actionBody: { flex: 1 },
  actionTitle: { fontSize: "14px", fontWeight: "700", marginBottom: "3px" },
  actionDesc: { fontSize: "11px", color: "#64748b", lineHeight: "1.4" },
};
