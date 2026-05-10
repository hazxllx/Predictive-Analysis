/**
 * Audit Middleware — IP Address Capture
 *
 * Middleware that captures and attaches the client IP address to each request.
 * Supports:
 * - Direct connections
 * - Proxy headers (X-Forwarded-For, CF-Connecting-IP, etc.)
 * - Render.com, Vercel, Cloudflare, and other PaaS deployments
 * - Express trust proxy configuration
 *
 * Usage in server.js:
 *   app.set("trust proxy", 1); // Trust first proxy
 *   app.use(captureClientIP);
 */

/**
 * Extracts the client's real IP address from the request.
 * Checks multiple sources in order of priority:
 *
 * 1. CF-Connecting-IP: Set by Cloudflare
 * 2. X-Client-IP: Set by some proxies
 * 3. X-Forwarded-For: Standard proxy header (uses first IP in chain)
 * 4. X-Forwarded: Alternative proxy header
 * 5. Forwarded: RFC 7239 standard header
 * 6. req.connection.remoteAddress: Direct connection
 * 7. req.ip: Express request object (respects trust proxy)
 *
 * @param {Object} req - Express request object
 * @returns {string} IP address string, defaults to "0.0.0.0" if unable to determine
 */
const getClientIP = (req) => {
  // Cloudflare
  if (req.headers["cf-connecting-ip"]) {
    return req.headers["cf-connecting-ip"];
  }

  // Other CDNs / proxies
  if (req.headers["x-client-ip"]) {
    return req.headers["x-client-ip"];
  }

  // Standard proxy header (often contains multiple IPs, use first)
  if (req.headers["x-forwarded-for"]) {
    return req.headers["x-forwarded-for"].split(",")[0].trim();
  }

  // Alternative proxy header
  if (req.headers["x-forwarded"]) {
    return req.headers["x-forwarded"];
  }

  // RFC 7239 standard header
  if (req.headers.forwarded) {
    const match = req.headers.forwarded.match(/for=([^;,]+)/);
    if (match && match[1]) {
      return match[1].replace(/^\[|]$/g, ""); // Remove IPv6 brackets
    }
  }

  // Express request object (respects app.set('trust proxy', ...))
  if (req.ip) {
    return req.ip;
  }

  // Direct connection fallback
  if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  }

  // Last resort
  return "0.0.0.0";
};

/**
 * Middleware that captures client IP and attaches to request.
 * Must be added early in the Express middleware stack, before routes.
 *
 * Attaches: req.clientIP
 * Usage: Access via req.clientIP in routes and other middleware
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const captureClientIP = (req, res, next) => {
  req.clientIP = getClientIP(req);

  // Optional: Log for debugging
  if (process.env.DEBUG_AUDIT === "true") {
    // eslint-disable-next-line no-console
    console.debug(`[AUDIT IP] ${req.method} ${req.path} from ${req.clientIP}`);
  }

  next();
};

module.exports = {
  captureClientIP,
  getClientIP,
};
