/**
 * PMS Authentication Middleware
 *
 * Secures PMS ↔ PAS integration endpoints using API key authentication.
 * Only the Patient Management System (PMS) should have access to these endpoints.
 *
 * Security:
 * - Requires x-pms-api-key header matching PMS_API_KEY environment variable
 * - Returns generic error messages to avoid information leakage
 * - Logs authentication failures in development mode
 *
 * Usage:
 * Apply to PMS-specific routes:
 * router.post("/api/v1/predictive-analysis/risk-assessment", pmsAuth, createRiskAssessment);
 */

const pmsAuth = (req, res, next) => {
  const apiKey = req.headers["x-pms-api-key"] || req.headers["x-api-key"];

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[PMS AUTH] Missing API key for:", req.method, req.path);
    }
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized: missing API key" 
    });
  }

  if (apiKey !== process.env.PMS_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[PMS AUTH] Invalid API key for:", req.method, req.path);
    }
    return res.status(403).json({ 
      success: false, 
      message: "Forbidden: invalid API key" 
    });
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[PMS AUTH] PMS authenticated for:", req.method, req.path);
  }

  // Add PMS identifier to request for audit logging
  req.pmsAuthenticated = true;
  next();
};

module.exports = { pmsAuth };
