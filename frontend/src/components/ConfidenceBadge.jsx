import React from "react";

const config = {
  High:   { bg: "#f0fdf4", color: "#16a34a", icon: "◉" },
  Medium: { bg: "#fefce8", color: "#ca8a04", icon: "◎" },
  Low:    { bg: "#fef2f2", color: "#dc2626", icon: "○" },
};

export default function ConfidenceBadge({ level }) {
  const c = config[level] || config.Low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "3px 10px", background: c.bg, color: c.color,
      borderRadius: "20px", fontSize: "11px", fontWeight: "600",
    }}>
      {c.icon} {level} Confidence
    </span>
  );
}
