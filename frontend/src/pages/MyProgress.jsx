import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import NotLinkedState from "../components/NotLinkedState";

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function shortDateLabel(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function normalizeAssessment(item) {
  return {
    score: Math.max(0, Math.min(100, Number(item?.score ?? item?.risk_score ?? 0) || 0)),
    date: item?.created_at || item?.createdAt || item?.timestamp || item?.date || null,
    level: item?.risk_level || "Unknown",
    recommendations: Array.isArray(item?.recommendations) ? item.recommendations : [],
  };
}

function toAction(text = "") {
  const t = text.toLowerCase();
  if (t.includes("walk") || t.includes("exercise") || t.includes("activity")) return "Walk at least 3x this week.";
  if (t.includes("alcohol")) return "Limit alcohol intake this week.";
  if (t.includes("sugar") || t.includes("glucose")) return "Reduce sugar intake this week.";
  if (t.includes("smok")) return "Avoid smoking and secondhand smoke.";
  if (t.includes("salt") || t.includes("sodium")) return "Choose less salty meals this week.";
  if (t.includes("medication")) return "Stay consistent with medication.";
  return text.length > 54 ? `${text.slice(0, 51)}...` : text;
}

function buildTrendChart(items, width = 460, height = 180, padX = 28, padY = 24) {
  if (!items.length) return { points: [], path: "", guideY: [] };

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxScore = 100;
  const minScore = 0;

  const stepX = items.length > 1 ? innerW / (items.length - 1) : 0;

  const points = items.map((item, idx) => {
    const x = padX + idx * stepX;
    const y = padY + (1 - (item.score - minScore) / (maxScore - minScore)) * innerH;
    return { ...item, x, y };
  });

  let path = "";
  if (points.length === 1) {
    path = `M ${points[0].x} ${points[0].y}`;
  } else if (points.length > 1) {
    path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      path += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const guideY = [25, 50, 75].map((score) => ({
    score,
    y: padY + (1 - score / 100) * innerH,
  }));

  return { points, path, guideY };
}

export default function MyProgress() {
  const { user } = useAuth();

  const [patient, setPatient] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.patient_id) return;

        const { data: patientData } = await api.get("/patients");
        const own = Array.isArray(patientData)
          ? patientData.find((p) => p.patient_id === user.patient_id)
          : null;
        setPatient(own || null);

        const { data } = await api.get(`/risk-assessment/user?id=${user.patient_id}`);
        const list = Array.isArray(data) ? data : [];

        const normalizedReal = list
          .map(normalizeAssessment)
          .filter((item) => parseDate(item.date))
          .sort((a, b) => parseDate(a.date) - parseDate(b.date));

        setAssessments(normalizedReal);
      } catch (err) {
        console.error("MyProgress load error:", err);
        setAssessments([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const chartItems = useMemo(() => assessments.slice(-5), [assessments]);
  const latest = chartItems[chartItems.length - 1] || null;
  const previous = chartItems[chartItems.length - 2] || null;
  const delta = latest && previous ? latest.score - previous.score : 0;

  const summary = useMemo(() => {
    if (!latest || !previous) {
      return {
        title: "No progress yet",
        subtitle: "Run your first assessment to start tracking your health.",
        change: "No trend data available yet",
      };
    }

    if (delta > 0) {
      return {
        title: "You're improving",
        subtitle: "Your health score is moving in the right direction",
        change: `+${delta} points since your last check`,
      };
    }

    if (delta < 0) {
      return {
        title: "You can still improve",
        subtitle: "A few routines may need closer attention",
        change: `${delta} points since your last check`,
      };
    }

    return {
      title: "You're stable",
      subtitle: "No major changes in your health score",
      change: "No change since your last assessment",
    };
  }, [delta, latest, previous]);

  const insights = useMemo(() => {
    if (!latest) return [];

    const out = [];
    const recommendations = latest.recommendations || [];
    const recText = recommendations.join(" ").toLowerCase();

    if (recText.includes("sugar") || recText.includes("glucose")) out.push("Blood sugar is still above optimal.");
    if (recText.includes("pressure") || recText.includes("blood pressure") || recText.includes("sodium")) out.push("Blood pressure remains slightly elevated.");
    if (recText.includes("activity") || recText.includes("exercise") || recText.includes("walk")) out.push("Lower activity may be affecting your score.");
    if (recText.includes("alcohol")) out.push("Alcohol intake may be slowing your progress.");

    if (!out.length && previous) {
      if (delta > 0) out.push("Recent habits are helping your score improve.");
      else if (delta < 0) out.push("Recent routines may be pulling your score down.");
      else out.push("Your score is stable, but there is room to improve.");
    }

    if (!out.length) out.push("A few recent readings are affecting your score.");
    return [...new Set(out)].slice(0, 3);
  }, [latest, previous, delta]);

  const focusActions = useMemo(() => {
    if (!latest) return [];
    const base = (latest.recommendations || []).map((r) => toAction(r)).filter(Boolean);
    const fallback = ["Reduce sugar intake this week.", "Walk at least 3x this week.", "Stay consistent with medication."];
    return [...new Set([...base, ...fallback])].slice(0, 3);
  }, [latest]);

  const trend = useMemo(() => buildTrendChart(chartItems), [chartItems]);
  const historyItems = useMemo(() => [...chartItems].reverse(), [chartItems]);

  if (loading) {
    return (
      <div style={styles.layout}>
        <Sidebar />
        <main style={styles.main}>
          <section style={styles.surface}>Loading your progress...</section>
        </main>
      </div>
    );
  }

  if (!patient) {
    return (
      <NotLinkedState
        primaryText="Start assessment to create your profile →"
        onPrimary={() => (window.location.href = "/assessment")}
      />
    );
  }

  const hasAssessments = assessments.length > 0;

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>My Progress</h1>
          <p style={styles.subtitle}>See your progress, what changed, and what to do next</p>
        </header>

        <section style={styles.summaryCard}>
          <div>
            <h2 style={styles.summaryTitle}>{summary.title}</h2>
            <p style={styles.summarySub}>{summary.subtitle}</p>
            <p style={styles.summaryDelta}>{summary.change}</p>
          </div>
        </section>

        {!hasAssessments ? (
          <EmptyState
            title="No progress yet"
            description="Run your first assessment to start tracking your health."
            ctaText="Run assessment →"
            onCta={() => (window.location.href = "/assessment")}
          />
        ) : (
          <section style={styles.grid}>
            <div style={styles.col}>
              {chartItems.length >= 2 ? (
                <article style={styles.surface}>
                  <h3 style={styles.sectionTitle}>Trend</h3>
                  <div style={styles.chartWrap}>
                    <svg viewBox="0 0 460 180" style={styles.chartSvg} role="img" aria-label="Health score trend">
                      {trend.guideY.map((g) => (
                        <g key={g.score}>
                          <line x1="28" x2="432" y1={g.y} y2={g.y} stroke="#e6eff3" strokeWidth="1" />
                        </g>
                      ))}

                      <path d={trend.path} fill="none" stroke="#4ea6ad" strokeWidth="3" strokeLinecap="round" />

                      {trend.points.map((p, idx) => {
                        const isLatest = idx === trend.points.length - 1;
                        return (
                          <g key={`${p.date}-${p.score}-${idx}`}>
                            <circle cx={p.x} cy={p.y} r={isLatest ? "6" : "4"} fill={isLatest ? "#2f7f89" : "#5fb7be"} />
                            {isLatest && <circle cx={p.x} cy={p.y} r="10" fill="rgba(79, 166, 173, 0.18)" />}
                          </g>
                        );
                      })}

                      {trend.points.map((p, idx) => (
                        <text key={`label-${p.date}-${idx}`} x={p.x} y="171" textAnchor="middle" fontSize="11" fill="#668092">
                          {shortDateLabel(p.date)}
                        </text>
                      ))}
                    </svg>
                  </div>
                </article>
              ) : (
                <EmptyState
                  compact
                  title="Not enough trend data yet"
                  description="Complete one more assessment to see your trend line."
                />
              )}

              {historyItems.length > 0 && (
                <article style={styles.surface}>
                  <h3 style={styles.sectionTitle}>History</h3>
                  <div style={styles.historyList}>
                    {historyItems.map((item, idx) => (
                      <div key={`${item.date}-${item.score}-${idx}`} style={styles.historyItem}>
                        <span style={styles.historyDate}>{shortDateLabel(item.date)}</span>
                        <span style={styles.historyScore}>{item.score}</span>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </div>

            <div style={styles.col}>
              {insights.length > 0 && (
                <article style={styles.surface}>
                  <h3 style={styles.sectionTitle}>What’s affecting your progress</h3>
                  <ul style={styles.bulletList}>
                    {insights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}

              {focusActions.length > 0 && (
                <article style={styles.focusCard}>
                  <h3 style={styles.sectionTitle}>What to focus on next</h3>
                  <ul style={styles.bulletList}>
                    {focusActions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: "#f5f8fb",
  },
  main: {
    flex: 1,
    maxWidth: "1120px",
    width: "100%",
    margin: "0 auto",
    padding: "14px 16px 16px",
    display: "grid",
    gap: "10px",
    alignContent: "start",
    fontFamily: "Nunito, DM Sans, sans-serif",
  },
  header: {
    display: "grid",
    gap: "2px",
  },
  title: {
    margin: 0,
    fontFamily: "Lora, serif",
    fontSize: "26px",
    lineHeight: 1.1,
    color: "#1f4259",
  },
  subtitle: {
    margin: 0,
    color: "#637d8f",
    fontSize: "12.8px",
  },
  summaryCard: {
    background: "linear-gradient(180deg, #edf8f8 0%, #e7f4f4 100%)",
    border: "1px solid #d6e9ea",
    borderRadius: "14px",
    padding: "12px 14px",
    boxShadow: "0 4px 14px rgba(44, 92, 101, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  summaryTitle: {
    margin: 0,
    fontFamily: "Lora, serif",
    fontSize: "22px",
    color: "#244d62",
  },
  summarySub: {
    margin: "3px 0 0",
    fontSize: "13px",
    color: "#4e6b7b",
  },
  summaryDelta: {
    margin: "2px 0 0",
    fontSize: "12.5px",
    fontWeight: 700,
    color: "#2f6277",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    gap: "10px",
    minHeight: "0",
  },
  col: {
    display: "grid",
    gap: "10px",
    alignContent: "start",
    minHeight: "0",
  },
  surface: {
    background: "#ffffff",
    border: "1px solid #e2edf3",
    borderRadius: "12px",
    padding: "11px 12px",
    boxShadow: "0 2px 8px rgba(12, 55, 77, 0.04)",
  },
  focusCard: {
    background: "#edf8f6",
    border: "1px solid #d8ebe6",
    borderRadius: "12px",
    padding: "11px 12px",
    boxShadow: "0 2px 8px rgba(12, 55, 77, 0.04)",
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontFamily: "Lora, serif",
    fontSize: "17px",
    color: "#284b63",
  },
  chartWrap: {
    width: "100%",
    overflow: "hidden",
  },
  chartSvg: {
    width: "100%",
    height: "190px",
    display: "block",
  },
  historyList: {
    display: "grid",
    gap: "2px",
  },
  historyItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #edf3f7",
  },
  historyDate: {
    fontSize: "13px",
    color: "#547082",
  },
  historyScore: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#2f556d",
  },
  bulletList: {
    margin: 0,
    paddingLeft: "18px",
    display: "grid",
    gap: "6px",
    color: "#3f5b6e",
    fontSize: "13.2px",
    lineHeight: 1.42,
  },
};
