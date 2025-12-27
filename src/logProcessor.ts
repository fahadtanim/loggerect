import type { LogEntry } from "./types";
import { getConfig, shouldLog } from "./config";
import { outputToConsole } from "./consoleOutput";
import { runTransports } from "./transports";
import { persistLog } from "./storage";

/**
 * Log batch storage
 */
let logBatch: LogEntry[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Process a log entry
 */
export function processLog(entry: LogEntry): void {
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
export function flushLogs(): void {
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

