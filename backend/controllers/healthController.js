/**
 * Health Check Controller
 *
 * Provides a simple health check endpoint for PMS to verify PAS availability.
 * This is used by the Patient Management System to check if the Predictive Analysis System is operational.
 */

const healthCheck = async (req, res) => {
  try {
    // Check MongoDB connection
    const mongoose = require("mongoose");
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      version: "1.0.0",
    };

    if (process.env.NODE_ENV === "development") {
      console.debug("[HEALTH] Health check requested:", healthData);
    }

    return res.json({ 
      success: true, 
      data: healthData 
    });
  } catch (error) {
    console.error("[HEALTH] Health check error:", error.message);
    return res.status(503).json({ 
      success: false, 
      message: "Service unavailable" 
    });
  }
};

module.exports = { healthCheck };
