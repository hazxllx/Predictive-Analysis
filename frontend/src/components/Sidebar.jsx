import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, ClipboardList, LogOut, Shield, LineChart } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL = {
  staff: "Healthcare Staff",
  admin: "Administrator",
  patient: "Patient",
};

const ROLE_NAV = {
  staff: [
    { icon: <LayoutDashboard size={16} />, label: "Dashboard", path: "/dashboard" },
    { icon: <Users size={16} />, label: "Patients", path: "/patients" },
    { icon: <ClipboardList size={16} />, label: "Audit Log", path: "/audit-log" },
  ],
  patient: [
    { icon: <LayoutDashboard size={16} />, label: "Dashboard", path: "/my-dashboard" },
    { icon: <LineChart size={16} />, label: "My Progress", path: "/my-progress" },
  ],
  admin: [
    { icon: <LayoutDashboard size={16} />, label: "Dashboard", path: "/admin-dashboard" },
    { icon: <Shield size={16} />, label: "Users", path: "/admin/users" },
    { icon: <Users size={16} />, label: "Patients", path: "/admin/patients" },
    { icon: <ClipboardList size={16} />, label: "Audit Log", path: "/admin/audit-log" },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role || "staff";
  const navItems = ROLE_NAV[role] || ROLE_NAV.staff;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="18" fill="#0ea5e9" fillOpacity="0.15" />
          <path
            d="M10 18h4l3-7 4 14 3-7h2"
            stroke="#0ea5e9"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={styles.brandText}>Pulse Prophet</span>
      </div>

      <nav style={styles.nav}>
        {role === "staff" ? (
          <>
            <button
              style={{ ...styles.navItem, ...(location.pathname === "/dashboard" ? styles.navActive : {}) }}
              onClick={() => navigate("/dashboard")}
            >
              <span style={styles.navIcon}>
                <LayoutDashboard size={16} />
              </span>
              <span>Dashboard</span>
            </button>

            <button
              style={{
                ...styles.navItem,
                ...((location.pathname === "/patients" || location.pathname.startsWith("/patients/"))
                  ? styles.navActive
                  : {}),
              }}
              onClick={() => navigate("/patients")}
            >
              <span style={styles.navIcon}>
                <Users size={16} />
              </span>
              <span>Patients</span>
            </button>

            <button
              style={{ ...styles.navItem, ...(location.pathname === "/audit-log" ? styles.navActive : {}) }}
              onClick={() => navigate("/audit-log")}
            >
              <span style={styles.navIcon}>
                <ClipboardList size={16} />
              </span>
              <span>Audit Log</span>
            </button>
          </>
        ) : (
          navItems.map((item) => {
            const active =
              role === "patient"
                ? location.pathname === item.path
                : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <button
                key={item.path}
                style={{ ...styles.navItem, ...(active ? styles.navActive : {}) }}
                onClick={() => navigate(item.path)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })
        )}
      </nav>

      <div style={styles.userSection}>
        <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase() || "U"}</div>
        <div style={styles.userInfo}>
          <p style={styles.userName}>{user?.name || "User"}</p>
          <p style={styles.userRole}>{ROLE_LABEL[role] || "User"}</p>
        </div>
        <button style={styles.logoutBtn} onClick={logout} title="Logout">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: "240px",
    height: "100vh",
    background: "white",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    padding: "20px 16px",
    flexShrink: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "32px",
    padding: "0 4px",
  },
  brandText: {
    fontFamily: "Lora, serif",
    fontSize: "16px",
    fontWeight: "600",
    color: "#1e293b",
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#64748b",
    width: "100%",
    textAlign: "left",
    transition: "all 0.15s",
    cursor: "pointer",
  },
  navActive: {
    background: "#e0f2fe",
    color: "#0284c7",
  },
  navIcon: {
    display: "inline-flex",
    alignItems: "center",
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    marginTop: "auto",
  },
  avatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0ea5e9, #0d9488)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "700",
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontSize: "10px",
    color: "#94a3b8",
    marginTop: "1px",
  },
  logoutBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
  },
};
