import axios from "axios";

// Vite exposes only VITE_* values. Keep the client on one API base URL variable.
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const normalizedApiUrl = API.replace(/\/+$/, "");

const api = axios.create({
  baseURL: normalizedApiUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

export default api;
