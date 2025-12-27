import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type { LogContext } from "./types";
import { logger, Logger } from "./logger";
import { getConfig, shouldLog } from "./config";
import { isServer, safePerformanceNow } from "./ssr";

/**
 * Source location injected by babel plugin
 */
export interface InjectedSource {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

/**
 * Options with optional source injection from babel plugin
 */
export interface LoggerHookOptions extends Partial<LogContext> {
  __source?: InjectedSource;
}

/**
 * Hook to create a component-scoped logger
 * SSR-safe: returns a functional logger on both client and server
 *
 * @example
 * function MyComponent() {
 *   const log = useLogger('MyComponent');
 *
 *   useEffect(() => {
 *     log.info('Component mounted');
 *   }, []);
 *
 *   return <div>Hello</div>;
 * }
 */
export function useLogger(
  componentName: string,
  options: LoggerHookOptions = {}
): Logger {
  // Extract __source if provided by build plugin (babel, loader, vite)
  const { __source, ...logContext } = options;

  // Use useState for lazy initialization (React-compliant, SSR-safe)
  const [loggerInstance] = useState(() => {
    let instance = logger
      .forComponent(componentName)
      .withTags(...(logContext.tags || []))
      .withMetadata(logContext.metadata || {});

    // If build plugin (babel/loader/vite) injected source, add it to metadata
    if (__source) {
      instance = instance.withMetadata({
        __source: {
          file: __source.fileName,
          line: __source.lineNumber,
          column: __source.columnNumber,
        },
      });
    }

    return instance;
  });

  return loggerInstance;
}

/**
 * Hook to track component lifecycle with logging
 * SSR-safe: only logs on client-side
 *
 * @example
 * function MyComponent() {
 *   useLifecycleLogger('MyComponent');
 *   return <div>Hello</div>;
 * }
 */
export function useLifecycleLogger(
  componentName: string,
  options: LoggerHookOptions = {}
): void {
  const mountTime = useRef<number>(0);
  const log = useLogger(componentName, options);

  useEffect(() => {
    // Only run on client
    if (isServer()) return;

    mountTime.current = safePerformanceNow();
    log.mount(componentName);

    return () => {
      const lifetime = safePerformanceNow() - mountTime.current;
      log.info(`💤 Unmounted (lifetime: ${lifetime.toFixed(2)}ms)`);
    };
  }, [componentName, log]);
}

/**
 * Hook to track render count and performance
 * SSR-safe: tracks renders only on client, returns getter function
 *
 * @example
 * function MyComponent({ data }) {
 *   const { getStats } = useRenderLogger('MyComponent');
 *   // Access stats in event handlers or effects
 *   return <div>{data}</div>;
 * }
 */
export function useRenderLogger(
  componentName: string,
  options: LoggerHookOptions = {}
): {
  getStats: () => {
    count: number;
    lastRenderTime: number;
    averageRenderTime: number;
  };
} {
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);
  const lastRenderTimeRef = useRef<number | null>(null);
  const log = useLogger(componentName, options);

  // Track render timing in useEffect (SSR-safe)
  useEffect(() => {
    if (isServer()) return;

    const now = safePerformanceNow();
    renderCountRef.current += 1;

    if (lastRenderTimeRef.current !== null) {
      const renderTime = now - lastRenderTimeRef.current;
      renderTimesRef.current.push(renderTime);

      // Keep only last 10 render times
      if (renderTimesRef.current.length > 10) {
        renderTimesRef.current.shift();
      }

      const avgTime =
        renderTimesRef.current.reduce((a, b) => a + b, 0) /
        renderTimesRef.current.length;

      if (
        getConfig().trackRenders &&
        shouldLog("debug") &&
        renderCountRef.current > 1
      ) {
        log.debug(
          `🎨 Render #${renderCountRef.current} (${renderTime.toFixed(
            2
          )}ms, avg: ${avgTime.toFixed(2)}ms)`
        );
      }
    }

    lastRenderTimeRef.current = safePerformanceNow();
  });

  // Return getter function (SSR-safe pattern)
  const getStats = useCallback(() => {
    const avgTime =
      renderTimesRef.current.length > 0
        ? renderTimesRef.current.reduce((a, b) => a + b, 0) /
          renderTimesRef.current.length
        : 0;
    const lastTime =
      renderTimesRef.current.length > 0
        ? renderTimesRef.current[renderTimesRef.current.length - 1]
        : 0;

    return {
      count: renderCountRef.current,
      lastRenderTime: lastTime,
      averageRenderTime: avgTime,
    };
  }, []);

  return { getStats };
}

/**
 * Hook to track prop changes
 *
 * @example
 * function MyComponent(props) {
 *   usePropChangeLogger('MyComponent', props);
 *   return <div>{props.name}</div>;
 * }
 */
