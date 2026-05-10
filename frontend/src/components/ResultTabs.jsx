/**
 * Result Tabs Component
 *
 * Renders the risk score breakdown as a list of contributing factors.
 * Shows the total risk score at the bottom.
 */
import React from "react";
import { BarChart3 } from "lucide-react";
import { getAssessmentRiskScore, normalizeAssessment } from "../utils/normalizeAssessment";

export default function ResultTabs({ data }) {
  const assessment = normalizeAssessment(data);

  if (!assessment) {
    return null;
  }

  const breakdown = assessment.breakdown || [];

  return (
    <div style={styles.wrap}>
      <div style={styles.content}>
        {breakdown.length > 0 ? (
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
              <span>{getAssessmentRiskScore(assessment) ?? "--"}/100</span>
            </div>
          </div>
        ) : (
          <div style={styles.emptyState}>No score breakdown available</div>
        )}
      </div>
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
  content: {
    padding: "16px",
    overflowY: "auto",
    flex: 1,
  },
  breakdownList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    padding: "12px 14px",
    border: "1px solid #eaf2f7",
    borderRadius: "10px",
    background: "#fbfdff",
    fontSize: "12.5px",
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
    color: "#0f2940",
    fontWeight: "700",
    lineHeight: 1.3,
  },
  breakdownCategory: {
    color: "#5f7685",
    fontSize: "11px",
    fontWeight: 600,
  },
  breakdownValue: {
    color: "#0f2940",
    fontWeight: "800",
    fontSize: "13px",
  },
  breakdownTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "6px",
    padding: "13px 14px",
    background: "#f3f8fc",
    border: "1px solid #dbe7ee",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "700",
    color: "#0f2940",
  },
  emptyState: {
    color: "#94a3b8",
    fontSize: "12px",
  },
};
