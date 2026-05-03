import React, { useState } from "react";

const colors = ["#0ea5e9", "#0d9488", "#8b5cf6", "#f97316", "#ec4899"];

export default function ScoreBreakdown({ breakdown }) {
  const [open, setOpen] = useState(true);
  const entries = Object.entries(breakdown || {});
  const total = entries.reduce((s, [, v]) => s + v, 0);

  return (
    <div style={styles.wrap}>
      <button style={styles.toggle} onClick={() => setOpen(!open)}>
        <span style={styles.toggleLabel}>Score Breakdown</span>
        <span style={styles.chevron}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={styles.body}>
          {entries.map(([key, val], i) => {
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return (
              <div key={key} style={styles.row}>
                <div style={styles.rowHeader}>
                  <span style={styles.rowLabel}>{key}</span>
                  <span style={styles.rowVal}>{val} pts</span>
                </div>
                <div style={styles.barBg}>
                  <div style={{ ...styles.barFill, width: `${pct}%`, background: colors[i % colors.length] }} />
                </div>
              </div>
            );
          })}
          <div style={styles.totalRow}>
            <span>Total Risk Score</span>
            <span style={styles.totalVal}>{total} / 100</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" },
  toggle: {
    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px", background: "#f8fafc", border: "none", cursor: "pointer",
  },
  toggleLabel: { fontSize: "13px", fontWeight: "600", color: "#1e293b" },
  chevron: { fontSize: "10px", color: "#94a3b8" },
  body: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" },
  row: { display: "flex", flexDirection: "column", gap: "4px" },
  rowHeader: { display: "flex", justifyContent: "space-between" },
  rowLabel: { fontSize: "12px", color: "#475569", fontWeight: "500" },
  rowVal: { fontSize: "12px", color: "#1e293b", fontWeight: "700" },
  barBg: { height: "6px", background: "#f1f5f9", borderRadius: "10px", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: "10px", transition: "width 0.5s ease" },
  totalRow: { display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #e2e8f0", fontSize: "13px", fontWeight: "600", color: "#1e293b" },
  totalVal: { color: "#0ea5e9" },
};