export function usePropChangeLogger<T extends Record<string, unknown>>(
  componentName: string,
  props: T,
  options: LoggerHookOptions = {}
): void {
  const prevProps = useRef<T | null>(null);
  const log = useLogger(componentName, options);

  useEffect(() => {
    if (
      prevProps.current &&
      getConfig().trackPropChanges &&
      shouldLog("debug")
    ) {
      const changes = detectChanges(prevProps.current, props);

      if (Object.keys(changes).length > 0) {
        log.debug("📦 Props changed", changes);
      }
    }

    prevProps.current = { ...props };
  });
}

/**
 * Hook to track state changes with logging
 *
 * @example
 * function Counter() {
 *   const [count, setCount] = useStateLogger('Counter', 'count', 0);
 *   return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
 * }
 */
export function useStateLogger<T>(
  componentName: string,
  stateName: string,
  initialValue: T,
  options: LoggerHookOptions = {}
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState(initialValue);
  const prevState = useRef<T>(initialValue);
  const isFirstRender = useRef(true);
  const log = useLogger(componentName, options); // Pass options with __source

  // Log state changes via useEffect to avoid Strict Mode double-logging
  useEffect(() => {
    // Skip logging on initial mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevState.current = state;
      return;
    }

    // Log the state change if different from previous
    if (
      !Object.is(prevState.current, state) &&
      getConfig().trackStateChanges &&
      shouldLog("debug")
    ) {
      log.debug(`🗃️ State "${stateName}" changed`, {
        prev: summarizeValue(prevState.current),
        next: summarizeValue(state),
      });
    }

    prevState.current = state;
  }, [state, stateName, log]);

  return [state, setState];
}

/**
 * Hook for logging effects
 * SSR-safe: only logs on client-side
 *
 * @example
 * function MyComponent() {
 *   useEffectLogger('MyComponent', 'fetchData', () => {
 *     fetchData();
 *   }, [dependency]);
 * }
 */
