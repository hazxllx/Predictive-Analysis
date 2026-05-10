/**
 * Admin Subsystem HTTP client (backend-only).
 *
 * Purpose:
 * - Authenticate the Predictive subsystem admin against the centralized Admin Subsystem.
 * - Ingest audit events to the Admin Subsystem (non-blocking for auth reliability).
 * - Fetch centralized subsystem reference services (optional).
 *
 * Security:
 * - The Admin Subsystem API key is only used server-side.
 * - Error messages are sanitized to avoid leaking upstream internals.
 * - Retry logic is applied only for safe retry conditions (network failures, 5xx/429).
 */
const axios = require("axios");

/**
 * Ensure a value is a plain object (rejects arrays/null).
 * @param {unknown} value
 * @param {string} name
 * @returns {object}
 */
function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

/**
 * Generic upstream error message shown to callers.
 * @returns {string}
 */
function sanitizeErrorMessage() {
  return "Unable to connect to authentication server.";
}

/**
 * Maps upstream auth failures into sanitized messages.
 * @param {"unauthorized"|"forbidden"} action
 * @returns {string}
 */
function normalizeAdminSubsystemError(action) {
  if (action === "unauthorized" || action === "forbidden") return "Authentication failed.";
  return sanitizeErrorMessage();
}

/**
 * Extract upstream HTTP status code from axios-style errors.
 * @param {any} err
 * @returns {number|null}
 */
function getUpstreamStatus(err) {
  const status = err?.response?.status;
  return typeof status === "number" ? status : null;
}

class AdminSubsystemClient {
  /**
   * @param {object} args
   * @param {string} args.baseURL Admin Subsystem base URI
   * @param {string} args.apiKey X-Subsystem-Key value (backend-only)
   * @param {string} args.subsystem Default subsystem identifier
   * @param {number} args.timeoutMs HTTP timeout
   * @param {number} args.maxRetries Number of retries on retryable failures
   */
  constructor({ baseURL, apiKey, subsystem, timeoutMs = 8000, maxRetries = 2 } = {}) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.subsystem = subsystem;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;

    this.http = axios.create({
      baseURL: this.baseURL ? this.baseURL.replace(/\/+$/, "") : undefined,
      timeout: this.timeoutMs,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "X-Subsystem-Key": this.apiKey } : {}),
      },
    });
  }

  /**
   * Execute an HTTP request with a bounded retry strategy.
   *
   * Retry policy:
   * - network errors (ECONNABORTED/ENOTFOUND/ECONNRESET)
   * - HTTP 5xx and 429
   *
   * Security behavior:
   * - never logs secrets (API keys, passwords, tokens)
   * @param {import("axios").AxiosRequestConfig} config
   * @returns {Promise<import("axios").AxiosResponse>}
   */
  async #requestWithRetry(config) {
    const attempts = Math.max(1, Number(this.maxRetries) + 1);
    let lastErr;

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.http.request(config);
      } catch (err) {
        lastErr = err;

        const status = getUpstreamStatus(err);

        const retryable =
          status === 429 ||
          (typeof status === "number" && status >= 500) ||
          err?.code === "ECONNABORTED" ||
          err?.code === "ENOTFOUND" ||
          err?.code === "ECONNRESET";

        if (!retryable || i === attempts - 1) throw lastErr;

        const backoffMs = 300 * (i + 1);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    throw lastErr;
  }

  /**
   * Authenticate a subsystem account with the Admin Subsystem.
   *
   * Inputs:
   * - username/password
   * - subsystem override (optional)
   *
   * Output:
   * - { accessToken, user } on success
   *
   * Error handling:
   * - returns sanitized errors for 401/403 and network failures.
   * @param {object} args
   * @param {string} args.username
   * @param {string} args.password
   * @param {string} [args.subsystem]
   * @returns {Promise<{accessToken: string, user: object}>}
   */
  async subsystemLogin({ username, password, subsystem } = {}) {
    const payload = {
      username,
      password,
      subsystem: subsystem || this.subsystem,
    };

    const res = await this.#requestWithRetry({
      method: "post",
      url: "/admin/api/auth/subsystem-login",
      data: payload,
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status >= 200 && res.status < 300) {
      assertPlainObject(res.data, "subsystemLogin response");
      const accessToken = res.data?.accessToken;
      const user = res.data?.user;

      if (!accessToken || !user) {
        throw new Error("Malformed subsystem login response");
      }
      return { accessToken, user };
    }

    const status = res.status;
    if (status === 401) throw new Error(normalizeAdminSubsystemError("unauthorized"));
    if (status === 403) throw new Error(normalizeAdminSubsystemError("forbidden"));
    throw new Error(sanitizeErrorMessage());
  }

  /**
   * Ingest an audit event to the Admin Subsystem.
   *
   * Reliability:
   * - audit ingestion failures must not block auth/login.
   *
   * Inputs:
   * - accessToken for Authorization header (Bearer)
   * - payload contains event details
   *
   * @param {object} args
   * @param {string} args.accessToken
   * @param {object} args.payload
   * @returns {Promise<object|null>}
   */
  async ingestAudit({ accessToken, payload } = {}) {
    const res = await this.#requestWithRetry({
      method: "post",
      url: "/admin/api/audit/ingest",
      data: payload,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status >= 200 && res.status < 300) return res.data;

    return null;
  }

  /**
   * Fetch centralized reference services from the Admin Subsystem.
   * @param {object} args
   * @param {string} args.accessToken
   * @returns {Promise<object>}
   */
  async getSubsystemServices({ accessToken } = {}) {
    const res = await this.#requestWithRetry({
      method: "get",
      url: "/admin/api/subsystem/services",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status >= 200 && res.status < 300) {
      assertPlainObject(res.data, "subsystem services response");
      return res.data;
    }

    const status = res.status;
    if (status === 401 || status === 403) throw new Error(normalizeAdminSubsystemError("unauthorized"));
    throw new Error(sanitizeErrorMessage());
  }
}

module.exports = { AdminSubsystemClient };
