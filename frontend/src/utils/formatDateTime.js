/**
 * Format Date Time Utility
 *
 * Formats an ISO date string into a human-readable PH locale string.
 * Returns a fallback string if the value is invalid or missing.
 */
export function formatDateTime(value, fallback = "N/A") {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}
