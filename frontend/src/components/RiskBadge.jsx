import React from "react";

const config = {
  Critical: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", dot: "#ef4444" },
  High:     { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa", dot: "#f97316" },
  Moderate: { bg: "#fefce8", color: "#ca8a04", border: "#fde68a", dot: "#eab308" },
  Low:      { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", dot: "#22c55e" },
};

export default function RiskBadge({ level, large }) {
  const c = config[level] || config.Low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: large ? "6px 16px" : "3px 10px",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: "20px", fontSize: large ? "14px" : "11px", fontWeight: "700",
    }}>
      <span style={{ width: large ? "8px" : "6px", height: large ? "8px" : "6px", borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {level}
    </span>
  );
}
