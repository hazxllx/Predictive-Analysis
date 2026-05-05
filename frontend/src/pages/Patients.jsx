import React, { useEffect, useMemo, useState } from "react";
import { Activity, Cigarette, Search, Wine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./Patients.css";

const RISK_CLASS_MAP = {
  Critical: "patient-registry__badge--critical",
  High: "patient-registry__badge--high",
  Moderate: "patient-registry__badge--moderate",
  Low: "patient-registry__badge--low",
};

const LIFESTYLE_ICON_MAP = {
  smoking: Cigarette,
  alcohol: Wine,
  activity: Activity,
};

export default function Patients() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [assessments, setAssessments] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dataSource, setDataSource] = useState("pms");

  useEffect(() => {
    const load = async () => {
      try {
        const { data: patientResponse } = await api.get("/patients");
        const patientList = Array.isArray(patientResponse?.data)
          ? patientResponse.data
          : Array.isArray(patientResponse)
          ? patientResponse
          : [];

        setDataSource(patientResponse?.source === "fallback" ? "fallback" : "pms");
        setPatients(patientList);

        const assessmentMap = {};
        await Promise.all(
          patientList.map(async (patient) => {
            try {
              const patientId = patient.patient_id;
              if (!patientId) return;

              const { data } = await api.get(`/risk-assessment/user?id=${patientId}`);
              if (Array.isArray(data) && data.length > 0) {
                assessmentMap[patientId] = data[0];
              }
            } catch {
              // No assessment yet for this patient.
            }
          })
        );

        setAssessments(assessmentMap);
      } catch (error) {
        console.error("Patients load error:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;

    return patients.filter((patient) => {
      const name = (patient.name || "").toLowerCase();
      const patientId = (patient.patient_id || "").toLowerCase();
      return name.includes(query) || patientId.includes(query);
    });
  }, [patients, search]);

  const openPatient = (patient, assessed) => {
    console.log("CLICKED PATIENT:", patient);
    const patientId = patient?.patient_id;
    if (!patientId) return;

    if (user?.role === "admin") {
      navigate(`/admin/patient/${patientId}`);
      return;
    }

    if (assessed) {
      navigate(`/patients/${patientId}`);
      return;
    }

    navigate(`/patients/${patientId}/assessment`);
  };

  return (
    <div className="patient-registry-page">
      <Sidebar />

      <main className="patient-registry-page__main">
        <header className="patient-registry-page__header">
          <div className="patient-registry-page__copy">
            <h1 className="patient-registry-page__title">Patient Registry</h1>
            <p className="patient-registry-page__subtitle">
              <span>{patients.length} {patients.length === 1 ? "patient" : "patients"} from PMS</span>
              <span aria-hidden="true"> &mdash; </span>
              <span>Select to run predictive analysis</span>
            </p>
          </div>

          <label className="patient-registry-page__search" aria-label="Search patient">
            <Search size={16} strokeWidth={2} />
            <input
              type="text"
              placeholder="Search patient..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </header>

        {loading ? (
          <div className="patient-registry-page__empty">Loading patients...</div>
        ) : (
          <>
            {dataSource === "fallback" && (
              <div
                style={{
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: "999px",
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Using fallback data
                </span>
                <span style={{ color: "#7c6f52", fontSize: "13px" }}>
                  PMS temporarily unavailable — showing fallback data
                </span>
              </div>
            )}

            {filteredPatients.length === 0 ? (
              <div className="patient-registry-page__empty">No patients found.</div>
            ) : (
              <section className="patient-registry-grid">
                {filteredPatients.map((patient) => {
                  const patientId = patient.patient_id;
                  return (
                    <PatientRegistryCard
                      key={patientId}
                      patient={patient}
                      assessment={assessments[patientId]}
                      onOpen={(assessed) => openPatient(patient, assessed)}
                    />
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PatientRegistryCard({ patient, assessment, onOpen }) {
  const conditions = getConditions(patient);
  const lifestyleIndicators = getLifestyleIndicators(patient);
  const initials = getInitials(patient.name);

  const effectiveRiskLevel = patient?.risk_level || assessment?.risk_level || null;
  const effectiveRiskScore = patient?.riskScore ?? patient?.risk_score ?? assessment?.risk_score;
  const riskScore = formatRiskScore(effectiveRiskScore);
  const assessed = Boolean(effectiveRiskLevel) && riskScore !== null;
  const riskLevel = effectiveRiskLevel || "Not assessed";
  const actionLabel = assessed ? "View Result" : "Assess";

  return (
    <button type="button" className="patient-registry-card" onClick={() => onOpen(assessed)}>
      <div className="patient-registry-card__header">
        <div className="patient-registry-card__identity">
          <div className="patient-registry-card__avatar">{initials}</div>

          <div className="patient-registry-card__info">
            <h2 className="patient-registry-card__name">{patient.name || "Unknown Patient"}</h2>
            <p className="patient-registry-card__meta">
              <span>{patient.patient_id || "-"}</span>
              <span aria-hidden="true"> &middot; </span>
              <span>{patient.age ?? "-"}y</span>
              <span aria-hidden="true"> &middot; </span>
              <span>{patient.gender || "-"}</span>
            </p>
          </div>
        </div>

      </div>

      <div className="patient-registry-card__chips">
        {conditions.length > 0 ? (
          conditions.map((condition) => (
            <span key={`${patient.patient_id}-${condition}`} className="patient-registry-card__chip">
              {condition}
            </span>
          ))
        ) : (
          <span className="patient-registry-card__conditions-empty">No conditions on record</span>
        )}
      </div>

      <div className="patient-registry-card__lifestyle">
        {lifestyleIndicators.map((item) => {
          const Icon = LIFESTYLE_ICON_MAP[item.type];
          return (
            <span
              key={`${patient.patient_id}-${item.type}-${item.label}`}
              className={`patient-registry-card__indicator patient-registry-card__indicator--${item.tone}`}
            >
              <Icon size={13} strokeWidth={1.9} />
              {item.label}
            </span>
          );
        })}
      </div>

      <div className="patient-registry-card__footer">
        {assessed ? (
          <span className={`patient-registry__badge ${RISK_CLASS_MAP[riskLevel] || ""}`}>
            <span>{riskLevel}</span>
            <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
            <span>{riskScore}</span>
          </span>
        ) : (
          <span className="patient-registry-card__pending">Not assessed</span>
        )}

        <span className="patient-registry-card__action">{actionLabel}</span>
      </div>
    </button>
  );
}

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PT"
  );
}

function getConditions(patient) {
  const mapped = Array.isArray(patient?.patient_record)
    ? patient.patient_record
        .map((c) => String(c || "").trim())
        .filter(Boolean)
        .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    : [];

  if (mapped.length > 0) {
    return [...new Set(mapped)].slice(0, 3);
  }

  const history = patient?.medical_history || {};
  const chips = [];

  if (history.heart_disease || history.hypertension) chips.push("Cardiovascular");
  if (history.hypertension) chips.push("Hypertension");
  if (history.diabetes) chips.push("Metabolic", "Diabetes");
  if (history.asthma || history.copd) chips.push("Respiratory");
  if (history.asthma) chips.push("Asthma");
  if (history.copd) chips.push("COPD");
  if (history.kidney_disease) chips.push("Renal");
  if (history.cancer) chips.push("Cancer");
  if (history.stroke) chips.push("Neurologic");
  if (history.anxiety || history.depression) chips.push("Mental");
  if (history.anxiety) chips.push("Anxiety");
  if (history.depression) chips.push("Depression");

  return [...new Set(chips)].slice(0, 3);
}

function getLifestyleIndicators(patient) {
  const lifestyle = patient?.lifestyle || {};
  const indicators = [];

  if (lifestyle.smoking) {
    indicators.push({ type: "smoking", label: "Smoker", tone: "warm" });
  }

  if (lifestyle.alcohol) {
    indicators.push({ type: "alcohol", label: "Alcohol", tone: "accent" });
  }

  indicators.push({
    type: "activity",
    label: formatActivity(lifestyle.physical_activity || "active"),
    tone: "muted",
  });

  return indicators;
}

function formatActivity(activity) {
  const value = String(activity || "").trim().toLowerCase();
  if (!value) return "Active";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRiskScore(score) {
  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? `${Math.round(numericScore)}/100` : null;
}
