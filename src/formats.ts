import type { LogEntry } from "./types";
import { getConfig } from "./config";
import { isServer } from "./ssr";
import { formatTimestamp } from "./timestamp";
import {
  getLevelBadge,
  getLevelStyle,
  getAnsiBadgeStyle,
  ANSI_COLORS,
} from "./colors";
import { safeStringify } from "./stringUtils";

/**
 * Check if a function name is an internal React/Node.js function or minified
 */
function isInternalFunctionName(functionName: string): boolean {
  // Filter out single-letter function names (minified code)
  if (functionName.length === 1) {
    return true;
  }
  
  const internalPatterns = [
    "react_stack",
    "react_internal",
    "Object.",
    "AsyncResource",
    "runInAsyncScope",
    "processTicksAndRejections",
    "nextTick",
    "node:",
    "anonymous",
    "<anonymous>",
  ];
  
  return internalPatterns.some((pattern) => functionName.includes(pattern));
}

/**
 * Format log entry as JSON
 */
export function formatAsJSON(entry: LogEntry): string {
  return JSON.stringify(
    {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      ...(entry.componentName && { component: entry.componentName }),
      ...(entry.functionName && { function: entry.functionName }),
      ...(entry.sourcePath && { source: entry.sourcePath }),
      ...(entry.lineNumber && { line: entry.lineNumber }),
      ...(entry.data !== undefined && { data: entry.data }),
      ...(entry.tags?.length && { tags: entry.tags }),
      ...(entry.metadata &&
        Object.keys(entry.metadata).length && { metadata: entry.metadata }),
    },
    null,
    2
  );
}

/**
 * Format log entry as minimal string
 */
export function formatAsMinimal(entry: LogEntry): string {
  const parts: string[] = [];

  parts.push(`[${entry.level.toUpperCase()}]`);

  if (entry.componentName) {
    parts.push(`<${entry.componentName}>`);
  }

  parts.push(entry.message);

  return parts.join(" ");
}

/**
 * Format log entry as detailed string
 */
export function formatAsDetailed(entry: LogEntry): string[] {
  const config = getConfig();
  const lines: string[] = [];

  // Header line
  let header = "";
  if (config.timestamps) {
    header += `[${formatTimestamp(entry.timestamp)}] `;
  }
  header += `${getLevelBadge(entry.level)} ${entry.level.toUpperCase()}`;

  if (entry.componentName) {
    header += ` | ${entry.componentName}`;
  }
  if (entry.functionName) {
    header += `.${entry.functionName}()`;
  }

  lines.push(header);

  // Message line
  lines.push(`  📝 ${entry.message}`);

  // Source path
  if (entry.sourcePath) {
    lines.push(
      `  📍 ${entry.sourcePath}${
        entry.lineNumber ? `:${entry.lineNumber}` : ""
      }`
    );
  }

  // Data
  if (entry.data !== undefined) {
    lines.push(`  📊 Data: ${safeStringify(entry.data, config.maxDepth)}`);
  }

  // Tags
  if (entry.tags?.length) {
    lines.push(`  🏷️  Tags: ${entry.tags.join(", ")}`);
  }

  // Metadata
  if (entry.metadata && Object.keys(entry.metadata).length) {
    lines.push(`  📋 Metadata: ${safeStringify(entry.metadata, 2)}`);
  }

  // Stack trace
  if (entry.stackTrace) {
    lines.push(`  📚 Stack trace:`);
    entry.stackTrace.split("\n").forEach((line) => {
      lines.push(`      ${line}`);
    });
  }

  return lines;
}

/**
 * Format log entry as pretty console output
 * Returns array of [format string, ...args] for console methods
 * Uses CSS styling for browser, ANSI colors for server
 */
