import { getConfig } from "./config";

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

