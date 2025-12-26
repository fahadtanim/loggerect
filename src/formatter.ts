import type { LogEntry, LogFormat, LogLevel, LogStyle } from "./types";
import { getConfig } from "./config";

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
 * Get level badge
 */
export function getLevelBadge(level: LogLevel): string {
  const config = getConfig();
  return config.badges[level] || "";
}

/**
 * Get level style
 */
export function getLevelStyle(level: LogLevel): string {
  if (level === "silent") return "";
  const config = getConfig();
  const styles = config.styles as LogStyle;
  return styles[level] || "";
}

/**
 * Truncate string to max length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Safely stringify value with depth limit
 */
export function safeStringify(
  value: unknown,
  maxDepth = 4,
  currentDepth = 0,
  seen = new WeakSet()
): string {
  // Handle primitives
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string")
    return `"${truncateString(value, getConfig().maxStringLength)}"`;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "function")
    return `[Function: ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "bigint") return `${value}n`;

  // Handle depth limit
  if (currentDepth >= maxDepth) return "[...]";

  // Handle circular references
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const config = getConfig();
    const items = value.slice(0, config.maxArrayLength);
    const stringified = items.map((item) =>
      safeStringify(item, maxDepth, currentDepth + 1, seen)
    );
    const hasMore = value.length > config.maxArrayLength;
    return `[${stringified.join(", ")}${
      hasMore ? `, ... +${value.length - config.maxArrayLength} more` : ""
    }]`;
  }

  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle Error
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  // Handle Map
  if (value instanceof Map) {
    const entries = Array.from(value.entries()).slice(0, 10);
    const stringified = entries.map(
      ([k, v]) =>
        `${safeStringify(
          k,
          maxDepth,
          currentDepth + 1,
          seen
        )} => ${safeStringify(v, maxDepth, currentDepth + 1, seen)}`
    );
    return `Map(${value.size}) { ${stringified.join(", ")} }`;
  }

  // Handle Set
  if (value instanceof Set) {
    const items = Array.from(value).slice(0, 10);
    const stringified = items.map((item) =>
      safeStringify(item, maxDepth, currentDepth + 1, seen)
    );
    return `Set(${value.size}) { ${stringified.join(", ")} }`;
  }

  // Handle plain objects
  if (typeof value === "object") {
    const constructor = value.constructor?.name;
    const prefix =
      constructor && constructor !== "Object" ? `${constructor} ` : "";

    const entries = Object.entries(value).slice(0, 20);
    const stringified = entries.map(
      ([k, v]) => `${k}: ${safeStringify(v, maxDepth, currentDepth + 1, seen)}`
    );

    return `${prefix}{ ${stringified.join(", ")} }`;
  }

  return String(value);
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
 * Returns array of [format string, ...args] for console methods with %c styling
 */
export function formatAsPretty(entry: LogEntry): [string, ...unknown[]] {
  const config = getConfig();
  const style = getLevelStyle(entry.level);
  const badge = getLevelBadge(entry.level);

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

  // Component/Function name
  if (entry.componentName || entry.functionName) {
    format += " %c|%c ";
    args.push("color: #9CA3AF;", "color: inherit;");

    if (entry.componentName) {
      format += "%c%s";
      args.push("color: #8B5CF6; font-weight: bold;", entry.componentName);
    }
    if (entry.functionName) {
      format += entry.componentName ? ".%s()" : "%s()";
      args.push(entry.functionName);
    }
  }

  // Message
  format += " %c→%c %s";
  args.push("color: #9CA3AF;", "color: inherit;", entry.message);

  // Source path - show when available
  // Skip [bundled] paths (runtime stack trace in bundled env), but always show injected paths from babel plugin
  if (entry.sourcePath && !entry.sourcePath.startsWith('[bundled')) {
    format += " %c@ %s";
    args.push(
      "color: #6B7280; font-size: 10px;",
      `${entry.sourcePath}${entry.lineNumber ? `:${entry.lineNumber}` : ""}`
    );
  }

  return [format, ...args];
}

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