export function formatAsPretty(entry: LogEntry): [string, ...unknown[]] {
  const config = getConfig();
  const badge = getLevelBadge(entry.level);
  const onServer = isServer();

  // Server console: use ANSI colors matching CSS styling
  if (onServer) {
    const badgeStyle = getAnsiBadgeStyle(entry.level);
    const reset = ANSI_COLORS.reset;
    const dim = ANSI_COLORS.dim;
    const separator = ANSI_COLORS.separator;
    const source = ANSI_COLORS.source;
    const purple = ANSI_COLORS.purple;
    const bold = ANSI_COLORS.bold;

    let message = "";

    // Timestamp
    if (config.timestamps) {
      message += `${dim}[${formatTimestamp(entry.timestamp)}]${reset} `;
    }

    // Level badge and name - match CSS styling with background, text color, and spacing
    // CSS: padding: 2px 8px; border-radius: 4px; font-weight: 600;
    // ANSI equivalent: add more space between icon and text
    message += `${badgeStyle.bg}${badgeStyle.text}${bold} ${badge}  ${entry.level.toUpperCase()} ${badgeStyle.reset}`;

    // Component/Function name - only show component name, filter out internal function names
    if (entry.componentName) {
      message += ` ${separator}|${reset} `;
      message += `${purple}${bold}${entry.componentName}${reset}`;
      // Only show function name if it's not an internal React/Node.js function
      if (entry.functionName && !isInternalFunctionName(entry.functionName)) {
        message += `.${entry.functionName}()`;
      }
    } else if (entry.functionName && !isInternalFunctionName(entry.functionName)) {
      // Only show function name if no component name and it's not internal
      message += ` ${separator}|${reset} `;
      message += `${entry.functionName}()`;
    }

    // Message
    message += ` ${separator}→${reset} ${entry.message}`;

    // Source path - only show if it's not empty (filtered out node_modules, etc.)
    if (entry.sourcePath && entry.sourcePath !== "") {
      message += ` ${source}@ ${entry.sourcePath}${
        entry.lineNumber ? `:${entry.lineNumber}` : ""
      }${reset}`;
    }

    return [message];
  }

  // Browser console: use CSS styling
  const style = getLevelStyle(entry.level);
  let format = "";
  const args: unknown[] = [];

  // Timestamp
  if (config.timestamps) {
    format += "%c[%s] ";
    args.push(
      "color: #6B7280; font-size: 10px;",
      formatTimestamp(entry.timestamp)
    );
  }

  // Level badge and name
  format += "%c%s %s";
  args.push(style, badge, entry.level.toUpperCase());

  // Component/Function name - only show component name, filter out internal function names
  if (entry.componentName) {
    format += " %c|%c ";
    args.push("color: #9CA3AF;", "color: inherit;");
    format += "%c%s";
    args.push("color: #8B5CF6; font-weight: bold;", entry.componentName);
    // Only show function name if it's not an internal React/Node.js function
    if (entry.functionName && !isInternalFunctionName(entry.functionName)) {
      format += ".%s()";
      args.push(entry.functionName);
    }
  } else if (entry.functionName && !isInternalFunctionName(entry.functionName)) {
    // Only show function name if no component name and it's not internal
    format += " %c|%c ";
    args.push("color: #9CA3AF;", "color: inherit;");
    format += "%s()";
    args.push(entry.functionName);
  }

  // Message
  format += " %c→%c %s";
  args.push("color: #9CA3AF;", "color: inherit;", entry.message);

  // Source path - show when available
  // In browser, skip [bundled] paths (runtime stack trace in bundled env), but always show injected paths from babel plugin
  // In SSR, show bundled paths as they contain useful information
  if (entry.sourcePath) {
    // Only filter out [bundled] in browser, not in SSR
    if (onServer || !entry.sourcePath.startsWith("[bundled")) {
      format += " %c@ %s";
      args.push(
        "color: #6B7280; font-size: 10px;",
        `${entry.sourcePath}${entry.lineNumber ? `:${entry.lineNumber}` : ""}`
      );
    }
  }

  return [format, ...args];
}

