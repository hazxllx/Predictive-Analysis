import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const normalizedApiUrl = API.replace(/\/+$/, "");

const api = axios.create({
  baseURL: normalizedApiUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  if ((config.url || "").includes("/patients/me")) {
    console.log("[api] /patients/me request", {
      baseURL: config.baseURL,
      url: config.url,
      hasAuthHeader: Boolean(config.headers?.Authorization),
    });
  }

  return config;
});

export default api;
