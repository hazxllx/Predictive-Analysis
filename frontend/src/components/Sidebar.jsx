/**
 * Sidebar Navigation Component
 *
 * Renders role-based navigation links for admin and patient users.
 * Highlights the active route and shows user info with logout.
 */
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  LogOut,
  Shield,
  LineChart,
  Settings,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

// Role display labels
const ROLE_LABEL = {
  admin: "Administrator",
  patient: "Patient",
};

// Navigation items per role
const ROLE_NAV = {
  admin: [
    { icon: <LayoutDashboard size={16} />, label: "Dashboard", path: "/admin-dashboard" },
    { icon: <Shield size={16} />, label: "Users", path: "/admin/users" },
    { icon: <Users size={16} />, label: "Patients", path: "/admin/patients" },
    { icon: <ClipboardList size={16} />, label: "Audit Log", path: "/admin/audit-log" },
  ],
  patient: [
    { icon: <LayoutDashboard size={16} />, label: "Dashboard", path: "/my-dashboard" },
    { icon: <LineChart size={16} />, label: "My Progress", path: "/my-progress" },
  ],
};

function Sidebar() {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role === "admin" ? "admin" : "patient";
  const navItems = ROLE_NAV[role] || ROLE_NAV.patient;

  const isActive = (path) => {
    if (path === "/settings") return location.pathname === path;
    return role === "patient"
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const themeStyles = isDark ? darkStyles : lightStyles;

  return (
    <aside style={{ ...styles.sidebar, ...themeStyles.sidebar }}>
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
        <span style={{ ...styles.brandText, ...themeStyles.brandText }}>Pulse Prophet</span>
      </div>

      <nav style={styles.nav}>
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              style={{
                ...styles.navItem,
                ...themeStyles.navItem,
                ...(active ? { ...styles.navActive, ...themeStyles.navActive } : {}),
              }}
              onClick={() => navigate(item.path)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          style={{
            ...styles.navItem,
            ...themeStyles.navItem,
            ...(isActive("/settings") ? { ...styles.navActive, ...themeStyles.navActive } : {}),
          }}
          onClick={() => navigate("/settings")}
        >
          <span style={styles.navIcon}>
            <Settings size={16} />
          </span>
          <span>Settings</span>
        </button>
      </nav>

      <div style={{ ...styles.userSection, ...themeStyles.userSection }}>
        <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase() || "U"}</div>
        <div style={styles.userInfo}>
          <p style={{ ...styles.userName, ...themeStyles.userName }}>{user?.name || "User"}</p>
          <p style={{ ...styles.userRole, ...themeStyles.userRole }}>
            {user?.username ? `@${user.username}` : ROLE_LABEL[role] || "User"}
          </p>
        </div>
        <button
          style={{ ...styles.logoutBtn, ...themeStyles.logoutBtn }}
          onClick={logout}
          title="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}

export default React.memo(Sidebar);

const styles = {
  sidebar: {
    width: "var(--sidebar-w)",
    height: "100vh",
    position: "sticky",
    top: 0,
    left: 0,
    overflow: "hidden",
    alignSelf: "flex-start",
    zIndex: 20,
    display: "flex",
    flexDirection: "column",
    padding: "20px 16px",
    flexShrink: 0,
    transition: "background 0.25s ease, border-color 0.25s ease",
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
    transition: "color 0.25s ease",
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
    width: "100%",
    textAlign: "left",
    transition: "all 0.15s",
    cursor: "pointer",
  },
  navActive: {
    fontWeight: "700",
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
    borderRadius: "12px",
    border: "1px solid",
    marginTop: "auto",
    transition: "background 0.25s ease, border-color 0.25s ease",
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
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: "color 0.25s ease",
  },
  userRole: {
    fontSize: "10px",
    marginTop: "1px",
    transition: "color 0.25s ease",
  },
  logoutBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
    transition: "color 0.15s ease",
  },
};

const lightStyles = {
  sidebar: {
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border-color)",
  },
  brandText: { color: "#1e293b" },
  navItem: { color: "#64748b" },
  navActive: { background: "#e0f2fe", color: "#0284c7" },
  userSection: { background: "#f8fafc", borderColor: "#e2e8f0" },
  userName: { color: "#1e293b" },
  userRole: { color: "#94a3b8" },
  logoutBtn: { color: "#94a3b8" },
};

const darkStyles = {
  sidebar: {
    background: "var(--bg-sidebar)",
    borderRight: "1px solid var(--border-color)",
  },
  brandText: { color: "#f1f5f9" },
  navItem: { color: "#94a3b8" },
  navActive: { background: "#0c4a6e", color: "#38bdf8" },
  userSection: { background: "#111827", borderColor: "#1e293b" },
  userName: { color: "#f1f5f9" },
  userRole: { color: "#64748b" },
  logoutBtn: { color: "#64748b" },
};
