/**
 * Audit Log Page
 *
 * Displays assessment activity history with:
 * - Date range filtering
 * - Risk level filtering
 * - Search by patient name
 * - Grouped entries by date
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import api from "../api/axios";
import { normalizePatients } from "../utils/normalizePatients";
import { fetchWithCache } from "../api/cachedFetch";

// ─── Date helpers ──────────────────────────────────────────────
function ymd(d) {
  // Returns "YYYY-MM-DD" for a Date object
  return d.toISOString().slice(0, 10);
}
function startOfDay(str) {
  return str ? new Date(`${str}T00:00:00`) : null;
}
function endOfDay(str) {
  return str ? new Date(`${str}T23:59:59`) : null;
}
function formatRangeLabel(from, to) {
  if (!from && !to) return null;
  const fmt = (s) =>
    new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (from === to || !to) return fmt(from);
  return `${fmt(from)} — ${fmt(to)}`;
}
function formatDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
function formatDateLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
}
function isSameDay(a, b) {
  return a && b && a === b;
}
function inRange(day, from, to) {
  if (!from || !to) return false;
  return day > from && day < to;
}
function formatRelativeTime(ts) {
  if (!ts) return "—";
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) > 1 ? "s" : ""} ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── Risk pill ───────────────────────────────────────────────── */
const riskPill = (status) => {
  const base = {
    display: "inline-block", padding: "2px 10px", borderRadius: "999px",
    fontSize: "11px", fontWeight: "700", border: "1px solid transparent", whiteSpace: "nowrap",
  };
  if (status === "Critical") return { ...base, color: "#b91c1c", background: "#fee2e2", borderColor: "#fecaca" };
  if (status === "High")     return { ...base, color: "#c2410c", background: "#ffedd5", borderColor: "#fed7aa" };
  if (status === "Moderate") return { ...base, color: "#a16207", background: "#fef9c3", borderColor: "#fde68a" };
  if (status === "Low")      return { ...base, color: "#166534", background: "#dcfce7", borderColor: "#bbf7d0" };
  return { ...base, color: "#64748b", background: "#f1f5f9", borderColor: "#e2e8f0" };
};

