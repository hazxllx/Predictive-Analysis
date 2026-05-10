/**
 * Empty State Component
 *
 * Displays a friendly message when there is no data to show.
 * Optionally renders a call-to-action button.
 */
import React from "react";

export default function EmptyState({
  title,
  description,
  note,
  ctaText,
  onCta,
  compact = false,
}) {
  return (
    <section
      style={{
        background: "#f7fcfc",
        border: "1px solid #dbecee",
        borderRadius: "14px",
        padding: compact ? "14px 16px" : "18px 20px",
        display: "grid",
        gap: "7px",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: "Lora, serif",
          fontSize: compact ? "18px" : "20px",
          color: "#235068",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: "13.5px",
          color: "#4e6a7d",
          lineHeight: 1.45,
          maxWidth: "56ch",
        }}
      >
        {description}
      </p>

      {note && (
        <p
          style={{
            margin: 0,
            fontSize: "12.5px",
            color: "#668497",
          }}
        >
          {note}
        </p>
      )}

      {ctaText && onCta && (
        <div style={{ marginTop: "4px" }}>
          <button
            type="button"
            onClick={onCta}
            style={{
              border: "none",
              background: "#2c6f92",
              color: "#fff",
              borderRadius: "999px",
              padding: "8px 13px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(38, 93, 121, 0.18)",
            }}
          >
            {ctaText}
          </button>
        </div>
      )}
    </section>
  );
}
