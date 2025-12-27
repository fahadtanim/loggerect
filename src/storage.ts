import type { LogEntry } from "./types";
import { getConfig } from "./config";
import { safeLocalStorage } from "./ssr";

/**
 * Persisted logs storage
 */
const persistedLogs: LogEntry[] = [];

/**
 * Persist log entry to storage
 */
export function persistLog(entry: LogEntry): void {
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
 * Get persisted logs
 */
export function getPersistedLogs(): LogEntry[] {
  return [...persistedLogs];
}

/**
 * Clear persisted logs
 */
export function clearPersistedLogs(): void {
  persistedLogs.length = 0;
  safeLocalStorage.removeItem(getConfig().storageKey);
}

/**
 * Export logs as JSON
 */
export function exportLogs(): string {
  return JSON.stringify(persistedLogs, null, 2);
}

