/**
 * Centralized frontend environment configuration.
 * Only exposes non-secret, client-safe values.
 */
export const API_URL = import.meta.env.VITE_API_URL || "";

export const IS_PROD = import.meta.env.PROD === true;
export const IS_DEV = import.meta.env.DEV === true;