export function useEffectLogger(
  componentName: string,
  effectName: string,
  effect: React.EffectCallback,
  deps?: React.DependencyList,
  options: LoggerHookOptions = {}
): void {
  const log = useLogger(componentName, options);
  const effectCount = useRef(0);

  useEffect(() => {
    if (isServer()) return effect();

    effectCount.current++;

    if (shouldLog("debug")) {
      log.debug(`⚡ Effect "${effectName}" #${effectCount.current} running`);
    }

    const startTime = safePerformanceNow();
    const cleanup = effect();
    const duration = safePerformanceNow() - startTime;

    if (shouldLog("debug")) {
      log.debug(
        `⚡ Effect "${effectName}" completed (${duration.toFixed(2)}ms)`
      );
    }

    return () => {
      if (cleanup) {
        if (shouldLog("debug")) {
          log.debug(`🧹 Effect "${effectName}" cleanup`);
        }
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook for logging callback functions
 * SSR-safe: uses safePerformanceNow()
 *
 * @example
 * function MyComponent() {
 *   const handleClick = useCallbackLogger('MyComponent', 'handleClick', () => {
 *     console.log('clicked');
 *   }, []);
 * }
 */
export function useCallbackLogger<T extends (...args: unknown[]) => unknown>(
  componentName: string,
  callbackName: string,
  callback: T,
  deps: React.DependencyList,
  options: LoggerHookOptions = {}
): T {
  const log = useLogger(componentName, options);
  const callCount = useRef(0);

  return useCallback((...args: Parameters<T>) => {
    callCount.current++;

    if (shouldLog("debug")) {
      log.debug(
        `📞 ${callbackName}() called (#${callCount.current})`,
        args.length > 0 ? { args: args.map(summarizeValue) } : undefined
      );
    }

    const startTime = safePerformanceNow();

    try {
      const result = callback(...args);
      const duration = safePerformanceNow() - startTime;

      // Handle promises
      if (result instanceof Promise) {
        return result
          .then((res) => {
            if (shouldLog("debug")) {
              log.debug(
                `✅ ${callbackName}() resolved (${(
                  safePerformanceNow() - startTime
                ).toFixed(2)}ms)`
              );
            }
            return res;
          })
          .catch((err) => {
            log.error(`❌ ${callbackName}() rejected`, { error: err });
            throw err;
          }) as ReturnType<T>;
      }

      if (shouldLog("trace")) {
        log.trace(`✅ ${callbackName}() completed (${duration.toFixed(2)}ms)`);
      }

      return result as ReturnType<T>;
    } catch (error) {
      log.error(`❌ ${callbackName}() threw error`, { error });
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps) as T;
}

/**
 * Hook for logging memoized values
 * SSR-safe: uses safePerformanceNow()
 *
 * @example
 * function MyComponent({ items }) {
 *   const sortedItems = useMemoLogger('MyComponent', 'sortedItems',
 *     () => items.sort(),
 *     [items]
 *   );
 * }
 */
export function useMemoLogger<T>(
  componentName: string,
  memoName: string,
  factory: () => T,
  deps: React.DependencyList,
  options: LoggerHookOptions = {}
): T {
  const log = useLogger(componentName, options);
  const computeCount = useRef(0);

  return useMemo(() => {
    computeCount.current++;

    const startTime = safePerformanceNow();
    const result = factory();
    const duration = safePerformanceNow() - startTime;

    if (shouldLog("debug")) {
      log.debug(
        `🧮 Memo "${memoName}" computed (#${
          computeCount.current
        }, ${duration.toFixed(2)}ms)`
      );
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Hook for timing operations
 * SSR-safe: uses safePerformanceNow()
 *
 * @example
 * function MyComponent() {
 *   const { time, timeEnd, measure } = useTimer('MyComponent');
 *
 *   const handleClick = async () => {
 *     const result = await measure('fetchData', () => fetch('/api/data'));
 *   };
 * }
 */
export function useTimer(
  componentName: string,
  options: LoggerHookOptions = {}
) {
  const log = useLogger(componentName, options);
  const timers = useRef(new Map<string, number>());

  const time = useCallback(
    (label: string) => {
      if (isServer()) return;
      timers.current.set(label, safePerformanceNow());
      if (shouldLog("debug")) {
        log.debug(`⏱️ Timer "${label}" started`);
      }
    },
    [log]
  );

  const timeEnd = useCallback(
    (label: string): number | null => {
      if (isServer()) return null;
      const startTime = timers.current.get(label);
      if (startTime === undefined) {
        log.warn(`Timer "${label}" does not exist`);
        return null;
      }

      timers.current.delete(label);
      const duration = safePerformanceNow() - startTime;

      if (shouldLog("debug")) {
        log.debug(`⏱️ Timer "${label}": ${duration.toFixed(2)}ms`);
      }

      return duration;
    },
    [log]
  );

  const measure = useCallback(
    async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
      time(label);
      try {
        const result = await fn();
        timeEnd(label);
        return result;
      } catch (error) {
        timeEnd(label);
        throw error;
      }
    },
    [time, timeEnd]
  );

  return { time, timeEnd, measure };
}

/**
 * Hook for conditional logging
 *
 * @example
 * function MyComponent({ debugMode }) {
 *   const log = useConditionalLogger('MyComponent', debugMode);
 *   log.info('This only logs when debugMode is true');
 * }
 */
export function useConditionalLogger(
  componentName: string,
  condition: boolean,
  options: LoggerHookOptions = {}
): Logger {
  const baseLogger = useLogger(componentName, options);

  return useMemo(() => {
    if (condition) {
      return baseLogger;
    }

    // Return a no-op logger when condition is false
    const noopLogger = new Proxy(baseLogger, {
      get(target, prop) {
        if (typeof target[prop as keyof Logger] === "function") {
          return () => {};
        }
        return target[prop as keyof Logger];
      },
    });

    return noopLogger;
  }, [baseLogger, condition]);
}

/**
 * Hook for debugging re-renders - identifies why a component re-rendered
 * SSR-safe: only logs on client-side
 *
 * @example
 * function MyComponent(props) {
 *   useWhyDidYouRender('MyComponent', props);
 *   return <div>{props.name}</div>;
 * }
 */
export function useWhyDidYouRender<T extends Record<string, unknown>>(
  componentName: string,
  props: T,
  state?: Record<string, unknown>,
  options: LoggerHookOptions = {}
): void {
  const prevProps = useRef<T | null>(null);
  const prevState = useRef<Record<string, unknown> | null>(null);
  const log = useLogger(componentName, options);

  useEffect(() => {
    if (isServer()) return;

    const reasons: string[] = [];
    const changes: Record<
      string,
      { type: string; prev: unknown; next: unknown }
    > = {};

    // Check props
    if (prevProps.current) {
      const propChanges = detectChanges(prevProps.current, props);
      for (const [key, change] of Object.entries(propChanges)) {
        reasons.push(`prop "${key}" changed`);
        changes[`prop:${key}`] = { type: "prop", ...change };
      }
    }

    // Check state
    if (prevState.current && state) {
      const stateChanges = detectChanges(prevState.current, state);
      for (const [key, change] of Object.entries(stateChanges)) {
        reasons.push(`state "${key}" changed`);
        changes[`state:${key}`] = { type: "state", ...change };
      }
    }

    if (reasons.length > 0 && shouldLog("debug")) {
      log.debug(`🔍 Why did you render?`, {
        reasons,
        changes,
      });
    }

    prevProps.current = { ...props };
    if (state) {
      prevState.current = { ...state };
    }
  });
}

// ============================================
// Helper Functions
// ============================================

function detectChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, { prev: unknown; next: unknown }> {
  const changes: Record<string, { prev: unknown; next: unknown }> = {};

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    if (!Object.is(prev[key], next[key])) {
      changes[key] = {
        prev: summarizeValue(prev[key]),
        next: summarizeValue(next[key]),
      };
    }
  }

  return changes;
}

function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function")
    return `[Function: ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();

  if (typeof value === "object") {
    if ("$$typeof" in value) return "[React Element]";
    if (Array.isArray(value))
      return value.length > 5 ? `[Array(${value.length})]` : value;
  }

  if (typeof value === "string" && value.length > 100) {
    return value.slice(0, 100) + "...";
  }

  return value;
}
