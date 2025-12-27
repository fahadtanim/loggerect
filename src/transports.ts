import type { LogEntry, LogTransport } from "./types";
import { getConfig } from "./config";
import { safeConsole } from "./ssr";

/**
 * Custom transports
 */
const transports: Set<LogTransport> = new Set();

/**
 * Run custom transports
 */
export async function runTransports(entry: LogEntry): Promise<void> {
  const config = getConfig();
  const allTransports = [...transports, ...config.transports];

  for (const transport of allTransports) {
    try {
      await transport(entry);
    } catch (error) {
      safeConsole.error("[logrect] Transport error:", error);
    }
  }
}

/**
 * Add a custom transport
 */
export function addTransport(transport: LogTransport): () => void {
  transports.add(transport);
  return () => transports.delete(transport);
}

/**
 * Remove a custom transport
 */
export function removeTransport(transport: LogTransport): boolean {
  return transports.delete(transport);
}

/**
 * Get all transports
 */
export function getTransports(): Set<LogTransport> {
  return transports;
}

