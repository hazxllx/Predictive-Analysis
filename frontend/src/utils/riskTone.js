/**
 * Risk Tone Utility
 *
 * Maps internal risk level names to patient-friendly display labels.
 */
export function getPatientFacingRiskLabel(riskLevel) {
  if (riskLevel === "Low") return "Healthy Range";
  if (riskLevel === "Moderate") return "Needs Monitoring";
  if (riskLevel === "High") return "Elevated Risk";
  if (riskLevel === "Critical") return "Immediate Attention Recommended";
  return "Needs Monitoring";
}
