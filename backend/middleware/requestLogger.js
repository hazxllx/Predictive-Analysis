/**
 * Lightweight PMS request logger.
 * // connect here (future PMS expansion)
 */
const pmsRequestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const endpoint = req.originalUrl;

  // API key validation visibility in logs (without exposing key)
  console.log(`[PMS REQUEST] ${timestamp} - ${req.ip} - ${endpoint}`);

  res.on("finish", () => {
    const statusType = res.statusCode >= 200 && res.statusCode < 400 ? "SUCCESS" : "FAILURE";
    console.log(`[PMS RESPONSE] ${timestamp} - ${endpoint} - ${statusType} (${res.statusCode})`);
  });

  next();
};

module.exports = { pmsRequestLogger };
