/**
 * SSR (Server-Side Rendering) utilities for logrect
 * 
 * These utilities help logrect work correctly in both client and server environments.
 */

/**
 * Check if code is running on the server (SSR)
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Check if code is running on the client (browser)
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * Safe performance.now() that works on both client and server
 */
export function safePerformanceNow(): number {
  if (isClient() && typeof performance !== "undefined") {
    return performance.now();
  }
  // Fallback for server - use process.hrtime if available, otherwise Date.now()
  if (typeof process !== "undefined" && process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1000000;
  }
  return Date.now();
}

/**
 * Safe localStorage access
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (isClient() && typeof localStorage !== "undefined") {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  },
  
  setItem(key: string, value: string): void {
    if (isClient() && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage full or unavailable
      }
    }
  },
  
  removeItem(key: string): void {
    if (isClient() && typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage unavailable
      }
    }
  }
};

/**
 * Safe console methods that work on both client and server
 */
export const safeConsole = {
  log: (...args: unknown[]) => {
    if (typeof console !== "undefined") console.log(...args);
  },
  debug: (...args: unknown[]) => {
    if (typeof console !== "undefined") console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (typeof console !== "undefined") console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (typeof console !== "undefined") console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (typeof console !== "undefined") console.error(...args);
  },
  table: (data: unknown[], columns?: string[]) => {
    if (typeof console !== "undefined" && console.table) {
      console.table(data, columns);
    }
  },
  group: (label: string) => {
    if (typeof console !== "undefined" && console.group) {
      console.group(label);
    }
  },
  groupCollapsed: (label: string) => {
    if (typeof console !== "undefined" && console.groupCollapsed) {
      console.groupCollapsed(label);
    }
  },
  groupEnd: () => {
    if (typeof console !== "undefined" && console.groupEnd) {
      console.groupEnd();
    }
  },
  clear: () => {
    if (typeof console !== "undefined" && console.clear) {
      console.clear();
    }
  }
};

