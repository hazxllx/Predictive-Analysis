import React, { useEffect, useMemo, useState } from "react";
import { Activity, Cigarette, Salad, Wine } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import { normalizePatientResponse } from "../utils/normalizePatients";
import { invalidateCachedQuery, setCachedQuery } from "../api/queryCache";

const LIFESTYLE_ICON_MAP = {
  smoking: Cigarette,
  alcohol: Wine,
  diet: Salad,
  activity: Activity,
};

const PROCESSING_MESSAGES = [
  "Evaluating medical history...",
  "Processing lifestyle data...",
  "Generating recommendations...",
];

export default function AssessmentExecution() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPatient = async () => {
      try {
        const { data } = await api.get(`/patients/${id}`);
        const normalized = normalizePatientResponse(data);
        setPatient(normalized);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load patient.");
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [id]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
    }, 600);
    return () => clearInterval(timer);
  }, [running]);

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

  const conditions = useMemo(
    () =>
      Array.isArray(patient?.condition_categories) && patient.condition_categories.length > 0
        ? patient.condition_categories.slice(0, 4)
        : patient?.medical_summaries?.slice(0, 4) || [],
    [patient]
  );

  const lifestyleIndicators = useMemo(() => getLifestyleIndicators(patient), [patient]);
  const vitals = useMemo(() => Object.entries(patient?.vitals || {}), [patient?.vitals]);

  const runAssessment = async () => {
    setRunning(true);
    setError("");
    try {
      const { data } = await api.post("/api/v1/predictive-analysis/risk-assessment", { patient_id: id });
      setCachedQuery(["assessment", id], data);
      invalidateCachedQuery(["patients"]);
      await wait(1200);
      navigate(`/patients/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Assessment failed.");
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <main style={styles.mainCentered}>
          <div style={styles.spinner} />
          <p style={styles.centerTitle}>Loading assessment context...</p>
        </main>
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <main style={styles.mainCentered}>
          <p style={styles.errorText}>{error || "Patient not found."}</p>
          <button style={styles.secondaryBtn} onClick={() => navigate("/patients")}>
            Back to Patients
          </button>
        </main>
      </div>
    );
  }

  if (running) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <main style={styles.mainCentered}>
          <div style={styles.spinnerLarge} />
          <h2 style={styles.processingTitle}>Analyzing patient risk profile...</h2>
          <p style={styles.processingSub}>{PROCESSING_MESSAGES[messageIndex]}</p>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <header style={styles.header}>
          <button style={styles.secondaryBtn} onClick={() => navigate(`/patients/${id}`)}>
            {"<- Back"}
          </button>
          <div style={styles.identity}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <h1 style={styles.pageTitle}>{patient.name}</h1>
              <p style={styles.pageSubtitle}>
                {[patient.patient_id, patient.age !== null ? `${patient.age}y` : null, patient.gender]
                  .filter(Boolean)
                  .join(" | ")}
              </p>
            </div>
          </div>
        </header>

        <section style={styles.summaryCard}>
          <h2 style={styles.cardTitle}>Patient Summary</h2>

          <div style={styles.summarySection}>
            <p style={styles.sectionLabel}>Conditions</p>
            <div style={styles.chips}>
              {conditions.length > 0 ? (
                conditions.map((condition) => (
                  <span key={condition} style={styles.chip}>
                    {condition}
                  </span>
                ))
              ) : (
                <span style={styles.emptyText}>No conditions on record</span>
              )}
            </div>
          </div>

          <div style={styles.summarySection}>
            <p style={styles.sectionLabel}>Lifestyle</p>
            <div style={styles.indicators}>
              {lifestyleIndicators.map((item) => {
                const Icon = LIFESTYLE_ICON_MAP[item.type];
                return (
                  <span key={item.label} style={{ ...styles.indicator, ...toneStyle(item.tone) }}>
                    <Icon size={14} />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={styles.summarySection}>
            <p style={styles.sectionLabel}>Vitals</p>
            {vitals.length > 0 ? (
              <p style={styles.vitalsText}>
                {vitals.map(([key, value]) => `${formatKey(key)}: ${value}`).join(" | ")}
              </p>
            ) : (
              <p style={styles.emptyText}>No vitals available</p>
            )}
          </div>
        </section>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <div style={styles.actions}>
          <button style={styles.primaryBtn} onClick={runAssessment}>
            Run Assessment
          </button>
        </div>
      </main>
    </div>
  );
}

function getLifestyleIndicators(patient) {
  const lifestyle = patient?.lifestyle || {};
  const indicators = [];

  if (lifestyle.smoking !== undefined) {
    indicators.push({ type: "smoking", label: `Smoking: ${lifestyle.smoking ? "Yes" : "No"}`, tone: "warm" });
  }
  if (lifestyle.alcohol !== undefined) {
    indicators.push({ type: "alcohol", label: `Alcohol: ${lifestyle.alcohol ? "Yes" : "No"}`, tone: "accent" });
  }
  if (lifestyle.diet) {
    indicators.push({ type: "diet", label: `Diet: ${lifestyle.diet}`, tone: "neutral" });
  }
  if (lifestyle.physical_activity) {
    indicators.push({
      type: "activity",
      label: `Physical Activity: ${lifestyle.physical_activity}`,
      tone: "neutral",
    });
  }

  return indicators;
}

function formatKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toneStyle(tone) {
  if (tone === "warm") return { color: "#c2410c" };
  if (tone === "accent") return { color: "#d97706" };
  return { color: "#475569" };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = {
  layout: { display: "flex", height: "100vh", overflow: "hidden", background: "#f7fbfd" },
  main: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "18px 22px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  mainCentered: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
  },
  header: {
    background: "#fff",
    border: "1px solid #dbe7ee",
    borderRadius: "14px",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  identity: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    background: "#eef9fb",
    color: "#1696a7",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { margin: 0, fontSize: "20px", color: "#123447" },
  pageSubtitle: { margin: "2px 0 0 0", fontSize: "12px", color: "#6b8799" },
  summaryCard: {
    background: "#fff",
    border: "1px solid #dbe7ee",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  cardTitle: { margin: 0, fontSize: "16px", color: "#17384c" },
  summarySection: { display: "flex", flexDirection: "column", gap: "6px" },
  sectionLabel: { margin: 0, fontSize: "11px", color: "#6b8799", fontWeight: 700, textTransform: "uppercase" },
  chips: { display: "flex", flexWrap: "wrap", gap: "8px" },
  chip: {
    background: "#edf9fc",
    border: "1px solid #d1eef5",
    color: "#1f5564",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
  },
  indicators: { display: "flex", gap: "14px", flexWrap: "wrap" },
  indicator: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 },
  vitalsText: { margin: 0, color: "#334155", fontSize: "13px" },
  actions: { display: "flex", justifyContent: "flex-end" },
  primaryBtn: {
    border: "none",
    borderRadius: "10px",
    background: "#1ea7b8",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    padding: "10px 14px",
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid #dbe7ee",
    borderRadius: "10px",
    background: "#fff",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    padding: "8px 12px",
    cursor: "pointer",
  },
  errorBanner: {
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    borderRadius: "10px",
    color: "#be123c",
    fontSize: "12px",
    padding: "8px 12px",
  },
  errorText: { color: "#be123c" },
  emptyText: { color: "#94a3b8", fontSize: "12px", margin: 0 },
  spinner: {
    width: "28px",
    height: "28px",
    border: "3px solid #dbe7ee",
    borderTop: "3px solid #1ea7b8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  spinnerLarge: {
    width: "38px",
    height: "38px",
    border: "3px solid #dbe7ee",
    borderTop: "3px solid #1ea7b8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  processingTitle: { margin: 0, fontSize: "18px", color: "#17384c" },
  processingSub: { margin: 0, fontSize: "13px", color: "#5f7685" },
  centerTitle: { margin: 0, color: "#5f7685", fontSize: "13px" },
};
