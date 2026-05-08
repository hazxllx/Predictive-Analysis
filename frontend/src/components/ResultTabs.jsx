import React, { useEffect, useMemo, useState } from "react";
import { Microscope, Stethoscope, Lightbulb, BarChart3 } from "lucide-react";
import { normalizeAssessment } from "../utils/normalizeAssessment";

const tabs = ["Recommendations", "Specialists", "Lab Tests", "Breakdown"];

export default function ResultTabs({ data, initialTab = "Recommendations" }) {
  const tabIndexByName = useMemo(
    () => ({
      Recommendations: 0,
      Specialists: 1,
      "Lab Tests": 2,
      Breakdown: 3,
    }),
    []
  );

  const [active, setActive] = useState(tabIndexByName[initialTab] ?? 0);
  const assessment = normalizeAssessment(data);

  useEffect(() => {
    setActive(tabIndexByName[initialTab] ?? 0);
  }, [initialTab, tabIndexByName]);

  if (!assessment) {
    return null;
  }

  const recommendations = assessment.recommendations || [];
  const specialists = assessment.specialists || [];
  const labTests = assessment.lab_tests || [];
  const breakdown = assessment.breakdown || [];

  const renderContent = () => {
    if (active === 0) {
      return recommendations.length > 0 ? (
        <ul style={styles.list}>
          {recommendations.map((item, index) => (
            <li key={`${index}-${item}`} style={styles.listItem}>
              <span style={styles.bullet}>
                <Lightbulb size={13} />
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={styles.emptyState}>No recommendations available</div>
      );
    }

    if (active === 1) {
      return specialists.length > 0 ? (
        <div style={styles.chipGrid}>
          {specialists.map((item) => (
            <div key={item} style={styles.chip}>
              <span style={styles.chipIcon}>
                <Stethoscope size={13} />
              </span>
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>No specialists recommended</div>
      );
    }

    if (active === 2) {
      return labTests.length > 0 ? (
        <div style={styles.chipGrid}>
          {labTests.map((item) => (
            <div
              key={item}
              style={{
                ...styles.chip,
                background: "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #bbf7d0",
              }}
            >
              <span style={styles.chipIcon}>
                <Microscope size={13} />
              </span>
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyState}>No lab tests recommended</div>
      );
    }

    if (active === 3) {
      return breakdown.length > 0 ? (
        <div style={styles.breakdownList}>
          {breakdown.map((item) => (
            <div key={`${item.category}-${item.label}`} style={styles.breakdownRow}>
              <div style={styles.breakdownMeta}>
                <span style={styles.breakdownIcon}>
                  <BarChart3 size={13} />
                </span>
                <div style={styles.breakdownText}>
                  <span style={styles.breakdownLabel}>{item.label}</span>
                  <span style={styles.breakdownCategory}>{item.category || "Score Contribution"}</span>
                </div>
              </div>
              <span style={styles.breakdownValue}>+{item.points}</span>
            </div>
          ))}
          <div style={styles.breakdownTotal}>
            <span>Total Risk Score</span>
            <span>{assessment.risk_score || 0}/100</span>
          </div>
        </div>
      ) : (
        <div style={styles.emptyState}>No score breakdown available</div>
      );
    }

    return null;
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.tabBar}>
        {tabs.map((tab, index) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(active === index ? styles.tabActive : {}) }}
            onClick={() => setActive(index)}
          >
            {tab}
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
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    fontSize: "11px",
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
    margin: 0,
    padding: 0,
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
  breakdownList: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "12px",
  },
  breakdownMeta: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  },
  breakdownIcon: {
    display: "inline-flex",
    alignItems: "center",
    color: "#0ea5e9",
    marginTop: "2px",
  },
  breakdownText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  breakdownLabel: {
    color: "#1e293b",
    fontWeight: "600",
  },
  breakdownCategory: {
    color: "#64748b",
    fontSize: "11px",
  },
  breakdownValue: {
    color: "#1e293b",
    fontWeight: "700",
  },
  breakdownTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    fontSize: "13px",
    fontWeight: "600",
    color: "#1e293b",
  },
  emptyState: {
    color: "#94a3b8",
    fontSize: "12px",
  },
};
