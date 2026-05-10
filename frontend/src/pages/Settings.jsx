/**
 * Settings Page
 *
 * Allows users to manage their profile, change passwords, and toggle theme.
 * Uses AuthContext for profile updates and ThemeContext for dark mode.
 */
import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  User,
  Lock,
  Palette,
  Shield,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
} from "lucide-react";

// Role labels and badge colors for the profile card
const ROLE_LABEL = { patient: "Patient", admin: "Administrator" };
const ROLE_BADGE = {
  patient: { bg: "#ede9fe", color: "#7c3aed", border: "#ddd6fe" },
  admin: { bg: "#ffe4e6", color: "#be123c", border: "#fecdd3" },
};

export default function Settings() {
  const { user, updateProfile, changePassword, syncUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState("profile");

  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    username: user?.username || "",
  });
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdMsg, setPwdMsg] = useState({ type: "", text: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const theme = isDark ? darkTheme : lightTheme;

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: "", text: "" });
    setSavingProfile(true);
    try {
      const updates = {};
      if (profileForm.name.trim()) updates.name = profileForm.name.trim();
      if (profileForm.username.trim()) updates.username = profileForm.username.trim();
      const data = await updateProfile(updates);
      if (data?.user) syncUser(data.user);
      setProfileMsg({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.response?.data?.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: "", text: "" });
    if (pwdForm.newPassword.length < 6) {
      setPwdMsg({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdMsg({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    setSavingPwd(true);
    try {
      await changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
        confirmPassword: pwdForm.confirmPassword,
      });
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwdMsg({ type: "success", text: "Password updated successfully." });
    } catch (err) {
      setPwdMsg({ type: "error", text: err.response?.data?.message || "Failed to change password." });
    } finally {
      setSavingPwd(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: <User size={16} /> },
    { id: "password", label: "Password", icon: <Lock size={16} /> },
    { id: "preferences", label: "Preferences", icon: <Palette size={16} /> },
  ];

  const renderTabContent = () => {
    if (activeTab === "profile") {
      return (
        <form onSubmit={handleProfileSave} style={styles.form}>
          <div style={styles.fieldRow}>
            <div style={{ flex: 1 }}>
              <label style={{ ...styles.label, color: theme.textMuted }}>Full Name</label>
              <input
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="Your full name"
                style={{ ...styles.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...styles.label, color: theme.textMuted }}>Username</label>
              <input
                value={profileForm.username}
                onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                placeholder="your_username"
                style={{ ...styles.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
              />
            </div>
          </div>

          <div style={styles.fieldRow}>
            <div style={{ flex: 1 }}>
              <label style={{ ...styles.label, color: theme.textMuted }}>Email</label>
              <input
                value={user?.email || ""}
                disabled
                style={{ ...styles.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMuted, opacity: 0.7, cursor: "not-allowed" }}
              />
              <span style={{ fontSize: "11px", color: theme.textMuted, marginTop: "4px", display: "block" }}>
                Contact an admin to change your email.
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...styles.label, color: theme.textMuted }}>Role</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <span
                  style={{
                    ...styles.roleBadge,
                    background: ROLE_BADGE[user?.role]?.bg,
                    color: ROLE_BADGE[user?.role]?.color,
                    border: `1px solid ${ROLE_BADGE[user?.role]?.border}`,
                  }}
                >
                  <Shield size={12} />
                  {ROLE_LABEL[user?.role] || user?.role}
                </span>
              </div>
            </div>
          </div>

          {profileMsg.text && (
            <div style={{ ...styles.alert, ...(profileMsg.type === "success" ? styles.alertSuccess : styles.alertError) }}>
              {profileMsg.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {profileMsg.text}
            </div>
          )}

          <button type="submit" disabled={savingProfile} style={styles.saveBtn}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      );
    }

    if (activeTab === "password") {
      return (
        <form onSubmit={handlePasswordSave} style={styles.form}>
          <PasswordField
            label="Current Password"
            value={pwdForm.currentPassword}
            onChange={(v) => setPwdForm({ ...pwdForm, currentPassword: v })}
            visible={showCurrent}
            toggle={() => setShowCurrent((p) => !p)}
            theme={theme}
            placeholder="Enter current password"
          />
          <PasswordField
            label="New Password"
            value={pwdForm.newPassword}
            onChange={(v) => setPwdForm({ ...pwdForm, newPassword: v })}
            visible={showNew}
            toggle={() => setShowNew((p) => !p)}
            theme={theme}
            placeholder="Min. 6 characters"
          />
          <PasswordField
            label="Confirm New Password"
            value={pwdForm.confirmPassword}
            onChange={(v) => setPwdForm({ ...pwdForm, confirmPassword: v })}
            visible={showConfirm}
            toggle={() => setShowConfirm((p) => !p)}
            theme={theme}
            placeholder="Re-enter new password"
          />

          {pwdForm.newPassword.length > 0 && (
            <div style={styles.strengthRow}>
              <div style={styles.strengthBars}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.strengthBar,
                      background:
                        pwdForm.newPassword.length >= i * 3
                          ? i === 1
                            ? "#ef4444"
                            : i === 2
                            ? "#eab308"
                            : "#22c55e"
                          : theme.inputBorder,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: "11px", color: theme.textMuted, fontWeight: 500 }}>
                {pwdForm.newPassword.length < 4 ? "Weak" : pwdForm.newPassword.length < 7 ? "Fair" : "Strong"}
              </span>
            </div>
          )}

          {pwdMsg.text && (
            <div style={{ ...styles.alert, ...(pwdMsg.type === "success" ? styles.alertSuccess : styles.alertError) }}>
              {pwdMsg.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              {pwdMsg.text}
            </div>
          )}

          <button type="submit" disabled={savingPwd} style={styles.saveBtn}>
            {savingPwd ? "Updating..." : "Update Password"}
          </button>
        </form>
      );
    }

    if (activeTab === "preferences") {
      return (
        <div style={styles.form}>
          <div style={{ ...styles.prefCard, background: theme.cardBg, borderColor: theme.borderColor }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ ...styles.prefIconWrap, background: isDark ? "#0c4a6e" : "#e0f2fe" }}>
                {isDark ? <Moon size={18} color="#38bdf8" /> : <Sun size={18} color="#0284c7" />}
              </div>
              <div>
                <p style={{ ...styles.prefTitle, color: theme.textMain }}>Appearance</p>
                <p style={{ ...styles.prefDesc, color: theme.textMuted }}>
                  {isDark ? "Dark mode is enabled" : "Light mode is enabled"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              style={{ ...styles.toggleBtn, background: isDark ? "#0c4a6e" : "#e0f2fe", color: isDark ? "#38bdf8" : "#0284c7" }}
            >
              {isDark ? "Switch to Light" : "Switch to Dark"}
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ ...styles.layout, background: theme.pageBg }}>
      <Sidebar />
      <main style={{ ...styles.main, background: theme.pageBg }}>
        <header style={styles.header}>
          <h1 style={{ ...styles.title, color: theme.textMain }}>Settings</h1>
          <p style={{ ...styles.subtitle, color: theme.textMuted }}>Manage your account and preferences</p>
        </header>

        <div style={styles.content}>
          {/* Tabs */}
          <div style={{ ...styles.tabBar, background: theme.cardBg, borderColor: theme.borderColor }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setProfileMsg({ type: "", text: "" });
                    setPwdMsg({ type: "", text: "" });
                  }}
                  style={{
                    ...styles.tab,
                    color: active ? "var(--primary)" : theme.textMuted,
                    background: active ? (isDark ? "#0c4a6e" : "#e0f2fe") : "transparent",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Panel */}
          <div style={{ ...styles.panel, background: theme.cardBg, borderColor: theme.borderColor }}>
            <h2 style={{ ...styles.panelTitle, color: theme.textMain }}>
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

function PasswordField({ label, value, onChange, visible, toggle, theme, placeholder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ ...styles.label, color: theme.textMuted }}>{label}</label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...styles.input, paddingRight: "42px", background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
        />
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            color: "#94a3b8",
          }}
        >
          {visible ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

const lightTheme = {
  pageBg: "#f8fafc",
  cardBg: "#ffffff",
  textMain: "#0f172a",
  textMuted: "#64748b",
  borderColor: "#e2e8f0",
  inputBg: "#fafafa",
  inputBorder: "#e2e8f0",
};

const darkTheme = {
  pageBg: "#0b1221",
  cardBg: "#111827",
  textMain: "#f1f5f9",
  textMuted: "#94a3b8",
  borderColor: "#1e293b",
  inputBg: "#0f172a",
  inputBorder: "#1e293b",
};

const styles = {
  layout: { display: "flex", minHeight: "100vh", transition: "background 0.25s ease" },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px 28px",
    minWidth: 0,
    transition: "background 0.25s ease",
  },
  header: { flexShrink: 0 },
  title: { fontFamily: "Lora, serif", fontSize: "22px", fontWeight: "600", marginBottom: "4px", transition: "color 0.25s ease" },
  subtitle: { fontSize: "13px", transition: "color 0.25s ease" },
  content: { display: "flex", flexDirection: "column", gap: "14px", flex: 1, minHeight: 0, overflow: "auto" },
  tabBar: {
    display: "flex",
    gap: "6px",
    padding: "5px",
    borderRadius: "12px",
    border: "1px solid",
    flexShrink: 0,
    transition: "background 0.25s ease, border-color 0.25s ease",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    borderRadius: "9px",
    border: "none",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    transition: "all 0.15s",
  },
  panel: {
    border: "1px solid",
    borderRadius: "16px",
    padding: "28px",
    flex: 1,
    overflow: "auto",
    transition: "background 0.25s ease, border-color 0.25s ease",
  },
  panelTitle: {
    fontFamily: "Lora, serif",
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "22px",
    transition: "color 0.25s ease",
  },
  form: { display: "flex", flexDirection: "column", gap: "18px", maxWidth: "720px" },
  fieldRow: { display: "flex", gap: "16px", flexWrap: "wrap" },
  label: { fontSize: "11.5px", fontWeight: "600", letterSpacing: "0.3px", marginBottom: "2px" },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid",
    borderRadius: "10px",
    fontSize: "13px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s, background 0.25s ease",
    fontFamily: "Nunito, sans-serif",
    boxSizing: "border-box",
  },
  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
  },
  saveBtn: {
    alignSelf: "flex-start",
    padding: "10px 20px",
    background: "linear-gradient(135deg, var(--primary) 0%, var(--teal) 100%)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    marginTop: "4px",
  },
  alert: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "10px",
    fontSize: "12.5px",
    fontWeight: "500",
  },
  alertSuccess: { background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.22)", color: "#22c55e" },
  alertError: { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#ef4444" },
  strengthRow: { display: "flex", alignItems: "center", gap: "8px" },
  strengthBars: { display: "flex", gap: "4px" },
  strengthBar: { width: "28px", height: "3px", borderRadius: "4px", transition: "background 0.3s" },
  prefCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "18px 20px",
    borderRadius: "14px",
    border: "1px solid",
    flexWrap: "wrap",
    transition: "background 0.25s ease, border-color 0.25s ease",
  },
  prefIconWrap: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prefTitle: { fontSize: "14px", fontWeight: "600", transition: "color 0.25s ease" },
  prefDesc: { fontSize: "12px", marginTop: "2px", transition: "color 0.25s ease" },
  toggleBtn: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "none",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "Nunito, sans-serif",
    whiteSpace: "nowrap",
  },
};
