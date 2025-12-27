import { getConfig } from "./config";

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 1000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Format timestamp based on configuration
 */
export function formatTimestamp(date: Date): string {
  const config = getConfig();

  switch (config.timestampFormat) {
    case "iso":
      return date.toISOString();
    case "unix":
      return String(date.getTime());
    case "relative":
      return formatRelativeTime(date);
    case "locale":
    default:
      return date.toLocaleTimeString();
  }
}

