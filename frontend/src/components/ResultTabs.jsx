import React, { useEffect, useMemo, useState } from "react";
import { Microscope, Stethoscope, Lightbulb } from "lucide-react";

const tabs = ["Recommendations", "Specialists", "Lab Tests"];

export default function ResultTabs({ data, initialTab = "Recommendations" }) {
  const tabIndexByName = useMemo(
    () => ({
      Recommendations: 0,
      Specialists: 1,
      "Lab Tests": 2,
    }),
    []
  );

  const [active, setActive] = useState(tabIndexByName[initialTab] ?? 0);

  useEffect(() => {
    setActive(tabIndexByName[initialTab] ?? 0);
  }, [initialTab, tabIndexByName]);

  const renderContent = () => {
    if (active === 0) return (
      <ul style={styles.list}>
        {data.recommendations?.map((r, i) => (
          <li key={i} style={styles.listItem}>
            <span style={styles.bullet}><Lightbulb size={13} /></span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    );
    if (active === 1) return (
      <div style={styles.chipGrid}>
        {data.specialists?.map((s, i) => (
          <div key={i} style={styles.chip}>
            <span style={styles.chipIcon}><Stethoscope size={13} /></span> {s}
          </div>
        ))}
      </div>
    );
    if (active === 2) return (
      <div style={styles.chipGrid}>
        {data.lab_tests?.map((l, i) => (
          <div key={i} style={{
            ...styles.chip,
            background: "#f0fdf4",
            color: "#16a34a",
            border: "1px solid #bbf7d0"
          }}>
            <span style={styles.chipIcon}><Microscope size={13} /></span> {l}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.tabBar}>
        {tabs.map((t, i) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(active === i ? styles.tabActive : {}) }}
            onClick={() => setActive(i)}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={styles.content}>{renderContent()}</div>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    background: "white",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: "0 8px",
    gap: "2px",
    flexShrink: 0,
  },
  tab: {
    padding: "10px 14px",
    border: "none",
    background: "transparent",
    fontSize: "12px",
    fontWeight: "500",
    color: "#64748b",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  tabActive: {
    color: "#0ea5e9",
    borderBottomColor: "#0ea5e9",
    fontWeight: "600",
    background: "transparent",
  },
  content: {
    padding: "16px",
    overflowY: "auto",
    flex: 1,
  },
  list: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  listItem: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    fontSize: "12.5px",
    color: "#334155",
    lineHeight: "1.5",
    padding: "8px 10px",
    background: "#f8fafc",
    borderRadius: "8px",
    border: "1px solid #f1f5f9",
  },
  bullet: {
    color: "#0ea5e9",
    fontWeight: "700",
    flexShrink: 0,
    marginTop: "1px",
  },
  chipGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    background: "#e0f2fe",
    color: "#0284c7",
    border: "1px solid #bae6fd",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  chipIcon: {
    fontSize: "13px",
    display: "inline-flex",
    alignItems: "center",
  },
};
