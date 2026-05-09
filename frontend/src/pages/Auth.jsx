import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, getRoleHome } from "../context/AuthContext";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handle = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const validate = () => {
    if (mode === "register" && !form.name.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!form.email.trim()) {
      setError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Enter a valid email address");
      return false;
    }
    if (!form.password) {
      setError("Password is required");
      return false;
    }
    if (mode === "register" && form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      let loggedInUser;
      if (mode === "login") {
        loggedInUser = await login(form.email.trim(), form.password);
      } else {
        loggedInUser = await register(
          form.name.trim(),
          form.email.trim(),
          form.password,
          "patient",
          null
        );
      }
      navigate(getRoleHome(loggedInUser?.role));
    } catch (error) {
      setError(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setForm({ name: "", email: "", password: "" });
    setShowPassword(false);
  };

  const EyeOpen = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeClosed = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
               a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8
               a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.pulseVisual} aria-hidden="true">
          <span style={styles.pulseRingLarge} />
          <span style={styles.pulseRingMedium} />
          <span style={styles.pulseCore} />
        </div>
        <div style={styles.leftOverlay} />
        <div style={styles.leftContent}>
          <div style={styles.logoWrap}>
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <path
                d="M6 18h6l3-9 5 18 3-9h7"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 style={styles.brandName}>Pulse Prophet</h1>
          <p style={styles.tagline}>
            Predicting health risks,<br />
            empowering better care.
          </p>
          <div style={styles.dividerLine} />
          <div style={styles.infoCards}>
            <div style={styles.infoCard}>
              <span style={styles.infoIcon}>AD</span>
              <div>
                <p style={styles.infoTitle}>For Administrators</p>
                <p style={styles.infoDesc}>
                  Manage users, review patients, and run risk assessments
                </p>
              </div>
            </div>
            <div style={styles.infoCard}>
              <span style={styles.infoIcon}>PT</span>
              <div>
                <p style={styles.infoTitle}>For Patients</p>
                <p style={styles.infoDesc}>
                  View your own health data and risk profile
                </p>
              </div>
            </div>
          </div>
        </div>
        <p style={styles.leftFooter}>
          © 2025 Pulse Prophet · Healthcare System
        </p>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardLogo}>
            <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
              <path
                d="M6 18h6l3-9 5 18 3-9h7"
                stroke="#0ea5e9"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={styles.cardLogoText}>Pulse Prophet</span>
          </div>

          <h2 style={styles.cardTitle}>
            {mode === "login" ? "Sign in" : "Create account"}
          </h2>
          <p style={styles.cardSub}>
            {mode === "login"
              ? "Enter your credentials to continue"
              : "Fill in the details below to get started"}
          </p>

          <div style={styles.toggle}>
            <button
              type="button"
              style={{
                ...styles.toggleBtn,
                ...(mode === "login" ? styles.toggleActive : {}),
              }}
              onClick={() => mode !== "login" && switchMode()}
            >
              Login
            </button>
            <button
              type="button"
              style={{
                ...styles.toggleBtn,
                ...(mode === "register" ? styles.toggleActive : {}),
              }}
              onClick={() => mode !== "register" && switchMode()}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={submit} style={styles.form} noValidate>
            {mode === "register" && (
              <div style={styles.field}>
                <label style={styles.label}>Full Name</label>
                <div style={styles.inputWrap}>
                  <span style={styles.inputIcon}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handle}
                    placeholder="e.g. Juan Dela Cruz"
                    style={styles.input}
                    autoComplete="name"
                  />
                </div>
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Email Address</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12
                             c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6
                             c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handle}
                  placeholder="you@example.com"
                  style={styles.input}
                  autoComplete="email"
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11"
                      rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handle}
                  placeholder={mode === "login" ? "••••••••" : "Min. 6 characters"}
                  style={{ ...styles.input, paddingRight: "42px" }}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
                <button
                  type="button"
                  style={{
                    ...styles.eyeBtn,
                    opacity: form.password.length > 0 ? 1 : 0,
                    pointerEvents: form.password.length > 0 ? "auto" : "none",
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeClosed /> : <EyeOpen />}
                </button>
              </div>
              {mode === "register" && form.password.length > 0 && (
                <div style={styles.strengthRow}>
                  <div style={styles.strengthBars}>
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.strengthBar,
                          background:
                            form.password.length >= i * 3
                              ? i === 1
                                ? "#ef4444"
                                : i === 2
                                ? "#eab308"
                                : "#22c55e"
                              : "#e2e8f0",
                        }}
                      />
                    ))}
                  </div>
                  <span style={styles.strengthLabel}>
                    {form.password.length < 4
                      ? "Weak"
                      : form.password.length < 7
                      ? "Fair"
                      : "Strong"}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span style={styles.errorIcon}>!</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.75 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              disabled={loading}
            >
              {loading ? (
                <span style={styles.btnInner}>
                  <span style={styles.btnSpinner} />
                  Please wait...
                </span>
              ) : (
                <span style={styles.btnInner}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <span style={{ marginLeft: "6px" }}>→</span>
                </span>
              )}
            </button>
          </form>

          <p style={styles.switchText}>
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <span style={styles.switchLink} onClick={switchMode}>
              {mode === "login" ? "Sign up free" : "Sign in"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    fontFamily: "Nunito, sans-serif",
  },
  left: {
    flex: "0 0 44%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "48px 44px",
    color: "white",
    position: "relative",
    overflow: "hidden",
    background: "#0f4f66",
  },
  pulseVisual: {
    position: "absolute",
    right: "-70px",
    top: "50%",
    width: "430px",
    height: "430px",
    borderRadius: "50%",
    transform: "translateY(-50%)",
    opacity: 0.78,
    pointerEvents: "none",
    animation: "softFloat 9s ease-in-out infinite",
  },
  pulseRingLarge: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.34)",
    background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 58%, rgba(255,255,255,0) 70%)",
  },
  pulseRingMedium: {
    position: "absolute",
    inset: "74px",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.08)",
  },
  pulseCore: {
    position: "absolute",
    inset: "168px",
    borderRadius: "50%",
    background: "#ffffff",
    boxShadow: "0 0 42px rgba(255,255,255,0.46)",
  },
  leftOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(125deg, rgba(14,165,233,0.46), rgba(13,148,136,0.50), rgba(56,189,248,0.40), rgba(20,184,166,0.42))",
    pointerEvents: "none",
  },
  leftContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
    position: "relative",
    zIndex: 1,
  },
  logoWrap: {
    width: "58px", height: "58px",
    background: "rgba(255,255,255,0.15)",
    borderRadius: "18px",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "22px",
    backdropFilter: "blur(6px)",
  },
  brandName: {
    fontFamily: "Lora, serif",
    fontSize: "32px",
    fontWeight: "600",
    marginBottom: "10px",
    letterSpacing: "-0.3px",
  },
  tagline: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "16px",
    lineHeight: "1.6",
    opacity: 0.88,
    marginBottom: "32px",
  },
  dividerLine: {
    width: "48px", height: "3px",
    background: "rgba(255,255,255,0.3)",
    borderRadius: "10px",
    marginBottom: "28px",
  },
  infoCards: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  infoCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    background: "rgba(255,255,255,0.20)",
    border: "1px solid rgba(255,255,255,0.24)",
    borderRadius: "14px",
    padding: "14px 16px",
    backdropFilter: "blur(7px)",
    boxShadow: "0 8px 22px rgba(7, 48, 71, 0.22)",
  },
  infoIcon: { fontSize: "22px", lineHeight: 1, marginTop: "1px" },
  infoTitle: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "13px",
    fontWeight: "700",
    marginBottom: "3px",
  },
  infoDesc: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "12px",
    opacity: 0.8,
    lineHeight: "1.4",
  },
  leftFooter: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "11px",
    opacity: 0.5,
    position: "relative",
    zIndex: 1,
  },
  right: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    padding: "24px",
  },
  card: {
    background: "white",
    borderRadius: "22px",
    boxShadow: "0 10px 48px rgba(0,0,0,0.11)",
    padding: "38px 36px",
    width: "100%",
    maxWidth: "400px",
  },
  cardLogo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "20px",
  },
  cardLogoText: {
    fontFamily: "Lora, serif",
    fontSize: "15px",
    fontWeight: "600",
    color: "#0ea5e9",
  },
  cardTitle: {
    fontFamily: "Lora, serif",
    fontSize: "24px",
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: "5px",
  },
  cardSub: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "13px",
    color: "#64748b",
    marginBottom: "22px",
  },
  toggle: {
    display: "flex",
    background: "#f1f5f9",
    borderRadius: "12px",
    padding: "4px",
    marginBottom: "24px",
    gap: "4px",
  },
  toggleBtn: {
    flex: 1,
    padding: "9px",
    border: "none",
    background: "transparent",
    borderRadius: "9px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "Nunito, sans-serif",
  },
  toggleActive: {
    background: "white",
    color: "#0ea5e9",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
    fontWeight: "700",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "11.5px",
    fontWeight: "600",
    color: "#374151",
    letterSpacing: "0.3px",
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "13px",
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
    zIndex: 1,
  },
  input: {
    width: "100%",
    padding: "11px 14px 11px 38px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "11px",
    fontSize: "13px",
    color: "#0f172a",
    outline: "none",
    background: "#fafafa",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "Nunito, sans-serif",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    borderRadius: "6px",
    transition: "opacity 0.2s",
    zIndex: 1,
  },
  strengthRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
  },
  strengthBars: {
    display: "flex",
    gap: "4px",
  },
  strengthBar: {
    width: "28px",
    height: "3px",
    borderRadius: "4px",
    transition: "background 0.3s",
  },
  strengthLabel: {
    fontSize: "10px",
    color: "#64748b",
    fontWeight: "500",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: "10px",
    fontSize: "12.5px",
    fontWeight: "500",
  },
  errorIcon: { fontSize: "13px", flexShrink: 0 },
  submitBtn: {
    padding: "13px",
    background: "linear-gradient(135deg, #0ea5e9 0%, #0d9488 100%)",
    color: "white",
    border: "none",
    borderRadius: "11px",
    fontSize: "14px",
    fontWeight: "600",
    letterSpacing: "0.3px",
    transition: "opacity 0.2s, transform 0.15s",
    fontFamily: "Nunito, sans-serif",
    marginTop: "2px",
  },
  btnInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  btnSpinner: {
    width: "14px", height: "14px",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },
  switchText: {
    textAlign: "center",
    marginTop: "20px",
    fontSize: "12.5px",
    color: "#64748b",
    fontFamily: "Nunito, sans-serif",
  },
  switchLink: {
    color: "#0ea5e9",
    fontWeight: "700",
    cursor: "pointer",
  },
};

if (typeof document !== "undefined" && !document.getElementById("auth-soft-float-keyframes")) {
  const style = document.createElement("style");
  style.id = "auth-soft-float-keyframes";
  style.innerHTML = `
    @keyframes softFloat {
      0% { transform: translateY(-50%) translateX(0px); }
      50% { transform: translateY(calc(-50% - 8px)) translateX(-6px); }
      100% { transform: translateY(-50%) translateX(0px); }
    }
  `;
  document.head.appendChild(style);
}
