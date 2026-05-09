import React, { useEffect, useRef } from "react";

/**
 * RadialHealthScore - Premium animated SVG component for health score visualization
 * Displays score (0-100) in center with animated progress ring
 * 
 * Props:
 * - score: number (0-100) - health score value
 * - riskLevel: string ("Low" | "Moderate" | "High" | "Critical") - determines ring color
 * - size: number - SVG viewBox size (default 200)
 * - strokeWidth: number - ring stroke width (default 8)
 * - animated: boolean - enable animation on mount (default true)
 */
export default function RadialHealthScore({
  score = 0,
  riskLevel = "Low",
  size = 200,
  strokeWidth = 8,
  animated = true,
}) {
  const circleRef = useRef(null);
  const clampedScore = Math.max(0, Math.min(100, score || 0));

  // Color mapping from risk level
  const getRingColor = () => {
    switch (riskLevel) {
      case "Low":
        return "#22c55e"; // Green
      case "Moderate":
        return "#3b82f6"; // Blue
      case "High":
        return "#f59e0b"; // Amber
      case "Critical":
        return "#dc2626"; // Red
      default:
        return "#6366f1"; // Indigo fallback
    }
  };

  const getBackgroundColor = () => {
    const color = getRingColor();
    // Convert hex to rgba with 0.1 opacity for subtle background
    return color + "1a"; // 10% opacity
  };

  useEffect(() => {
    if (!circleRef.current) return;

    const circle = circleRef.current;
    const circumference = 2 * Math.PI * (size / 2 - strokeWidth / 2);
    
    // Calculate stroke offset for the score (0-100 → 0-100% around circle)
    const targetOffset = circumference - (clampedScore / 100) * circumference;

    if (animated) {
      // Reset animation
      circle.style.strokeDasharray = circumference;
      circle.style.strokeDashoffset = circumference;
      circle.style.transition = "none";

      // Trigger reflow to restart animation
      void circle.offsetHeight;

      // Animate to target
      circle.style.transition = `stroke-dashoffset 700ms cubic-bezier(0.4, 0, 0.2, 1)`;
      circle.style.strokeDashoffset = targetOffset;
    } else {
      circle.style.strokeDasharray = circumference;
      circle.style.strokeDashoffset = targetOffset;
    }
  }, [clampedScore, size, strokeWidth, animated]);

  const center = size / 2;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "240px",
        maxHeight: "240px",
        filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.05))",
      }}
    >
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={getBackgroundColor()}
        strokeWidth={strokeWidth}
      />

      {/* Progress ring - starts from top, goes clockwise */}
      <circle
        ref={circleRef}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={getRingColor()}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${center}px ${center}px`,
        }}
      />

      {/* Center score text */}
      <g>
        {/* Score number */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${size * 0.32}px`,
            fontWeight: 700,
            fontFamily: "Lora, serif",
            fill: "#17384c",
            letterSpacing: "-0.5px",
          }}
        >
          {Math.round(clampedScore)}
        </text>

        {/* Subtitle */}
        <text
          x={center}
          y={center + 20}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontSize: `${size * 0.1}px`,
            fontWeight: 400,
            fontFamily: "Nunito, sans-serif",
            fill: "#668194",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Health
        </text>
      </g>
    </svg>
  );
}
