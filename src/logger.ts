import type {
  LogLevel,
  LogEntry,
  LogContext,
  LogTransport,
  PerformanceMeasurement,
  LogrectUserConfig,
} from "./types";
import { getConfig, configure, isDevelopment } from "./config";
import { safePerformanceNow, safeConsole } from "./ssr";
import { createLogEntry, summarizeProps } from "./loggerUtils";
import { processLog, flushLogs } from "./logProcessor";
import {
  addTransport as addTransportUtil,
  removeTransport as removeTransportUtil,
} from "./transports";
import {
  getPersistedLogs as getPersistedLogsUtil,
  clearPersistedLogs as clearPersistedLogsUtil,
  exportLogs as exportLogsUtil,
} from "./storage";

/**
 * Performance timers storage
 */
const performanceTimers = new Map<
  string,
  { startTime: number; metadata?: Record<string, unknown> }
>();

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
    return addTransportUtil(transport);
  }

  /**
   * Remove a custom transport
   */
  removeTransport(transport: LogTransport): boolean {
    return removeTransportUtil(transport);
  }

  /**
   * Get persisted logs
   */
  getPersistedLogs(): LogEntry[] {
    return getPersistedLogsUtil();
  }

  /**
   * Clear persisted logs
   */
  clearPersistedLogs(): void {
    clearPersistedLogsUtil();
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return exportLogsUtil();
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
