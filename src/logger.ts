import type {
  LogLevel,
  LogEntry,
  LogContext,
  LogTransport,
  PerformanceMeasurement,
  LogrectUserConfig,
} from "./types";
import { getConfig, shouldLog, configure, isDevelopment } from "./config";
import { getSourceLocation, getStackTrace } from "./sourceTracker";
import { formatLogEntry, formatTimestamp, getLevelStyle, getLevelBadge } from "./formatter";
import { safePerformanceNow, safeLocalStorage, safeConsole } from "./ssr";

/**
 * Performance timers storage
 */
const performanceTimers = new Map<
  string,
  { startTime: number; metadata?: Record<string, unknown> }
>();

/**
 * Log batch storage
 */
let logBatch: LogEntry[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Persisted logs storage
 */
const persistedLogs: LogEntry[] = [];

/**
 * Custom transports
 */
const transports: Set<LogTransport> = new Set();

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  data?: unknown,
  context?: LogContext,
  skipFrames = 2
): LogEntry {
  const config = getConfig();
  
  // Check if babel plugin injected source location
  const injectedSource = context?.metadata?.__source as {
    file?: string;
    line?: number;
    column?: number;
  } | undefined;
  
  // Get runtime source location (fallback)
  const sourceLocation = getSourceLocation(skipFrames);

  // Prioritize injected source from babel plugin over runtime stack trace
  const sourcePath = injectedSource?.file || sourceLocation.filePath || undefined;
  const lineNumber = injectedSource?.line || sourceLocation.lineNumber || undefined;
  const columnNumber = injectedSource?.column || sourceLocation.columnNumber || undefined;

  // Clean metadata - remove __source as it's internal
  const cleanMetadata = { ...context?.metadata };
  delete cleanMetadata.__source;

  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    data,
    componentName:
      context?.componentName || sourceLocation.className || undefined,
    functionName: sourceLocation.functionName || undefined,
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
 * Output log entry to console
 * NOTE: We call console methods directly (not through wrappers) so the browser's
 * native source link points to the actual logging call site, not our wrapper.
 */
function outputToConsole(entry: LogEntry): void {
  const config = getConfig();

  if (config.silent) return;
  
  // Skip if console is not available (SSR safety)
  if (typeof console === "undefined") return;

  const formatted = formatLogEntry(entry);

  if (Array.isArray(formatted)) {
    // Pretty format with styling - use single line output for accurate source tracking
    const [format, ...args] = formatted;
    
    // Get the appropriate console method
    const method = getConsoleMethod(entry.level);
    
    // Log the main message
    method.call(console, format, ...args);
    
    // Log additional data on separate lines if present with full context
    if (entry.data !== undefined) {
      const timestamp = formatTimestamp(entry.timestamp);
      const levelStyle = getLevelStyle(entry.level);
      const levelBadge = getLevelBadge(entry.level);
      const componentInfo = entry.componentName ? `[${entry.componentName}]` : "";
      const functionInfo = entry.functionName ? `.${entry.functionName}()` : "";
      const sourceInfo = entry.sourcePath ? ` @ ${entry.sourcePath}${entry.lineNumber ? `:${entry.lineNumber}` : ""}` : "";
      console.log(
        `%c[%s] %c%s %s %c| 📊 ${componentInfo}${functionInfo} Data:%c${sourceInfo}`,
        "color: #6B7280; font-size: 10px;",
        timestamp,
        levelStyle,
        levelBadge,
        entry.level.toUpperCase(),
        "color: #10B981; font-weight: bold;",
        "color: #6B7280; font-size: 10px;",
        entry.data
      );
    }
    
    if (entry.stackTrace) {
      const timestamp = formatTimestamp(entry.timestamp);
      const levelStyle = getLevelStyle(entry.level);
      const levelBadge = getLevelBadge(entry.level);
      console.log(
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
  } else {
    // String format (JSON, minimal, detailed)
    const method = getConsoleMethod(entry.level);
    method.call(console, formatted);
    if (entry.data !== undefined && config.format !== "json") {
      const componentInfo = entry.componentName ? `[${entry.componentName}]` : "";
      console.log(`   ${componentInfo} Data:`, entry.data);
    }
  }
}

/**
 * Get appropriate console method for log level
 */
function getConsoleMethod(level: LogLevel): typeof console.log {
  switch (level) {
    case "warn":
      return console.warn;
    case "error":
      return console.error;
    default:
      return console.log;  // trace, debug, info use console.log
  }
}

/**
 * Process a log entry
 */
function processLog(entry: LogEntry): void {
  const config = getConfig();

  if (!shouldLog(entry.level)) return;

  // Check filter
  if (config.filter && !config.filter(entry)) return;

  if (config.batchLogs) {
    logBatch.push(entry);

    if (!batchTimer) {
      batchTimer = setTimeout(() => {
        flushLogs();
      }, config.batchInterval);
    }
  } else {
    outputToConsole(entry);
    runTransports(entry);

    if (config.persist) {
      persistLog(entry);
    }
  }
}

/**
 * Flush batched logs
 */
function flushLogs(): void {
  const config = getConfig();

  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  const batch = [...logBatch];
  logBatch = [];

  batch.forEach((entry) => {
    outputToConsole(entry);
    runTransports(entry);

    if (config.persist) {
      persistLog(entry);
    }
  });
}

/**
 * Run custom transports
 */
async function runTransports(entry: LogEntry): Promise<void> {
  const config = getConfig();
  const allTransports = [...transports, ...config.transports];

  for (const transport of allTransports) {
    try {
      await transport(entry);
    } catch (error) {
      console.error("[logrect] Transport error:", error);
    }
  }
}

/**
 * Persist log entry to storage
 */
function persistLog(entry: LogEntry): void {
  const config = getConfig();

  persistedLogs.push(entry);

  // Trim if over limit
  while (persistedLogs.length > config.maxPersistedLogs) {
    persistedLogs.shift();
  }

  // Save to localStorage if available (client-side only)
  safeLocalStorage.setItem(config.storageKey, JSON.stringify(persistedLogs));
}

/**
 * Main logger class
 */
class Logger {
  private context: LogContext = {};

  /**
   * Configure the logger
   */
  configure(config: LogrectUserConfig): this {
    configure(config);
    return this;
  }

  /**
   * Create a child logger with context
   */
  withContext(context: LogContext): Logger {
    const child = new Logger();
    child.context = { ...this.context, ...context };
    return child;
  }

  /**
   * Create a logger for a specific component
   */
  forComponent(componentName: string, componentId?: string): Logger {
    return this.withContext({
      componentName,
      componentId: componentId || `${componentName}_${Date.now()}`,
    });
  }

  /**
   * Add tags to logger context
   */
  withTags(...tags: string[]): Logger {
    return this.withContext({
      tags: [...(this.context.tags || []), ...tags],
    });
  }

  /**
   * Add metadata to logger context
   */
  withMetadata(metadata: Record<string, unknown>): Logger {
    return this.withContext({
      metadata: { ...this.context.metadata, ...metadata },
    });
  }

  /**
   * Log at trace level
   */
  trace(message: string, data?: unknown): void {
    const entry = createLogEntry("trace", message, data, this.context, 3);
    processLog(entry);
  }

  /**
   * Log at debug level
   */
  debug(message: string, data?: unknown): void {
    const entry = createLogEntry("debug", message, data, this.context, 3);
    processLog(entry);
  }

  /**
   * Log at info level
   */
  info(message: string, data?: unknown): void {
    const entry = createLogEntry("info", message, data, this.context, 3);
    processLog(entry);
  }

  /**
   * Log at warn level
   */
  warn(message: string, data?: unknown): void {
    const entry = createLogEntry("warn", message, data, this.context, 3);
    processLog(entry);
  }

  /**
   * Log at error level
   */
  error(message: string, data?: unknown): void {
    const entry = createLogEntry("error", message, data, this.context, 3);
    processLog(entry);
  }

  /**
   * Log at any level
   */
  log(level: LogLevel, message: string, data?: unknown): void {
    const entry = createLogEntry(level, message, data, this.context, 3);
    processLog(entry);
  }

  /**
   * Log component render
   */
  render(componentName: string, props?: Record<string, unknown>): void {
    if (!getConfig().trackRenders) return;

    const badge = getConfig().badges.render || "🎨";
    const entry = createLogEntry(
      "debug",
      `${badge} Render`,
      props ? { props: summarizeProps(props) } : undefined,
      { ...this.context, componentName },
      3
    );
    processLog(entry);
  }

  /**
   * Log component mount
   */
  mount(componentName: string): void {
    const badge = getConfig().badges.mount || "🚀";
    const entry = createLogEntry(
      "info",
      `${badge} Mounted`,
      undefined,
      { ...this.context, componentName },
      3
    );
    processLog(entry);
  }

  /**
   * Log component unmount
   */
  unmount(componentName: string): void {
    const badge = getConfig().badges.unmount || "💤";
    const entry = createLogEntry(
      "info",
      `${badge} Unmounted`,
      undefined,
      { ...this.context, componentName },
      3
    );
    processLog(entry);
  }

  /**
   * Log prop changes
   */
  propsChanged(
    componentName: string,
    changes: Record<string, { prev: unknown; next: unknown }>
  ): void {
    if (!getConfig().trackPropChanges) return;

    const badge = getConfig().badges.props || "📦";
    const entry = createLogEntry(
      "debug",
      `${badge} Props changed`,
      changes,
      { ...this.context, componentName },
      3
    );
    processLog(entry);
  }

  /**
   * Log state changes
   */
  stateChanged(
    componentName: string,
    stateName: string,
    prevValue: unknown,
    nextValue: unknown
  ): void {
    if (!getConfig().trackStateChanges) return;

    const badge = getConfig().badges.state || "🗃️";
    const entry = createLogEntry(
      "debug",
      `${badge} State "${stateName}" changed`,
      { prev: prevValue, next: nextValue },
      { ...this.context, componentName },
      3
    );
    processLog(entry);
  }

  /**
   * Start a performance timer
   */
  time(label: string, metadata?: Record<string, unknown>): void {
    if (!getConfig().performance) return;

    performanceTimers.set(label, {
      startTime: safePerformanceNow(),
      metadata,
    });
  }

  /**
   * End a performance timer and log the duration
   */
  timeEnd(label: string): PerformanceMeasurement | null {
    if (!getConfig().performance) return null;

    const timer = performanceTimers.get(label);
    if (!timer) {
      this.warn(`Timer "${label}" does not exist`);
      return null;
    }

    performanceTimers.delete(label);

    const endTime = safePerformanceNow();
    const duration = endTime - timer.startTime;

    const measurement: PerformanceMeasurement = {
      name: label,
      duration,
      startTime: timer.startTime,
      endTime,
      metadata: timer.metadata,
    };

    const badge = getConfig().badges.time || "⏱️";
    const entry = createLogEntry(
      "debug",
      `${badge} ${label}: ${duration.toFixed(2)}ms`,
      timer.metadata,
      this.context,
      3
    );
    processLog(entry);

    return measurement;
  }

  /**
   * Measure async function execution time
   */
  async measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    this.time(label);
    try {
      const result = await fn();
      this.timeEnd(label);
      return result;
    } catch (error) {
      this.timeEnd(label);
      throw error;
    }
  }

  /**
   * Log a table (for arrays/objects)
   */
  table(data: unknown[], columns?: string[]): void {
    if (getConfig().silent) return;
    safeConsole.table(data, columns);
  }

  /**
   * Log with assertion
   */
  assert(condition: boolean, message: string, data?: unknown): void {
    if (!condition) {
      this.error(`Assertion failed: ${message}`, data);
    }
  }

  /**
   * Count occurrences
   */
  private counters = new Map<string, number>();

  count(label: string): number {
    const count = (this.counters.get(label) || 0) + 1;
    this.counters.set(label, count);
    this.debug(`${label}: ${count}`);
    return count;
  }

  countReset(label: string): void {
    this.counters.delete(label);
  }

  /**
   * Clear console
   */
  clear(): void {
    safeConsole.clear();
  }

  /**
   * Add a custom transport
   */
  addTransport(transport: LogTransport): () => void {
    transports.add(transport);
    return () => transports.delete(transport);
  }

  /**
   * Remove a custom transport
   */
  removeTransport(transport: LogTransport): boolean {
    return transports.delete(transport);
  }

  /**
   * Get persisted logs
   */
  getPersistedLogs(): LogEntry[] {
    return [...persistedLogs];
  }

  /**
   * Clear persisted logs
   */
  clearPersistedLogs(): void {
    persistedLogs.length = 0;
    safeLocalStorage.removeItem(getConfig().storageKey);
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(persistedLogs, null, 2);
  }

  /**
   * Flush any batched logs
   */
  flush(): void {
    flushLogs();
  }

  /**
   * Create a group of logs
   */
  group(label: string, collapsed = true): void {
    if (getConfig().silent) return;

    if (collapsed) {
      safeConsole.groupCollapsed(label);
    } else {
      safeConsole.group(label);
    }
  }

  /**
   * End a log group
   */
  groupEnd(): void {
    if (getConfig().silent) return;
    safeConsole.groupEnd();
  }

  /**
   * Check if in development mode
   */
  isDev(): boolean {
    return isDevelopment();
  }
}

/**
 * Summarize props for logging (avoid logging full React elements)
 */
function summarizeProps(
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

/**
 * Create and export the default logger instance
 */
export const logger = new Logger();

/**
 * Export Logger class for creating new instances
 */
export { Logger };

/**
 * Quick log functions
 */
export const trace = (message: string, data?: unknown) =>
  logger.trace(message, data);
export const debug = (message: string, data?: unknown) =>
  logger.debug(message, data);
export const info = (message: string, data?: unknown) =>
  logger.info(message, data);
export const warn = (message: string, data?: unknown) =>
  logger.warn(message, data);
export const error = (message: string, data?: unknown) =>
  logger.error(message, data);
