/**
 * Risk Badge Component
 *
 * Displays a colored badge indicating the patient's risk level.
 * Supports two sizes: default (compact) and large (dashboard card).
 */
import React from "react";

const config = {
  Critical: { bg: "rgba(220,38,38,0.15)", color: "#ef4444", border: "rgba(220,38,38,0.35)", dot: "#ef4444" },
  High:     { bg: "rgba(234,88,12,0.15)", color: "#f97316", border: "rgba(234,88,12,0.35)", dot: "#f97316" },
  Moderate: { bg: "rgba(202,138,4,0.15)",  color: "#eab308", border: "rgba(202,138,4,0.35)",  dot: "#eab308" },
  Low:      { bg: "rgba(22,163,74,0.15)",  color: "#22c55e", border: "rgba(22,163,74,0.35)",  dot: "#22c55e" },
};

export default function RiskBadge({ level, large }) {
  const c = config[level] || config.Low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: large ? "5px 12px" : "3px 10px",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: "20px", fontSize: large ? "13px" : "11px", fontWeight: "700",
    }}>
      <span style={{ width: large ? "7px" : "6px", height: large ? "7px" : "6px", borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {level}
    </span>
  );
}
