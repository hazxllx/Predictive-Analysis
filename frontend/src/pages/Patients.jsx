/**
 * Patients Registry Page
 *
 * Admin-facing patient list with:
 * - Search and filtering
 * - Risk level badges
 * - Condition tags
 * - Quick navigation to patient details and assessments
 */
import React, { useEffect, useMemo, useState } from "react";
import { Activity, Cigarette, Search, Salad, Wine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import "./Patients.css";
import { formatDateTime } from "../utils/formatDateTime";
import { fetchWithCache } from "../api/cachedFetch";
import { setCachedQuery } from "../api/queryCache";
import { normalizePatients } from "../utils/normalizePatients";
import {
  normalizeAssessment,
  getAssessmentRiskLevel,
  getAssessmentRiskScore,
} from "../utils/normalizeAssessment";
import { extractConditionTags } from "../utils/conditionExtraction";

// CSS class mapping for risk level badges
const RISK_CLASS_MAP = {
  Critical: "patient-registry__badge--critical",
  High: "patient-registry__badge--high",
  Moderate: "patient-registry__badge--moderate",
  Low: "patient-registry__badge--low",
};

const LIFESTYLE_ICON_MAP = {
  smoking: Cigarette,
  alcohol: Wine,
  diet: Salad,
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
        const { data: patientResponse } = await fetchWithCache({
          key: ["patients"],
          fetcher: async () => {
            const { data } = await api.get("/patients");
            return data;
          },
        });

        const patientList = normalizePatients(patientResponse);
        setDataSource(patientResponse?.source === "fallback" ? "fallback" : "pms");
        setPatients(patientList);

        patientList.forEach((patient) => {
          setCachedQuery(["patient", patient.patient_id], patient);
        });

        const { data: latestResponse } = await fetchWithCache({
          key: ["assessments", "latest-by-patient"],
          fetcher: async () => {
            const { data } = await api.get("/api/v1/predictive-analysis/risk-assessment/latest-by-patient");
            return data;
          },
        });
        const latestByPatient = latestResponse?.data || {};
        const assessmentEntries = patientList
          .map((patient) => {
            const normalized = normalizeAssessment(latestByPatient[patient.patient_id]);
            if (!normalized) return null;
            setCachedQuery(["assessment", patient.patient_id], normalized);
            return [patient.patient_id, normalized];
          })
          .filter(Boolean);

        setAssessments(
          assessmentEntries.reduce((acc, [patientId, assessment]) => {
            acc[patientId] = assessment;
            return acc;
          }, {})
        );
      } catch {
        // Error is silent; UI shows empty state
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

  const openPatient = (patient) => {
    const patientId = patient?.patient_id;
    if (!patientId) return;

    const assessment = assessments[patientId] || null;
    const path = user?.role === "admin" ? `/admin/patients/${patientId}` : `/my-dashboard`;

    navigate(path, {
      state: {
        patient,
        assessment,
      },
    });
  };

  return (
    <div className="patient-registry-page">
      <Sidebar />

      <main className="patient-registry-page__main">
        <header className="patient-registry-page__header">
          <div className="patient-registry-page__copy">
            <h1 className="patient-registry-page__title">Patient Registry</h1>
            <p className="patient-registry-page__subtitle">
              <span>
                {patients.length} {patients.length === 1 ? "patient" : "patients"} from PMS
              </span>
              <span aria-hidden="true"> &mdash; </span>
              <span>Select to review or run predictive analysis</span>
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
                  PMS temporarily unavailable - showing fallback data
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
                      onOpen={() => openPatient(patient)}
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

const PatientRegistryCard = React.memo(function PatientRegistryCard({ patient, assessment, onOpen }) {
  const conditions = getConditions(patient);
  const lifestyleIndicators = getLifestyleIndicators(patient);
  const initials = getInitials(patient.name);
  const hasAssessment = Boolean(assessment);

  const normalized = hasAssessment ? normalizeAssessment(assessment) : null;
  const riskLevel = getAssessmentRiskLevel(normalized) || "Not assessed";
  const riskScore = getAssessmentRiskScore(normalized);

  const actionLabel = hasAssessment ? "View Result ->" : "Assess ->";

  return (
    <button type="button" className="patient-registry-card" onClick={onOpen}>
      <div className="patient-registry-card__header">
        <div className="patient-registry-card__identity">
          <div className="patient-registry-card__avatar">{initials}</div>

          <div className="patient-registry-card__info">
            <h2 className="patient-registry-card__name">{patient.name || "Unknown Patient"}</h2>
            <p className="patient-registry-card__meta">
              <span>{patient.patient_id || "-"}</span>
              {patient.age !== null && patient.age !== undefined && (
                <>
                  <span aria-hidden="true"> &middot; </span>
                  <span>{patient.age}y</span>
                </>
              )}
              {patient.gender && (
                <>
                  <span aria-hidden="true"> &middot; </span>
                  <span>{patient.gender}</span>
                </>
              )}
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

      <div
        style={{
          marginTop: "6px",
          marginBottom: "2px",
          fontSize: "12px",
          color: "#6b8799",
          textAlign: "left",
        }}
      >
        Last Visit: {formatDateTime(patient?.last_visit_date, "No recorded visit")}
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
        {hasAssessment ? (
          <span className={`patient-registry__badge ${RISK_CLASS_MAP[riskLevel] || ""}`}>
            <span>{riskLevel}</span>
            <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
            <span>{riskScore === null || riskScore === undefined ? "--" : `${riskScore}/100`}</span>
          </span>
        ) : (
          <span className="patient-registry-card__pending">Not assessed</span>
        )}

        <span className="patient-registry-card__action">{actionLabel}</span>
      </div>
    </button>
  );
});

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
  return extractConditionTags(patient, 3);
}

function getLifestyleIndicators(patient) {
  const lifestyle = patient?.lifestyle || {};
  const indicators = [];

  // Only show smoking if true
  if (lifestyle.smoking) {
    indicators.push({
      type: "smoking",
      label: "Smoking",
      tone: "warm",
    });
  }

  // Only show alcohol if true
  if (lifestyle.alcohol) {
    indicators.push({
      type: "alcohol",
      label: "Alcohol Use",
      tone: "accent",
    });
  }

  if (lifestyle.physical_activity) {
    indicators.push({
      type: "activity",
      label: lifestyle.physical_activity,
      tone: "cool",
    });
  }

  if (lifestyle.diet) {
    indicators.push({
      type: "diet",
      label: lifestyle.diet,
      tone: "cool",
    });
  }

  return indicators.slice(0, 4);
}
