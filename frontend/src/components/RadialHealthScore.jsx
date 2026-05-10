import React, { useEffect, useRef, useMemo } from "react";

/**
 * RadialRiskScore - Premium animated SVG component for risk score visualization
 * Displays ONLY the canonical Risk Score (0-100) with animated progress ring.
 *
 * Props:
 * - score: number (0-100) - risk score (higher = more risk)
 * - riskLevel: string ("Low" | "Moderate" | "High" | "Critical") - determines ring color
 * - size: number - SVG viewBox size (default 200)
 * - strokeWidth: number - ring stroke width (default 8)
 * - animated: boolean - enable animation on mount (default true)
 *
 * Performance: Colors are memoized to avoid recalculation on every render.
 */
export default function RadialHealthScore({
  score,
  riskLevel = "Low",
  size = 200,
  strokeWidth = 8,
  animated = true,
}) {
  const circleRef = useRef(null);
  const hasScore = Number.isFinite(Number(score));
  const safeScore = hasScore ? Math.max(0, Math.min(100, Number(score))) : null;

  const colors = useMemo(() => {
    const ringColor = (() => {
      switch (riskLevel) {
        case "Low": return "#22c55e";
        case "Moderate": return "#3b82f6";
        case "High": return "#f59e0b";
        case "Critical": return "#dc2626";
        default: return "#6366f1";
      }
    })();
    return { ringColor, bgColor: ringColor + "1a" };
  }, [riskLevel]);

  const center = size / 2;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (!circleRef.current) return;

    const circle = circleRef.current;
    const targetOffset =
      safeScore === null ? circumference : circumference - (safeScore / 100) * circumference;

    if (animated) {
      circle.style.strokeDasharray = `${circumference}`;
      circle.style.strokeDashoffset = `${circumference}`;
      circle.style.transition = "none";
      void circle.offsetHeight; // force reflow
      circle.style.transition = `stroke-dashoffset 700ms cubic-bezier(0.4, 0, 0.2, 1)`;
      circle.style.strokeDashoffset = `${targetOffset}`;
    } else {
      circle.style.strokeDasharray = `${circumference}`;
      circle.style.strokeDashoffset = `${targetOffset}`;
    }
  }, [safeScore, circumference, animated]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: `${size * 1.4}px`,
        maxHeight: `${size * 1.4}px`,
        filter: "drop-shadow(0 1px 4px rgba(0, 0, 0, 0.04))",
      }}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={colors.bgColor}
        strokeWidth={strokeWidth}
      />
      <circle
        ref={circleRef}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={colors.ringColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${center}px ${center}px`,
        }}
      />
      <g>
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${size * 0.32}px`,
            fontWeight: 700,
            fontFamily: "Lora, serif",
            fill: "var(--text-main)",
            letterSpacing: "-0.5px",
          }}
        >
          {safeScore === null ? "--" : Math.round(safeScore)}
        </text>
        <text
          x={center}
          y={center + 20}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${size * 0.1}px`,
            fontWeight: 500,
            fontFamily: "Nunito, sans-serif",
            fill: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Risk Score
        </text>
      </g>
    </svg>
  );
}
