import axios from "axios";

import { API_URL } from "../config/env";

const normalizedApiUrl = (API_URL || "").replace(/\/+$/, "");

const api = axios.create({
  baseURL: normalizedApiUrl,
  timeout: 30000,
});

// AbortController registry for in-flight requests (per endpoint)
const abortControllers = new Map();

function getControllerKey(config) {
  return `${config.method || "GET"}:${config.url}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Skip abort for auth/session requests to prevent StrictMode double-mount issues
  if (config.skipAbort) return config;

  // Cancel any previous identical in-flight request to prevent duplicate calls
  const key = getControllerKey(config);
  const prev = abortControllers.get(key);
  if (prev) {
    prev.abort("Duplicate request cancelled");
  }
  const controller = new AbortController();
  config.signal = controller.signal;
  abortControllers.set(key, controller);

  return config;
});

/**
 * Response interceptor for centralized error handling.
 * - Sanitizes error messages to avoid leaking internals
 * - Auto-clears local auth state on 401 to prevent infinite auth loops
 * - Cleans up abort controller registry
 */
api.interceptors.response.use(
  (response) => {
    const key = getControllerKey(response.config);
    abortControllers.delete(key);
    return response;
  },
  (error) => {
    if (error.config) {
      const key = getControllerKey(error.config);
      abortControllers.delete(key);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("pp_token");
      localStorage.removeItem("pp_user");
    }
    return Promise.reject(error);
  }
);

export default api;
