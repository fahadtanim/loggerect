import type { LogLevel, LogEntry } from "./types";
import { getConfig } from "./config";
import { formatLogEntry, formatTimestamp, getLevelStyle, getLevelBadge } from "./formatter";
import { safeConsole, isServer } from "./ssr";
import { getAnsiBadgeStyle, ANSI_COLORS } from "./colors";
import { inspect } from "util";

/**
 * Get appropriate console method for log level
 * Returns safe console wrapper methods for SSR compatibility
 */
function getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case "warn":
      return safeConsole.warn;
    case "error":
      return safeConsole.error;
    default:
      return safeConsole.log; // trace, debug, info use console.log
  }
}

/**
 * Output log entry to console
 * Uses safeConsole wrapper for SSR compatibility
 */
export function outputToConsole(entry: LogEntry): void {
  const config = getConfig();

  if (config.silent) return;

  // Skip if console is not available (SSR safety)
  if (typeof console === "undefined") return;

  const formatted = formatLogEntry(entry);
  const onServer = isServer();

  if (Array.isArray(formatted)) {
    // Pretty format with styling
    const [format, ...args] = formatted;

    // Get the appropriate console method
    const method = getConsoleMethod(entry.level);

    // On server, format is a single ANSI-colored string; on client, it's CSS styling
    if (onServer && args.length === 0) {
      // Server: single string with ANSI codes
      method(format);
    } else {
      // Browser: CSS styling with %c format
      // To preserve browser's native source location, we need to ensure the actual data
      // is passed as a separate argument so the browser can track where it came from
      if (!onServer && entry.data !== undefined) {
        // For browser: log formatted message first, then data separately
        // This allows browser to show source location for the data object
        method(format, ...args);
        // The data will be logged separately below, preserving its source location
      } else {
        method(format, ...args);
      }
    }

    // Log additional data on separate lines if present with full context
    if (entry.data !== undefined) {
      if (onServer) {
        // Server: use ANSI colors matching CSS styling
        const badgeStyle = getAnsiBadgeStyle(entry.level);
        const reset = ANSI_COLORS.reset;
        const dim = ANSI_COLORS.dim;
        const source = ANSI_COLORS.source;
        const bold = ANSI_COLORS.bold;
        const timestamp = formatTimestamp(entry.timestamp);
        const levelBadge = getLevelBadge(entry.level);
        const componentInfo = entry.componentName
          ? `[${entry.componentName}]`
          : "";
        const functionInfo = entry.functionName
          ? `.${entry.functionName}()`
          : "";
        const sourceInfo = entry.sourcePath
          ? ` @ ${entry.sourcePath}${
              entry.lineNumber ? `:${entry.lineNumber}` : ""
            }`
          : "";
        
        // Use util.inspect for proper nested object display with higher depth
        // Use at least depth 10 to show nested objects properly, but respect config if higher
        const inspectedData = inspect(entry.data, {
          depth: Math.max(config.maxDepth || 4, 10), // Show nested objects at least 10 levels deep
          colors: true, // Enable ANSI colors
          compact: false, // Use multi-line format for better readability
          maxArrayLength: config.maxArrayLength || 100,
          maxStringLength: config.maxStringLength || 1000,
          breakLength: 80,
          sorted: false,
          showHidden: false,
        });
        
        safeConsole.log(
          `${dim}[${timestamp}]${reset} ${badgeStyle.bg}${badgeStyle.text}${bold} ${levelBadge} ${entry.level.toUpperCase()} ${badgeStyle.reset}| 📊 ${componentInfo}${functionInfo} Data:${source}${sourceInfo}${reset}\n${inspectedData}`
        );
      } else {
        // Browser: use CSS styling
        const timestamp = formatTimestamp(entry.timestamp);
        const levelStyle = getLevelStyle(entry.level);
        const levelBadge = getLevelBadge(entry.level);
        const componentInfo = entry.componentName
          ? `[${entry.componentName}]`
          : "";
        const functionInfo = entry.functionName
          ? `.${entry.functionName}()`
          : "";
        const sourceInfo = entry.sourcePath
          ? ` @ ${entry.sourcePath}${
              entry.lineNumber ? `:${entry.lineNumber}` : ""
            }`
          : "";
        // Log formatted message first
        safeConsole.log(
          `%c[%s] %c%s %s %c| 📊 ${componentInfo}${functionInfo} Data:%c${sourceInfo}`,
          "color: #6B7280; font-size: 10px;",
          timestamp,
          levelStyle,
          levelBadge,
          entry.level.toUpperCase(),
          "color: #10B981; font-weight: bold;",
          "color: #6B7280; font-size: 10px;"
        );
        // Log data as separate argument so browser can show its source location
        // The browser will show where this data object came from in the stack trace
        safeConsole.log(entry.data);
      }
    }

    if (entry.stackTrace) {
      if (onServer) {
        // Server: use ANSI colors matching CSS styling
        const badgeStyle = getAnsiBadgeStyle(entry.level);
        const reset = ANSI_COLORS.reset;
        const dim = ANSI_COLORS.dim;
        const bold = ANSI_COLORS.bold;
        const timestamp = formatTimestamp(entry.timestamp);
        const levelBadge = getLevelBadge(entry.level);
        safeConsole.log(
          `${dim}[${timestamp}]${reset} ${badgeStyle.bg}${badgeStyle.text}${bold} ${levelBadge} ${entry.level.toUpperCase()} ${badgeStyle.reset}| 📚 Stack:`,
          entry.stackTrace
        );
      } else {
        // Browser: use CSS styling
        const timestamp = formatTimestamp(entry.timestamp);
        const levelStyle = getLevelStyle(entry.level);
        const levelBadge = getLevelBadge(entry.level);
        safeConsole.log(
          `%c[%s] %c%s %s %c| 📚 Stack:`,
          "color: #6B7280; font-size: 10px;",
          timestamp,
          levelStyle,
          levelBadge,
          entry.level.toUpperCase(),
          "color: #6B7280;",
          entry.stackTrace
        );
      }
    }
  } else {
    // String format (JSON, minimal, detailed)
    const method = getConsoleMethod(entry.level);
    method(formatted);
    if (entry.data !== undefined && config.format !== "json") {
      const componentInfo = entry.componentName
        ? `[${entry.componentName}]`
        : "";
      safeConsole.log(`   ${componentInfo} Data:`, entry.data);
    }
  }
}

