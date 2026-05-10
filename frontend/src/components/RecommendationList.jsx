/**
 * Recommendation List Component
 *
 * Groups recommendations by category and renders them with:
 * - Category icons and ordered sections
 * - Priority badges
 * - Limited items per category (default 6)
 */
import React, { useMemo } from "react";
import { HeartPulse, ShieldCheck, Activity, Leaf, UtensilsCrossed, Sparkles } from "lucide-react";

// Map category names to Lucide icons
function iconForCategory(category) {
  const c = String(category || "").toLowerCase();
  if (c.includes("lifestyle") || c.includes("diet") || c.includes("nutrition")) return Leaf;
  if (c.includes("monitor")) return Activity;
  if (c.includes("prevent")) return ShieldCheck;
  if (c.includes("care")) return HeartPulse;
  if (c.includes("activity")) return Activity;
  if (c.includes("nutrition") || c.includes("food")) return UtensilsCrossed;
  return Sparkles;
}

// Normalize priority strings into display labels
function priorityBadge(priority) {
  const p = String(priority || "");
  if (!p) return null;

  const normalized = p.toLowerCase();
  let label = p;
  if (normalized.includes("high")) label = "High";
  else if (normalized.includes("recommended")) label = "Recommended";
  else if (normalized.includes("preventive")) label = "Preventive";
  else if (normalized.includes("maintenance")) label = "Maintenance";

  return label;
}

export default function RecommendationList({ recommendations, title = "", maxPerCategory = 6 }) {
  // Group recommendations by category with a fixed display order
  const grouped = useMemo(() => {
    const list = Array.isArray(recommendations) ? recommendations.filter(Boolean) : [];
    const withCat = list.map((r) => ({ ...r, category: r.category || "General" }));

    const categoryOrder = [
      "Lifestyle",
      "Monitoring",
      "Preventive Care",
      "Nutrition",
      "Activity",
      "General",
    ];
    const categorySet = new Set(withCat.map((r) => r.category));

    const orderedCategories = [...categorySet].sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      if (pa !== pb) return pa - pb;
      return String(a).localeCompare(String(b));
    });

    const map = new Map();
    for (const cat of orderedCategories) map.set(cat, []);
    for (const r of withCat) map.get(r.category).push(r);

    return { map, orderedCategories };
  }, [recommendations]);

  const priorityPill = (priority) => {
    const p = String(priority || "").toLowerCase();
    if (!p) return null;
    if (p.includes("high")) return { label: "High", color: "#dc2626" };
    if (p.includes("recommended")) return { label: "Recommended", color: "#f97316" };
    if (p.includes("preventive")) return { label: "Preventive", color: "#22c55e" };
    if (p.includes("maintenance")) return { label: "Maintenance", color: "#0ea5e9" };
    return { label: priority, color: "#0f3d4a" };
  };

  return (
    <section style={{ width: "100%" }} aria-label="Personalized wellness guidance">
      {title ? (
        <div style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 950, letterSpacing: "-0.2px", color: "var(--text-main)" }}>
            {title}
          </h3>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {grouped.orderedCategories.map((category) => {
          const items = grouped.map.get(category) || [];
          const visible = items.slice(0, maxPerCategory);
          if (visible.length === 0) return null;

          return (
            <div key={category} style={{ display: "grid", gap: 8 }}>
              {/* Soft inline category divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 12.6,
                    fontWeight: 950,
                    color: "var(--text-muted)",
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {category}
                </span>
                <span style={{ flex: 1, height: 1, background: "var(--border-color)" }} aria-hidden="true" />
              </div>

              {/* Soft guidance cards (spacious, calm), but still compact */}
              <div style={{ display: "grid", gap: 8 }}>
                {visible.map((rec) => {
                  const pill = priorityPill(rec.priority);
                  const explanation = (rec.explanation || rec.whyThisMatters || "").trim();

                  return (
                    <div
                      key={rec.id}
                      style={{
                        borderRadius: 14,
                        padding: "10px 12px",
                        background: "var(--bg-body)",
                        border: "1px solid var(--border-color)",
                        boxShadow: "0 1px 0 rgba(25, 66, 89, 0.03)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13.6,
                              fontWeight: 950,
                              color: "var(--text-main)",
                              lineHeight: 1.25,
                            }}
                          >
                            {rec.title || "Guidance"}
                          </div>

                          {explanation ? (
                            <p
                              style={{
                                margin: "6px 0 0",
                                fontSize: 12.7,
                                lineHeight: 1.42,
                                fontWeight: 650,
                                color: "var(--text-muted)",
                              }}
                            >
                              {explanation}
                            </p>
                          ) : null}
                        </div>

                        {pill ? (
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: 11,
                              fontWeight: 950,
                              padding: "4px 9px",
                              borderRadius: 999,
                              background: "var(--bg-card)",
                              border: "1px solid var(--border-color)",
                              color: pill.color,
                              whiteSpace: "nowrap",
                            }}
                            title={pill.label}
                          >
                            {pill.label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
