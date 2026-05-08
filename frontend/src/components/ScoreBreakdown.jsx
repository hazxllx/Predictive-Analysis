import React, { useMemo, useState } from "react";

const colors = ["#0ea5e9", "#0d9488", "#f97316", "#ec4899", "#8b5cf6"];

function normalizeBreakdown(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        label: String(item?.label || "").trim(),
        category: String(item?.category || "").trim(),
        points: Number(item?.points) || 0,
      }))
      .filter((item) => item.label && item.points > 0);
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([label, points]) => ({
        label: String(label || "").trim(),
        category: "",
        points: Number(points) || 0,
      }))
      .filter((item) => item.label && item.points > 0);
  }

  return [];
}

export default function ScoreBreakdown({ breakdown }) {
  const [open, setOpen] = useState(true);
  const entries = useMemo(() => normalizeBreakdown(breakdown), [breakdown]);
  const total = entries.reduce((sum, item) => sum + item.points, 0);

  return (
    <div style={styles.wrap}>
      <button style={styles.toggle} onClick={() => setOpen((prev) => !prev)}>
        <span style={styles.toggleLabel}>Score Breakdown</span>
        <span style={styles.chevron}>{open ? "^" : "v"}</span>
      </button>
      {open && (
        <div style={styles.body}>
          {entries.map((entry, index) => {
            const pct = total > 0 ? Math.round((entry.points / total) * 100) : 0;
            return (
              <div key={`${entry.category}-${entry.label}`} style={styles.row}>
                <div style={styles.rowHeader}>
                  <div style={styles.rowMeta}>
                    <span style={styles.rowLabel}>{entry.label}</span>
                    {entry.category && <span style={styles.rowCategory}>{entry.category}</span>}
                  </div>
                  <span style={styles.rowVal}>+{entry.points}</span>
                </div>
                <div style={styles.barBg}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${pct}%`,
                      background: colors[index % colors.length],
                    }}
                  />
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
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "#f8fafc",
    border: "none",
    cursor: "pointer",
  },
  toggleLabel: { fontSize: "13px", fontWeight: "600", color: "#1e293b" },
  chevron: { fontSize: "10px", color: "#94a3b8" },
  body: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" },
  row: { display: "flex", flexDirection: "column", gap: "4px" },
  rowHeader: { display: "flex", justifyContent: "space-between", gap: "12px" },
  rowMeta: { display: "flex", flexDirection: "column", gap: "2px" },
  rowLabel: { fontSize: "12px", color: "#1e293b", fontWeight: "600" },
  rowCategory: { fontSize: "11px", color: "#64748b" },
  rowVal: { fontSize: "12px", color: "#1e293b", fontWeight: "700" },
  barBg: { height: "6px", background: "#f1f5f9", borderRadius: "10px", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: "10px", transition: "width 0.5s ease" },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "8px",
    borderTop: "1px solid #e2e8f0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1e293b",
  },
  totalVal: { color: "#0ea5e9" },
};
