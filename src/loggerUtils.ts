import type { LogLevel, LogEntry, LogContext } from "./types";
import { getConfig } from "./config";
import { getSourceLocation, getStackTrace } from "./sourceTracker";

/**
 * Create a log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  data?: unknown,
  context?: LogContext,
  skipFrames = 2
): LogEntry {
  const config = getConfig();

  // Check if babel plugin injected source location
  const injectedSource = context?.metadata?.__source as
    | {
        file?: string;
        line?: number;
        column?: number;
      }
    | undefined;

  // Get runtime source location (fallback)
  const sourceLocation = getSourceLocation(skipFrames);

  // Prioritize injected source from babel plugin over runtime stack trace
  const sourcePath =
    injectedSource?.file || sourceLocation.filePath || undefined;
  const lineNumber =
    injectedSource?.line || sourceLocation.lineNumber || undefined;
  const columnNumber =
    injectedSource?.column || sourceLocation.columnNumber || undefined;

  // Clean metadata - remove __source as it's internal
  const cleanMetadata = { ...context?.metadata };
  delete cleanMetadata.__source;

  // Filter out React/Node.js internal function names and minified names
  let functionName = sourceLocation.functionName || undefined;
  if (functionName) {
    // Filter out single-letter function names (minified code like "k", "a", etc.)
    if (functionName.length === 1) {
      functionName = undefined;
    } else {
      const internalPatterns = [
        "react_stack",
        "react_internal",
        "Object.",
        "react-dom",
        "AsyncResource",
        "runInAsyncScope",
        "processTicksAndRejections",
        "nextTick",
        "node:",
        "anonymous",
        "<anonymous>",
      ];
      
      const isInternal = internalPatterns.some((pattern) =>
        functionName!.includes(pattern)
      );
      
      if (isInternal) {
        functionName = undefined;
      }
    }
  }

  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    data,
    componentName:
      context?.componentName || sourceLocation.className || undefined,
    functionName,
    sourcePath,
    lineNumber,
    columnNumber,
    tags: context?.tags,
    metadata: {
      ...cleanMetadata,
      ...(context?.componentId && { componentId: context.componentId }),
    },
  };

  // Add stack trace for errors
  if (level === "error" && config.includeStackTrace) {
    entry.stackTrace = getStackTrace(skipFrames);
  }

  // Apply filter
  if (config.filter && !config.filter(entry)) {
    return entry; // Return but won't be logged
  }

  // Apply transformer
  if (config.transformer) {
    return config.transformer(entry);
  }

  return entry;
}

/**
 * Summarize props for logging (avoid logging full React elements)
 */
export function summarizeProps(
  props: Record<string, unknown>
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === "children") {
      summary[key] = typeof value === "string" ? value : "[React Element]";
    } else if (typeof value === "function") {
      summary[key] = `[Function: ${value.name || "anonymous"}]`;
    } else if (value && typeof value === "object" && "$$typeof" in value) {
      summary[key] = "[React Element]";
    } else {
      summary[key] = value;
    }
  }

  return summary;
}