/* ─── Inline Range Calendar ───────────────────────────────────── */
function RangePicker({ fromDate, toDate, onChange, onClear }) {
  const today = ymd(new Date());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth()); // 0-indexed
  const [hoverDay, setHoverDay] = useState(null);
  const [selecting, setSelecting] = useState(null); // null | "start" — tracks mid-selection

  // Presets
  const applyPreset = (label) => {
    const now = new Date();
    const d = ymd(now);
    if (label === "today") { onChange(d, d); }
    else if (label === "7days") {
      const past = new Date(); past.setDate(now.getDate() - 6);
      onChange(ymd(past), d);
    } else if (label === "30days") {
      const past = new Date(); past.setDate(now.getDate() - 29);
      onChange(ymd(past), d);
    }
  };

  // Navigate months
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const handleDayClick = (day) => {
    if (!selecting) {
      // Start new selection
      setSelecting("end");
      onChange(day, null);
    } else {
      // Finish selection
      setSelecting(null);
      if (day < fromDate) {
        onChange(day, fromDate);
      } else {
        onChange(fromDate, day);
      }
    }
  };

  const effectiveTo = selecting ? (hoverDay || fromDate) : toDate;

  return (
    <div style={cal.wrap}>
      {/* Presets */}
      <div style={cal.presets}>
        {[["Today", "today"], ["Last 7 days", "7days"], ["Last 30 days", "30days"]].map(([lbl, key]) => (
          <button key={key} style={cal.preset} onClick={() => { applyPreset(key); setSelecting(null); }}>
            {lbl}
          </button>
        ))}
        {(fromDate || toDate) && (
          <button style={cal.presetClear} onClick={() => { onClear(); setSelecting(null); }}>
            Clear
          </button>
        )}
      </div>

      {/* Month nav */}
      <div style={cal.nav}>
        <button style={cal.navBtn} onClick={prevMonth}>‹</button>
        <span style={cal.monthLabel}>{monthLabel}</span>
        <button style={cal.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={cal.grid}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} style={cal.dowHeader}>{d}</div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`e${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          const isStart = isSameDay(day, fromDate);
          const isEnd   = isSameDay(day, effectiveTo);
          const isIn    = inRange(day, fromDate, effectiveTo) || inRange(day, effectiveTo, fromDate);
          const isToday = day === today;
          const isFuture = day > today;

          return (
            <div
              key={day}
              style={{
                ...cal.day,
                ...(isStart || isEnd ? cal.dayEndpoint : {}),
                ...(isIn && !isStart && !isEnd ? cal.dayInRange : {}),
                ...(isToday && !isStart && !isEnd ? cal.dayToday : {}),
                ...(isFuture ? cal.dayFuture : {}),
              }}
              onClick={() => !isFuture && handleDayClick(day)}
              onMouseEnter={() => selecting && setHoverDay(day)}
              onMouseLeave={() => selecting && setHoverDay(null)}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      {selecting && (
        <div style={cal.hint}>Click to select end date</div>
      )}
    </div>
  );
}

/* Calendar styles */
const cal = {
  wrap: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "14px",
    width: "280px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
    userSelect: "none",
  },
  presets: {
    display: "flex",
    gap: "6px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  preset: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#475569",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "3px 10px",
    cursor: "pointer",
  },
  presetClear: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#94a3b8",
    background: "transparent",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "3px 10px",
    cursor: "pointer",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  navBtn: {
    background: "none",
    border: "none",
    fontSize: "18px",
    color: "#64748b",
    cursor: "pointer",
    padding: "2px 8px",
    borderRadius: "6px",
    lineHeight: 1,
  },
  monthLabel: {
    fontSize: "13px",
    fontWeight: "700",
    color: "#1e293b",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "2px",
  },
  dowHeader: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#94a3b8",
    textAlign: "center",
    padding: "4px 0",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  day: {
    fontSize: "12px",
    color: "#334155",
    textAlign: "center",
    padding: "6px 2px",
    borderRadius: "7px",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
  },
  dayEndpoint: {
    background: "#0d9488",
    color: "white",
    fontWeight: "700",
    borderRadius: "7px",
  },
  dayInRange: {
    background: "#ccfbf1",
    color: "#0f766e",
    borderRadius: "0",
  },
  dayToday: {
    fontWeight: "700",
    color: "#0d9488",
  },
  dayFuture: {
    color: "#cbd5e1",
    cursor: "default",
  },
  hint: {
    marginTop: "10px",
    fontSize: "11px",
    color: "#94a3b8",
    textAlign: "center",
    fontStyle: "italic",
  },
};

/* ─── Date Range Trigger ──────────────────────────────────────── */
function DateRangePicker({ fromDate, toDate, onChange, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const label = formatRangeLabel(fromDate, toDate);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        style={{
          ...styles.dateRangeBtn,
          color: label ? "#334155" : "#94a3b8",
          borderColor: open ? "#0d9488" : "#e2e8f0",
          boxShadow: open ? "0 0 0 2px #ccfbf1" : "none",
        }}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#94a3b8" }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ flex: 1, textAlign: "left" }}>
          {label || "Select date range"}
        </span>
        {label && (
          <span
            style={styles.dateRangeClear}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            title="Clear"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div style={styles.calendarDropdown}>
          <RangePicker
            fromDate={fromDate}
            toDate={toDate}
            onChange={(from, to) => {
              onChange(from, to);
              if (from && to) setOpen(false);
            }}
            onClear={() => { onClear(); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function AuditLog() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [patientMap, setPatientMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const isDev = import.meta.env.DEV;
      
      const res = await api.get("/patients");
      if (isDev) console.log("[AuditLog] Patients response:", res.data);
      const patients = normalizePatients(res);
      if (isDev) console.log("[AuditLog] Normalized patients:", patients.length);
      const pMap = {};
      patients?.forEach((p) => { pMap[p.patient_id] = p; });
      setPatientMap(pMap);

      const { data: assessmentResponse } = await fetchWithCache({
        key: ["assessments", "all"],
        fetcher: async () => {
          const res = await api.get("/api/v1/predictive-analysis/risk-assessment/all?limit=1000");
          return res.data;
        },
      });

      if (isDev) console.log("[AuditLog] Assessments response:", assessmentResponse);
      const allRows = (Array.isArray(assessmentResponse?.data) ? assessmentResponse.data : [])
        .map((a) => {
          const p = pMap[a.patient_id];
          return {
            logId: a._id || `${a.patient_id}-${a.timestamp || a.createdAt}`,
            patientId: a.patient_id,
            patientName: p?.name || a.patient_id,
            action: "Assessment completed",
            performedBy: a.performed_by || "System",
            timestamp: a.timestamp || a.createdAt,
            riskLevel: a.risk_level || "N/A",
            riskScore: typeof a.risk_score === "number" ? a.risk_score : null,
          };
        })
        .filter(Boolean);

      if (isDev) console.log("[AuditLog] Total rows before sort:", allRows.length);
      allRows.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
        const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
        return dateB - dateA;
      });
      if (isDev) console.log("[AuditLog] Final rows after sort:", allRows.length);
      setRows(allRows);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[AuditLog] Load error:", err.response?.status, err.message);
      // Silently ignore; UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = startOfDay(fromDate);
    const to   = endOfDay(toDate);
    return rows.filter((r) => {
      const levelOk  = statusFilter === "All" || r.riskLevel === statusFilter;
      const ts       = new Date(r.timestamp);
      const fromOk   = !from || ts >= from;
      const toOk     = !to   || ts <= to;
      const searchOk = !q ||
        r.patientName.toLowerCase().includes(q) ||
        r.patientId.toLowerCase().includes(q);
      return levelOk && fromOk && toOk && searchOk;
    });
  }, [rows, statusFilter, fromDate, toDate, search]);

  const grouped = useMemo(() => {
    const groups = [];
    let currentLabel = null;
    filtered.forEach((r) => {
      const label = formatDateLabel(r.timestamp);
      if (label !== currentLabel) {
        groups.push({ type: "label", label });
        currentLabel = label;
      }
      groups.push({ type: "entry", data: r });
    });
    return groups;
  }, [filtered]);

  const hasFilters = statusFilter !== "All" || fromDate || toDate || search;
  const clearAll = () => { setStatusFilter("All"); setFromDate(""); setToDate(""); setSearch(""); };

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        {/* ── Header ── */}
        <header style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Audit Log</h1>
            <p style={styles.subtitle}>Assessment activity history</p>
          </div>
          {hasFilters && (
            <button style={styles.clearBtn} onClick={clearAll}>Clear filters ✕</button>
          )}
        </header>

        {/* ── Filter bar ── */}
        <section style={styles.filterBar}>
          <div style={{ ...styles.searchWrap, ...styles.controlItem, flex: "1 1 260px" }}>
            <svg style={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={{ ...styles.controlItem, flex: "0 0 170px" }}>
            <select
              style={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Moderate">Moderate</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div style={{ ...styles.controlItem, flex: "0 0 170px" }}>
            <input
              type="date"
              style={styles.dateInput}
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div style={{ ...styles.controlItem, flex: "0 0 170px" }}>
            <input
              type="date"
              style={styles.dateInput}
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </section>

        {/* ── Activity list ── */}
        <section style={styles.listWrap}>
          {loading ? (
            <div style={styles.empty}>Loading activity history…</div>
          ) : rows.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ width: "32px", height: "32px", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="4" rx="1" />
                  <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
                  <path d="M7 13h10" />
                  <path d="M7 17h7" />
                </svg>
              </div>
              <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>No activity yet</div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>Assessments will appear here as they are completed</div>
            </div>
          ) : grouped.length === 0 ? (
            <div style={styles.empty}>No log entries match the selected filters.</div>
          ) : (
            <div style={styles.list}>
              {grouped.map((item, idx) =>
                item.type === "label" ? (
                  <div key={`label-${idx}`} style={styles.dateLabel}>{item.label}</div>
                ) : (
                  <LogEntry
                    key={item.data.logId}
                    entry={item.data}
                    onOpen={() => navigate(`/admin/patients/${item.data.patientId}`)}
                  />
                )
              )}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

/* ─── Log Entry Card ──────────────────────────────────────────── */
const LogEntry = React.memo(function LogEntry({ entry, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const initial = (entry.patientName || "U").charAt(0).toUpperCase();

  return (
    <div
      style={{
        ...styles.card,
        background: hovered ? "#f8fafc" : "white",
        boxShadow: hovered ? "0 2px 10px rgba(0,0,0,0.07)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.avatar}>{initial}</div>

      <div style={styles.cardLeft}>
        <div style={styles.cardName}>{entry.patientName}</div>
        <div style={styles.cardSub}>
          <span style={styles.cardId}>{entry.patientId}</span>
          <span style={styles.dot}>•</span>
          <span style={styles.cardAction}>{entry.action}</span>
        </div>
      </div>

      <div style={styles.cardMiddle}>
        {entry.riskLevel && entry.riskLevel !== "N/A" ? (
          <>
            <span style={riskPill(entry.riskLevel)}>{entry.riskLevel}</span>
            <span style={styles.cardScore}>{entry.riskScore ?? "--"}/100</span>
          </>
        ) : (
          <span style={styles.noResult}>Not Assessed</span>
        )}
      </div>

      <div style={styles.cardRight}>
        <span style={styles.timestamp} title={formatDateTime(entry.timestamp)}>
          {formatRelativeTime(entry.timestamp)}
        </span>
      </div>
    </div>
  );
});

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: {
    flex: 1, display: "flex", flexDirection: "column", gap: "14px",
    padding: "20px 28px", background: "#f8fafc", minWidth: 0,
  },

  headerRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 },
  title: { fontFamily: "Lora, serif", fontSize: "22px", color: "#1e293b", fontWeight: "600", margin: 0 },
  subtitle: { fontSize: "12px", color: "#94a3b8", marginTop: "3px", margin: 0 },
  clearBtn: {
    background: "white", border: "1px solid #e2e8f0", borderRadius: "999px",
    padding: "5px 12px", fontSize: "11px", color: "#64748b", fontWeight: "600",
    cursor: "pointer", marginTop: "4px",
  },

  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f8fbfd",
    border: "1px solid #e2edf4",
    borderRadius: "14px",
    padding: "12px",
    flexShrink: 0,
    flexWrap: "wrap",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  },
  controlItem: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  dateInput: {
    height: "40px",
    width: "100%",
    border: "1px solid #dbe6ee",
    borderRadius: "10px",
    padding: "0 12px",
    fontSize: "13px",
    color: "#334155",
    background: "#ffffff",
    outline: "none",
    cursor: "pointer",
  },
  searchWrap: { position: "relative", display: "flex", alignItems: "center", width: "100%" },
  searchIcon: { position: "absolute", left: "12px", width: "14px", height: "14px", pointerEvents: "none" },
  searchInput: {
    height: "40px",
    width: "100%",
    border: "1px solid #dbe6ee",
    borderRadius: "10px",
    padding: "0 12px 0 34px",
    fontSize: "13px",
    color: "#334155",
    background: "#ffffff",
    outline: "none",
    minWidth: 0,
  },
  select: {
    height: "40px",
    width: "100%",
    border: "1px solid #dbe6ee",
    borderRadius: "10px",
    padding: "0 12px",
    fontSize: "13px",
    color: "#334155",
    background: "#ffffff",
    outline: "none",
    cursor: "pointer",
  },

  /* Date range button (trigger) */
  dateRangeBtn: {
    display: "flex", alignItems: "center", gap: "7px",
    border: "1px solid", borderRadius: "8px", padding: "7px 12px",
    fontSize: "12px", background: "#f8fafc", cursor: "pointer",
    minWidth: "185px", transition: "border-color 0.15s, box-shadow 0.15s",
  },
  dateRangeClear: {
    fontSize: "10px", color: "#94a3b8", cursor: "pointer",
    padding: "0 2px", flexShrink: 0,
  },
  calendarDropdown: {
    position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
  },

  /* Activity list */
  listWrap: {
    flex: 1, minHeight: 0, background: "white", border: "1px solid #e8edf2",
    borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column",
  },
  countBar: {
    padding: "10px 20px 6px",
    borderBottom: "1px solid #f8fafc",
    flexShrink: 0,
  },
  countText: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: "500",
  },
  list: {
    overflowY: "auto", flex: 1, padding: "6px 20px 16px",
    display: "flex", flexDirection: "column", gap: "0",
  },
  empty: { textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: "13px" },

  dateLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#8a9aad",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    padding: "16px 2px 8px",
    marginTop: "6px",
    marginBottom: "8px",
    borderBottom: "1px solid #eef3f7",
  },

  card: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px 14px",
    borderRadius: "12px",
    cursor: "pointer",
    border: "1px solid #e7eef4",
    transition: "background 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
    marginBottom: "8px",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#d9f0f7",
    color: "#0b7285",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: "700",
    flexShrink: 0,
    border: "1px solid #c7e5ef",
  },
  cardLeft: { flex: "1 1 auto", minWidth: 0 },
  cardName: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardSub: { display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", minWidth: 0 },
  cardId: { fontSize: "12px", color: "#7b8ca0", fontWeight: "600" },
  dot: { color: "#c4d0db", fontSize: "11px" },
  cardAction: {
    fontSize: "12px",
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardMiddle: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginLeft: "12px",
  },
  cardScore: { fontSize: "12px", fontWeight: "700", color: "#334155" },
  noResult: {
    color: "#7b8ca0",
    fontSize: "11px",
    fontWeight: "700",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    padding: "2px 10px",
  },
  cardRight: {
    marginLeft: "auto",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: "92px",
  },
  timestamp: {
    fontSize: "11px",
    color: "#90a1b5",
    whiteSpace: "nowrap",
    cursor: "default",
    fontWeight: "600",
  },
};
