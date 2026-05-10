/**
 * Auth Page (Login)
 *
 * Handles user authentication with:
 * - Email or username login
 * - Password visibility toggle
 * - Role-based redirect after successful login
 * - Theme-aware styling
 * - Compact, responsive layout
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, getRoleHome } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { validatePassword, calculatePasswordStrength, getPasswordRequirements, getStrengthColor } from "../utils/passwordValidation";

// Decorative medical-themed SVG icons for the login screen
const ShieldIcon = ({ style }) => (
  <svg style={style} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const HeartIcon = ({ style }) => (
  <svg style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const ActivityIcon = ({ style }) => (
  <svg style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const StethIcon = ({ style }) => (
  <svg style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a8 8 0 0 0 16 0V4a2 2 0 0 0-2-2h-1a.2.2 0 0 0 0 .3" />
    <path d="M8 15v1a6 6 0 0 0 6 6" />
    <path d="M20 16.5A6.5 6.5 0 0 1 13.5 23" />
  </svg>
);

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: "weak" });
  const [passwordErrors, setPasswordErrors] = useState([]);
  const { isDark } = useTheme();
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Fix body overflow on mount and cleanup
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.boxSizing = "border-box";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.boxSizing = "border-box";
    return () => {
      document.body.style.overflow = "";
      document.body.style.boxSizing = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.boxSizing = "";
    };
  }, []);

  const handle = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
    
    // Real-time password strength validation for registration
    if (e.target.name === "password" && mode === "register") {
      const strength = calculatePasswordStrength(e.target.value);
      setPasswordStrength(strength);
      
      const validation = validatePassword(e.target.value);
      setPasswordErrors(validation.errors);
    }
  };

  const validate = () => {
    if (mode === "register" && !form.name.trim()) {
      setError("Full name is required");
      return false;
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (mode === "register") {
      if (!form.username.trim()) { setError("Username is required"); return false; }
      if (!usernameRegex.test(form.username.trim())) {
        setError("Username may only contain letters, numbers, and underscores");
        return false;
      }
      if (!form.email.trim()) { setError("Email is required"); return false; }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email)) { setError("Enter a valid email address"); return false; }
    } else {
      if (!form.email.trim()) { setError("Enter your email or username"); return false; }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmail = emailRegex.test(form.email);
      const isUsername = usernameRegex.test(form.email.trim());
      if (!isEmail && !isUsername) { setError("Enter a valid email or username"); return false; }
    }
    if (!form.password) { setError("Password is required"); return false; }
    
    // Use new password validation for registration
    if (mode === "register") {
      const passwordValidation = validatePassword(form.password);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.errors[0]);
        return false;
      }
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
          form.name.trim(), form.username.trim(), form.email.trim(), form.password, "patient", null
        );
      }
      navigate(getRoleHome(loggedInUser?.role));
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setForm({ name: "", username: "", email: "", password: "" });
    setShowPassword(false);
    setPasswordStrength({ score: 0, label: "weak" });
    setPasswordErrors([]);
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <div className="auth-page" style={{ ...styles.page, background: theme.pageBg }}>
      {/* ── LEFT PANEL ── */}
      <div className="auth-left-panel" style={styles.left}>
        {/* Animated gradient mesh background */}
        <div style={styles.leftGradients} aria-hidden="true" />
        <div style={styles.leftOverlay} aria-hidden="true" />
        <div style={styles.leftDots} aria-hidden="true" />

        {/* Decorative ambient ring */}
        <div style={styles.ambientRing} aria-hidden="true" />
        <div style={styles.ambientRingInner} aria-hidden="true" />

        {/* ECG wave at bottom */}
        <svg className="auth-ecg" style={styles.ecgSvg} viewBox="0 0 800 120" fill="none" preserveAspectRatio="none">
          <path
            d="M0 60 H180 L200 20 L230 100 L260 60 H320 L340 30 L370 90 L400 60 H800"
            stroke="rgba(255,255,255,0.22)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.35))" }}
          />
        </svg>

        <div className="auth-left-content" style={styles.leftContent}>
          <div style={styles.logoWrap}>
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <path d="M6 18h6l3-9 5 18 3-9h7" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 style={styles.brandName}>Pulse Prophet</h1>
          <p style={styles.tagline}>
            Predicting health risks, empowering better care.
          </p>

          <div style={styles.dividerLine} />
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right" style={{ ...styles.right, background: theme.rightBg }}>
        <div className="auth-card" style={{ ...styles.card, background: theme.cardBg, boxShadow: theme.cardShadow }}>
          <div style={styles.cardLogo}>
            <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
              <path d="M6 18h6l3-9 5 18 3-9h7" stroke="var(--primary)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ ...styles.cardLogoText, color: "var(--primary)" }}>Pulse Prophet</span>
          </div>

          <h2 style={{ ...styles.cardTitle, color: theme.textMain }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p style={{ ...styles.cardSub, color: theme.textMuted }}>
            {mode === "login"
              ? "Enter your credentials to continue"
              : "Fill in the details below to get started"}
          </p>

          <div style={{ ...styles.toggle, background: theme.toggleBg }}>
            <button
              type="button"
              style={{
                ...styles.toggleBtn,
                color: theme.toggleText,
                ...(mode === "login" ? { background: theme.toggleActiveBg, color: theme.toggleActiveText, boxShadow: theme.toggleActiveShadow, fontWeight: 700 } : {}),
              }}
              onClick={() => mode !== "login" && switchMode()}
            >
              Sign In
            </button>
            <button
              type="button"
              style={{
                ...styles.toggleBtn,
                color: theme.toggleText,
                ...(mode === "register" ? { background: theme.toggleActiveBg, color: theme.toggleActiveText, boxShadow: theme.toggleActiveShadow, fontWeight: 700 } : {}),
              }}
              onClick={() => mode !== "register" && switchMode()}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={submit} style={styles.form} noValidate>
            {mode === "register" && (
              <>
                <Field label="Full Name" icon={<UserIcon />}>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handle}
                    placeholder="e.g. Juan Dela Cruz"
                    style={{ ...styles.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Username" icon={<AtIcon />}>
                  <input
                    name="username"
                    value={form.username}
                    onChange={handle}
                    placeholder="e.g. juan_dela_cruz"
                    style={{ ...styles.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
                    autoComplete="username"
                    inputMode="text"
                  />
                </Field>
              </>
            )}

            <Field label={mode === "login" ? "Email or Username" : "Email Address"} icon={<MailIcon />}>
              <input
                name="email"
                type={mode === "login" ? "text" : "email"}
                value={form.email}
                onChange={handle}
                placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"}
                style={{ ...styles.input, background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
                autoComplete={mode === "login" ? "username" : "email"}
              />
            </Field>

            <Field label="Password" icon={<LockIcon />}>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handle}
                placeholder={mode === "login" ? "••••••••" : "Create a password"}
                style={{ ...styles.input, paddingRight: "42px", background: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMain }}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                style={{ ...styles.eyeBtn, opacity: form.password.length > 0 ? 1 : 0, pointerEvents: form.password.length > 0 ? "auto" : "none" }}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeClosed /> : <EyeOpen />}
              </button>
            </Field>

            {mode === "register" && form.password.length > 0 && (
              <div style={styles.strengthRow}>
                <div style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      style={{ 
                        ...styles.strengthBar, 
                        background: passwordStrength.score >= i * 25 ? getStrengthColor(passwordStrength.label) : theme.inputBorder 
                      }} 
                    />
                  ))}
                </div>
                <span style={{ ...styles.strengthLabel, color: getStrengthColor(passwordStrength.label) }}>
                  {passwordStrength.label.charAt(0).toUpperCase() + passwordStrength.label.slice(1)}
                </span>
              </div>
            )}

            {mode === "register" && form.password.length > 0 && (
              <div style={{ ...styles.requirementsBox, background: theme.inputBg, borderColor: theme.inputBorder }}>
                <div style={styles.requirementsGrid}>
                  {getPasswordRequirements().map((req, index) => {
                    const validation = validatePassword(form.password);
                    const isMet = validation.isValid || !validation.errors.some(err => err.toLowerCase().includes(req.toLowerCase().split(' ')[0]));
                    return (
                      <div key={index} style={{ ...styles.requirementItem, color: isMet ? "var(--success, #10b981)" : theme.textMuted }}>
                        <span style={{ marginRight: "4px" }}>{isMet ? "✓" : "○"}</span>
                        <span style={{ fontSize: "10px" }}>{req}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" style={{ ...styles.errorBox, animation: "shake 0.4s ease" }}>
                <span style={styles.errorIcon} aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "register" && passwordErrors.length > 0)}
              style={{ 
                ...styles.submitBtn, 
                opacity: loading || (mode === "register" && passwordErrors.length > 0) ? 0.6 : 1, 
                cursor: loading || (mode === "register" && passwordErrors.length > 0) ? "not-allowed" : "pointer" 
              }}
            >
              {loading ? (
                <span style={styles.btnInner}>
                  <span style={styles.btnSpinner} />
                  Please wait...
                </span>
              ) : (
                <span style={styles.btnInner}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </span>
              )}
            </button>
          </form>

          <p style={{ ...styles.switchText, color: theme.textMuted }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span style={{ ...styles.switchLink, color: "var(--primary)" }} onClick={switchMode}>
              {mode === "login" ? "Sign up free" : "Sign in"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Inline icon components ── */
function Field({ label, icon, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputWrap}>
        <span style={styles.inputIcon}>{icon}</span>
        {children}
      </div>
    </div>
  );
}
function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function AtIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 3 3" /><path d="M16 12h.01" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeClosed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Theme objects ── */
const lightTheme = {
  pageBg: "#f8fafc",
  rightBg: "#f1f5f9",
  cardBg: "#ffffff",
  cardShadow: "0 10px 48px rgba(0,0,0,0.11)",
  textMain: "#0f172a",
  textMuted: "#64748b",
  toggleBg: "#f1f5f9",
  toggleText: "#64748b",
  toggleActiveBg: "#ffffff",
  toggleActiveText: "#0ea5e9",
  toggleActiveShadow: "0 2px 10px rgba(0,0,0,0.08)",
  inputBg: "#fafafa",
  inputBorder: "#e2e8f0",
};

const darkTheme = {
  pageBg: "#0b1221",
  rightBg: "#0b1221",
  cardBg: "#111827",
  cardShadow: "0 10px 48px rgba(0,0,0,0.35)",
  textMain: "#f1f5f9",
  textMuted: "#94a3b8",
  toggleBg: "#1e293b",
  toggleText: "#94a3b8",
  toggleActiveBg: "#0f172a",
  toggleActiveText: "#38bdf8",
  toggleActiveShadow: "0 2px 10px rgba(0,0,0,0.25)",
  inputBg: "#0f172a",
  inputBorder: "#1e293b",
};

/* ── Styles ── */
const styles = {
  page: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    fontFamily: "Nunito, sans-serif",
    transition: "background 0.25s ease",
    boxSizing: "border-box",
  },
  left: {
    flex: "0 0 38%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "32px 36px",
    color: "white",
    position: "relative",
    overflow: "hidden",
    background: "#0c2d3b",
    minWidth: "280px",
    boxSizing: "border-box",
  },
  leftGradients: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse 80% 60% at 20% 30%, rgba(14,165,233,0.35) 0%, transparent 60%)," +
      "radial-gradient(ellipse 60% 50% at 80% 70%, rgba(13,148,136,0.30) 0%, transparent 55%)," +
      "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(56,189,248,0.18) 0%, transparent 50%)," +
      "linear-gradient(160deg, #0b1d2e 0%, #0c3a4d 40%, #0d5a66 70%, #0b2f3a 100%)",
    animation: "iridescenceShift 16s ease-in-out infinite alternate",
    backgroundSize: "200% 200%",
    pointerEvents: "none",
    zIndex: 0,
  },
  leftOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(12,45,59,0.2) 0%, rgba(12,45,59,0) 30%, rgba(12,45,59,0) 70%, rgba(12,45,59,0.35) 100%)",
    pointerEvents: "none",
    zIndex: 1,
  },
  leftDots: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
    pointerEvents: "none",
    zIndex: 1,
  },
  ambientRing: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "420px",
    height: "420px",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    border: "1px solid rgba(255,255,255,0.06)",
    pointerEvents: "none",
    zIndex: 1,
    animation: "softFloat 8s ease-in-out infinite",
  },
  ambientRingInner: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "280px",
    height: "280px",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    border: "1px solid rgba(255,255,255,0.09)",
    pointerEvents: "none",
    zIndex: 1,
    animation: "softFloat 10s ease-in-out infinite reverse",
  },
  ecgSvg: {
    position: "absolute",
    bottom: "8%",
    left: "-5%",
    right: "-5%",
    width: "110%",
    height: "140px",
    pointerEvents: "none",
    zIndex: 1,
    opacity: 0.45,
  },
  leftContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
    position: "relative",
    zIndex: 3,
    maxWidth: "360px",
  },
  logoWrap: {
    width: "52px",
    height: "52px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
    backdropFilter: "blur(12px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  brandName: {
    fontFamily: "Lora, serif",
    fontSize: "32px",
    fontWeight: "600",
    marginBottom: "10px",
    letterSpacing: "-0.3px",
    lineHeight: 1.15,
    textShadow: "0 2px 12px rgba(0,0,0,0.2)",
  },
  tagline: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "14px",
    lineHeight: "1.6",
    opacity: 0.82,
    marginBottom: "20px",
    maxWidth: "320px",
    color: "rgba(255,255,255,0.85)",
  },
  dividerLine: {
    width: "36px",
    height: "2px",
    background: "rgba(255,255,255,0.25)",
    borderRadius: "10px",
    marginBottom: "0px",
  },
  right: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    transition: "background 0.25s ease",
    overflow: "hidden",
  },
  card: {
    borderRadius: "18px",
    padding: "28px 26px",
    width: "100%",
    maxWidth: "400px",
    maxHeight: "calc(100vh - 40px)",
    overflowY: "auto",
    transition: "background 0.25s ease, box-shadow 0.25s ease",
    animation: "fadeInUp 0.6s ease both",
    boxSizing: "border-box",
  },
  cardLogo: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "16px",
  },
  cardLogoText: {
    fontFamily: "Lora, serif",
    fontSize: "14px",
    fontWeight: "600",
  },
  cardTitle: {
    fontFamily: "Lora, serif",
    fontSize: "22px",
    fontWeight: "600",
    marginBottom: "4px",
    transition: "color 0.25s ease",
  },
  cardSub: {
    fontFamily: "Nunito, sans-serif",
    fontSize: "12px",
    marginBottom: "20px",
    transition: "color 0.25s ease",
  },
  toggle: {
    display: "flex",
    borderRadius: "10px",
    padding: "3px",
    marginBottom: "20px",
    gap: "3px",
    transition: "background 0.25s ease",
  },
  toggleBtn: {
    flex: 1,
    padding: "7px",
    border: "none",
    background: "transparent",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "Nunito, sans-serif",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: "0.2px",
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "11px",
    display: "flex",
    alignItems: "center",
    pointerEvents: "none",
    zIndex: 1,
  },
  input: {
    width: "100%",
    padding: "9px 12px 9px 34px",
    border: "1.5px solid",
    borderRadius: "9px",
    fontSize: "12px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s, background 0.25s ease",
    fontFamily: "Nunito, sans-serif",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
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
    gap: "6px",
    marginTop: "2px",
  },
  strengthBars: {
    display: "flex",
    gap: "3px",
  },
  strengthBar: {
    width: "24px",
    height: "3px",
    borderRadius: "4px",
    transition: "background 0.3s",
  },
  strengthLabel: {
    fontSize: "9px",
    fontWeight: "500",
  },
  requirementsBox: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid",
    marginTop: "2px",
    transition: "background 0.25s ease, border-color 0.25s ease",
  },
  requirementsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "4px 8px",
  },
  requirementItem: {
    fontSize: "10px",
    display: "flex",
    alignItems: "center",
    lineHeight: "1.3",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.22)",
    color: "#ef4444",
    padding: "8px 10px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "500",
  },
  errorIcon: {
    fontSize: "12px",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
  },
  submitBtn: {
    padding: "10px",
    background: "linear-gradient(135deg, var(--primary) 0%, var(--teal) 100%)",
    color: "white",
    border: "none",
    borderRadius: "9px",
    fontSize: "13px",
    fontWeight: "600",
    letterSpacing: "0.2px",
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
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTop: "2px solid white",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },
  switchText: {
    textAlign: "center",
    marginTop: "16px",
    fontSize: "11px",
    fontFamily: "Nunito, sans-serif",
    transition: "color 0.25s ease",
  },
  switchLink: {
    fontWeight: "700",
    cursor: "pointer",
  },
};

/* Responsive styles injected as a global stylesheet */
const RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .auth-left-panel { flex: 0 0 35% !important; padding: 28px 24px !important; }
    .auth-card { padding: 24px 22px !important; }
  }
  @media (max-width: 768px) {
    .auth-page { flex-direction: column !important; overflow: auto !important; height: auto !important; min-height: 100vh !important; }
    .auth-left-panel {
      flex: none !important;
      min-height: 200px !important;
      padding: 24px 20px !important;
      align-items: center !important;
      text-align: center !important;
      justify-content: center !important;
    }
    .auth-left-content { align-items: center !important; margin: 0 auto !important; }
    .auth-ecg { display: none !important; }
    .auth-right { padding: 20px 16px !important; min-height: auto !important; }
    .auth-card { padding: 24px 20px !important; max-width: 100% !important; }
  }
`;

if (typeof document !== "undefined") {
  let tag = document.getElementById("auth-responsive-styles");
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "auth-responsive-styles";
    tag.textContent = RESPONSIVE_CSS;
    document.head.appendChild(tag);
  }
}

