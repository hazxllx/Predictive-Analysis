/**
 * Patient Recommendations Engine
 * Deterministic, pure, and memo-friendly.
 *
 * Input: { patient, assessment }
 * Output: Array of recommendation objects:
 * {
 *   id, title, explanation, category, priority, whyThisMatters,
 *   triggeredBy: string[]
 * }
 */

function safeStr(v) {
  return String(v ?? "").trim();
}

function titleCase(s) {
  return safeStr(s)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function priorityRank(p) {
  // Higher = more urgent shown first
  switch (p) {
    case "High Priority":
      return 4;
    case "Recommended":
      return 3;
    case "Preventive":
      return 2;
    case "Maintenance":
      return 1;
    default:
      return 0;
  }
}

function toneForPriority(priority) {
  switch (priority) {
    case "High Priority":
      return { border: "#fecaca", bg: "#fff1f2", text: "#991b1b", chipBg: "#fee2e2" };
    case "Recommended":
      return { border: "#fed7aa", bg: "#fff7ed", text: "#9a3412", chipBg: "#ffedd5" };
    case "Preventive":
      return { border: "#dbeafe", bg: "#eff6ff", text: "#1d4ed8", chipBg: "#dbeafe" };
    case "Maintenance":
      return { border: "#dcfce7", bg: "#f0fdf4", text: "#166534", chipBg: "#bbf7d0" };
    default:
      return { border: "#e5e7eb", bg: "#f9fafb", text: "#334155", chipBg: "#e5e7eb" };
  }
}

function parseBreakdownSignals(breakdown) {
  const list = Array.isArray(breakdown) ? breakdown : [];
  // Normalize common shapes
  return list
    .map((b) => ({
      label: safeStr(b?.label),
      points: Number.isFinite(Number(b?.points)) ? Number(b.points) : 0,
      key: safeStr(b?.key) || safeStr(b?.indicator),
    }))
    .filter((x) => x.label || x.key);
}

function getTopElevated(breakdown, limit = 3) {
  const signals = parseBreakdownSignals(breakdown);
  const elevated = signals.filter((s) => s.points > 0);
  elevated.sort((a, b) => b.points - a.points);
  return elevated.slice(0, limit);
}

function getLifestyle(patient) {
  return patient?.lifestyle || {};
}

function getVitals(patient) {
  return patient?.vitals || {};
}

function getFamilyHistoryFlags(patient) {
  return patient?.family_history || {};
}

function buildTriggeredBy(list) {
  return uniqueBy(list.map((x) => safeStr(x)).filter(Boolean), (v) => v).slice(0, 6);
}

function recommendationObject({ title, category, priority, explanation, whyThisMatters, triggeredBy }) {
  return {
    id: safeStr(title).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: safeStr(title),
    category: safeStr(category),
    priority,
    explanation: safeStr(explanation),
    whyThisMatters: whyThisMatters ? safeStr(whyThisMatters) : null,
    triggeredBy: buildTriggeredBy(Array.isArray(triggeredBy) ? triggeredBy : [triggeredBy]),
    tone: toneForPriority(priority),
  };
}

/**
 * Generate recommendations from structured assessment + patient data.
 */
export function generateRecommendations({ patient, assessment } = {}) {
  const safeAssessment = assessment || {};
  const safePatient = patient || {};

  const recommendations = [];

  const riskLevel = safeStr(safeAssessment?.risk_level);
  const riskScore = safeAssessment?.risk_score ?? safeAssessment?.riskScore ?? null;
  const riskScoreNum = riskScore === null || riskScore === undefined ? null : Number(riskScore);

  const lifestyle = getLifestyle(safePatient);
  const vitals = getVitals(safePatient);
  const familyHistory = getFamilyHistoryFlags(safePatient);

  const breakdown = Array.isArray(safeAssessment?.breakdown) ? safeAssessment.breakdown : [];
  const elevatedSignals = getTopElevated(breakdown, 4);

  // 1) Risk level / global guidance
  if (riskLevel && riskLevel.toLowerCase() === "critical") {
    recommendations.push(
      recommendationObject({
        title: "Act quickly on priority health markers",
        category: "Monitoring",
        priority: "High Priority",
        explanation: "Your assessment indicates critical risk markers that need timely attention.",
        whyThisMatters:
          "Addressing elevated indicators early reduces the chance of worsening and helps your care team intervene sooner.",
        triggeredBy: ["risk_level: Critical"],
      })
    );
  } else if (riskLevel && riskLevel.toLowerCase() === "high") {
    recommendations.push(
      recommendationObject({
        title: "Focus follow-up on the most elevated indicators",
        category: "Monitoring",
        priority: "High Priority",
        explanation: "Your assessment shows high-risk markers where small changes can make a noticeable difference.",
        whyThisMatters:
          "Targeted follow-up improves detection and helps you build momentum with practical next steps.",
        triggeredBy: ["risk_level: High", riskScoreNum != null ? `risk_score:${riskScoreNum}` : null],
      })
    );
  }

  // 2) Lifestyle-based
  if (lifestyle?.smoking) {
    recommendations.push(
      recommendationObject({
        title: "Smoking cessation support",
        category: "Lifestyle",
        priority: "High Priority",
        explanation: "Smoking significantly increases cardiovascular and respiratory strain.",
        whyThisMatters:
          "Quitting (even gradually) improves long-term outcomes and reduces future risk escalation.",
        triggeredBy: ["smoking"],
      })
    );
  }

  if (lifestyle?.alcohol) {
    recommendations.push(
      recommendationObject({
        title: "Reduce alcohol intake (or discuss safe limits)",
        category: "Lifestyle",
        priority: "Recommended",
        explanation: "Alcohol use can compound cardiovascular and metabolic risk depending on your profile.",
        whyThisMatters:
          "Staying within safer limits helps protect heart health and supports more stable vitals over time.",
        triggeredBy: ["alcohol"],
      })
    );
  }

  const diet = safeStr(lifestyle?.diet);
  if (diet && /high|processed|sodium|salt/i.test(diet)) {
    recommendations.push(
      recommendationObject({
        title: "Cut back on sodium-rich processed foods",
        category: "Nutrition",
        priority: "Recommended",
        explanation: "Processed foods often contain high sodium, which can elevate blood pressure.",
        whyThisMatters:
          "Reducing sodium helps lower strain on blood vessels and supports healthier cardiovascular readings.",
        triggeredBy: [diet],
      })
    );
  } else if (safeStr(lifestyle?.sodium_intake)) {
    const sodium = safeStr(lifestyle.sodium_intake).toLowerCase();
    recommendations.push(
      recommendationObject({
        title: "Balance sodium intake more intentionally",
        category: "Nutrition",
        priority: "Recommended",
        explanation: "Your profile suggests higher sodium intake.",
        whyThisMatters:
          "Better sodium balance supports steadier blood pressure and improved cardiovascular resilience.",
        triggeredBy: ["sodium_intake", sodium],
      })
    );
  }

  const activity = safeStr(lifestyle?.physical_activity);
  if (activity && /sedent|no|low|rare|inact/i.test(activity)) {
    recommendations.push(
      recommendationObject({
        title: "Increase weekly physical activity",
        category: "Activity",
        priority: "Recommended",
        explanation: "A low-activity pattern increases strain and reduces protective cardiovascular effects.",
        whyThisMatters:
          "Consistent movement improves endurance and supports healthier long-term risk trends.",
        triggeredBy: [activity],
      })
    );
  }

  if (safeStr(lifestyle?.sleep_quality) && /poor|low|bad/i.test(lifestyle.sleep_quality)) {
    recommendations.push(
      recommendationObject({
        title: "Improve sleep quality",
        category: "Lifestyle",
        priority: "Preventive",
        explanation: "Poor sleep can worsen metabolic and cardiovascular regulation.",
        whyThisMatters:
          "Better sleep supports steadier recovery, healthier cravings, and improved risk management.",
        triggeredBy: ["sleep_quality"],
      })
    );
  }

  // 3) Vitals-based (only when present)
  const bloodPressure = safeStr(vitals?.blood_pressure);
  if (bloodPressure) {
    const bpParts = bloodPressure.split("/").map((p) => Number(p));
    const systolic = Number.isFinite(bpParts[0]) ? bpParts[0] : null;
    const diastolic = Number.isFinite(bpParts[1]) ? bpParts[1] : null;

    if (systolic != null && diastolic != null) {
      if (systolic >= 140 || diastolic >= 90) {
        recommendations.push(
          recommendationObject({
            title: "Monitor blood pressure weekly",
            category: "Monitoring",
            priority: "High Priority",
            explanation: "Your blood pressure readings are elevated and deserve closer monitoring.",
            whyThisMatters:
              "Weekly tracking helps detect worsening trends early and supports timely adjustments.",
            triggeredBy: [`blood_pressure:${bloodPressure}`],
          })
        );
      } else if (systolic >= 130 || diastolic >= 85) {
        recommendations.push(
          recommendationObject({
            title: "Schedule cardiovascular check-in",
            category: "Preventive Care",
            priority: "Recommended",
            explanation: "Your readings suggest early elevation.",
            whyThisMatters:
              "A check-in can confirm your baseline and guide targeted prevention strategies.",
            triggeredBy: [`blood_pressure:${bloodPressure}`],
          })
        );
      }
    }
  }

  const heartRate = vitals?.heart_rate;
  if (heartRate != null) {
    const hr = Number(heartRate);
    if (Number.isFinite(hr) && (hr > 100 || hr < 50)) {
      recommendations.push(
        recommendationObject({
          title: "Discuss heart rate variability with your care team",
          category: "Monitoring",
          priority: "Recommended",
          explanation: "Your profile shows heart rate values that may require review.",
          whyThisMatters:
            "Ensuring your baseline is accurate can prevent missed opportunities for prevention.",
          triggeredBy: [`heart_rate:${heartRate}`],
        })
      );
    }
  }

  // 4) Family history (boolean-ish flags)
  for (const [key, value] of Object.entries(familyHistory || {})) {
    const k = safeStr(key);
    const flag =
      typeof value === "boolean" ? value : value === 1 || value === "1" || value === "true";

    if (!flag) continue;

    if (/heart|cardio|hypertension|stroke/i.test(k)) {
      recommendations.push(
        recommendationObject({
          title: `Cardiovascular preventive focus for ${k.replace(/_/g, " ")}`,
          category: "Preventive Care",
          priority: "Preventive",
          explanation: "Family history can increase your baseline risk and benefit from consistent prevention.",
          whyThisMatters:
            "Proactive habits and monitoring help catch changes earlier and reduce long-term strain.",
          triggeredBy: [`family_history:${k}`],
        })
      );
    }

    if (/diabet|glucose|metabolic/i.test(k)) {
      recommendations.push(
        recommendationObject({
          title: "Metabolic screening and lifestyle reinforcement",
          category: "Preventive Care",
          priority: "Preventive",
          explanation: "Family history suggests attention to metabolic risk management.",
          whyThisMatters:
            "Consistent prevention supports steadier outcomes and may reduce future escalation.",
          triggeredBy: [`family_history:${k}`],
        })
      );
    }
  }

  // 5) Elevated indicator signals from breakdown
  for (const sig of elevatedSignals) {
    const label = sig.label || sig.key;
    if (!label) continue;

    const normalized = label.toLowerCase();

    if (/sodium|salt/i.test(normalized)) {
      recommendations.push(
        recommendationObject({
          title: "Reduce sodium-heavy foods and track impact",
          category: "Nutrition",
          priority: "Recommended",
          explanation: "Your elevated indicator suggests sodium is contributing to risk.",
          whyThisMatters:
            "Lower sodium supports healthier blood pressure and improves cardiovascular stability.",
          triggeredBy: [label],
        })
      );
      continue;
    }

    if (/blood pressure|bp|hypertension/i.test(normalized)) {
      recommendations.push(
        recommendationObject({
          title: "Monitor blood pressure and follow targeted adjustments",
          category: "Monitoring",
          priority: "High Priority",
          explanation: "Elevated blood pressure contributes to cardiovascular strain.",
          whyThisMatters:
            "Regular monitoring helps you detect trends and support early intervention.",
          triggeredBy: [label],
        })
      );
      continue;
    }

    if (/smoking|tobacco/i.test(normalized)) {
      recommendations.push(
        recommendationObject({
          title: "Get smoking cessation support tailored to you",
          category: "Lifestyle",
          priority: "High Priority",
          explanation: "This elevated indicator aligns with tobacco-related risk factors.",
          whyThisMatters:
            "Cessation support significantly improves long-term health outcomes.",
          triggeredBy: [label],
        })
      );
      continue;
    }

    // Default elevated indicator mapping
    recommendations.push(
      recommendationObject({
        title: `Address elevated indicator: ${label}`,
        category: "Monitoring",
        priority: "Recommended",
        explanation: "Your assessment shows this marker is above your healthier baseline.",
        whyThisMatMatters:
          "Targeting elevated markers supports measurable improvement and more accurate risk trends.",
        triggeredBy: [label],
      })
    );
  }

  // 6) Use existing assessment.recommendations if they exist as fallback,
  // but convert them into structured recommendations without duplicating exact titles.
  const rawRecs = Array.isArray(safeAssessment?.recommendations) ? safeAssessment.recommendations : [];
  for (const r of rawRecs) {
    const title = safeStr(r);
    if (!title) continue;

    // Try not to duplicate with generated recommendations
    const already = recommendations.some((x) => x.title.toLowerCase() === title.toLowerCase());
    if (already) continue;

    recommendations.push(
      recommendationObject({
        title,
        category: "Maintenance",
        priority: riskLevel ? "Recommended" : "Maintenance",
        explanation: "Based on your latest assessment and health signals.",
        whyThisMatters: "Following this guidance can support healthier trends over time.",
        triggeredBy: ["assessment.recommendations"],
      })
    );
  }

  // Final normalization: sort, dedupe, and cap
  const cleaned = uniqueBy(recommendations, (x) => safeStr(x.title).toLowerCase())
    .filter((x) => x.title && x.explanation)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));

  // Cap to keep UI calm
  return cleaned.slice(0, 8);
}

/**
 * Simple helper to generate a stable set of “focus area” labels.
 */
export function generateFocusAreas({ patient, assessment } = {}) {
  const recs = generateRecommendations({ patient, assessment });
  const areas = uniqueBy(recs.map((r) => r.category), (x) => x);
  return areas.slice(0, 4);
}
