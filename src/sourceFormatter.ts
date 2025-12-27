import { isDevelopment } from "./config";
import { isBundledPath } from "./pathUtils";
import type { SourceLocation } from "./sourceLocation";

/**
 * Format source location for display
 */
export function formatSourceLocation(
  location: SourceLocation,
  verbose = false
): string {
  if (!location.filePath && !location.functionName) {
    return "";
  }

  const parts: string[] = [];

  if (verbose && location.functionName) {
    parts.push(location.functionName);
  }

  if (location.filePath) {
    let pathPart = isDevelopment()
      ? location.filePath
      : location.fileName || "";

    if (location.lineNumber !== null) {
      pathPart += `:${location.lineNumber}`;
      if (location.columnNumber !== null && verbose) {
        pathPart += `:${location.columnNumber}`;
      }
    }

    parts.push(pathPart);
  }

  return parts.join(" @ ");
}

/**
 * Create a source location link for IDEs (clickable in console)
 */
export function createSourceLink(location: SourceLocation): string {
  if (!location.fullPath) return "";

  // For bundled paths, don't show the ugly URL
  // The browser's DevTools already shows a clickable source-mapped link on the right
  if (isBundledPath(location.fullPath)) {
    return ""; // Let browser's native source link handle it
  }

  let link = location.fullPath;

  if (location.lineNumber !== null) {
    link += `:${location.lineNumber}`;
    if (location.columnNumber !== null) {
      link += `:${location.columnNumber}`;
    }
  }

  return link;
}

