import type { LogEntry, LogFormat } from "./types";
import { getConfig } from "./config";
import { formatTimestamp } from "./timestamp";
import { getLevelBadge, getLevelStyle } from "./colors";
import { safeStringify } from "./stringUtils";
import {
  formatAsJSON,
  formatAsMinimal,
  formatAsDetailed,
  formatAsPretty,
} from "./formats";

/**
 * Format log entry based on current configuration
 */
export function formatLogEntry(
  entry: LogEntry,
  format?: LogFormat
): string | [string, ...unknown[]] {
  const config = getConfig();
  const outputFormat = format || config.format;

  switch (outputFormat) {
    case "json":
      return formatAsJSON(entry);
    case "minimal":
      return formatAsMinimal(entry);
    case "detailed":
      return formatAsDetailed(entry).join("\n");
    case "pretty":
    default:
      return formatAsPretty(entry);
  }
}

// Re-export commonly used functions
export { formatTimestamp, getLevelBadge, getLevelStyle, safeStringify };
export { formatAsJSON, formatAsMinimal, formatAsDetailed, formatAsPretty };
