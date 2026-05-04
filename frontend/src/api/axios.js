import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://predictive-analysis-production.up.railway.app";
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
