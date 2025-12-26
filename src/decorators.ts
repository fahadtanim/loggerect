import type { DecoratorOptions } from "./types";
import { logger } from "./logger";
import { shouldLog, getConfig } from "./config";
import { getSourceLocation } from "./sourceTracker";

/**
 * Default decorator options
 */
const defaultDecoratorOptions: DecoratorOptions = {
  logEntry: true,
  logExit: false,
  logArgs: true,
  logReturn: false,
  logTime: true,
  logErrors: true,
  level: "debug",
  tags: [],
  prefix: "",
};

/**
 * Method decorator factory - logs method calls
 *
 * @example
 * class MyComponent extends React.Component {
 *   @Log()
 *   handleClick(event: MouseEvent) {
 *     // This method will be logged when called
 *   }
 *
 *   @Log({ logArgs: false, logTime: true })
 *   fetchData() {
 *     // Custom options
 *   }
 * }
 */
export function Log(options: Partial<DecoratorOptions> = {}) {
  const opts = { ...defaultDecoratorOptions, ...options };

  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = function (...args: unknown[]) {
      if (!shouldLog(opts.level!)) {
        return originalMethod.apply(this, args);
      }

      const componentLogger = logger
        .forComponent(className)
        .withTags(...(opts.tags || []));
      const prefix = opts.prefix ? `${opts.prefix} ` : "";
      getSourceLocation(1); // Capture source for stack trace context

      // Log entry
      if (opts.logEntry) {
        const message = `${prefix}→ ${propertyKey}()`;
        const data =
          opts.logArgs && args.length > 0
            ? { args: summarizeArgs(args) }
            : undefined;
        componentLogger.log(opts.level!, message, data);
      }

      const startTime = opts.logTime ? performance.now() : 0;

      try {
        const result = originalMethod.apply(this, args);

        // Handle async methods
        if (result instanceof Promise) {
          return result
            .then((resolvedValue) => {
              logExit(resolvedValue);
              return resolvedValue;
            })
            .catch((error) => {
              logError(error);
              throw error;
            });
        }

        logExit(result);
        return result;
      } catch (error) {
        logError(error);
        throw error;
      }

      function logExit(result: unknown) {
        if (opts.logExit || opts.logTime) {
          const duration = opts.logTime ? performance.now() - startTime : 0;
          const message = `${prefix}← ${propertyKey}()${
            opts.logTime ? ` (${duration.toFixed(2)}ms)` : ""
          }`;
          const data = opts.logReturn
            ? { result: summarizeValue(result) }
            : undefined;
          componentLogger.log(opts.level!, message, data);
        }
      }

      function logError(error: unknown) {
        if (opts.logErrors) {
          componentLogger.error(`${prefix}✕ ${propertyKey}() threw error`, {
            error:
              error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error,
            args: opts.logArgs ? summarizeArgs(args) : undefined,
          });
        }
      }
    };

    // Preserve function name and length
    Object.defineProperty(descriptor.value, "name", { value: propertyKey });

    return descriptor;
  };
}

/**
 * Class decorator factory - logs all methods in a class
 *
 * @example
 * @LogClass()
 * class MyComponent extends React.Component {
 *   handleClick() { }
 *   fetchData() { }
 *   // All methods will be logged
 * }
 */
export function LogClass(options: Partial<DecoratorOptions> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(
    constructor: T
  ): T {
    const className = constructor.name;

    // Get all method names from prototype
    const methodNames = Object.getOwnPropertyNames(
      constructor.prototype
    ).filter((name) => {
      if (name === "constructor") return false;
      const descriptor = Object.getOwnPropertyDescriptor(
        constructor.prototype,
        name
      );
      return descriptor && typeof descriptor.value === "function";
    });

    // Apply Log decorator to each method
    for (const methodName of methodNames) {
      const descriptor = Object.getOwnPropertyDescriptor(
        constructor.prototype,
        methodName
      );
      if (descriptor && typeof descriptor.value === "function") {
        const decoratedDescriptor = Log(options)(
          constructor.prototype,
          methodName,
          descriptor
        );
        Object.defineProperty(
          constructor.prototype,
          methodName,
          decoratedDescriptor
        );
      }
    }

    // Log class instantiation
    return class extends constructor {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...args);
        if (shouldLog(options.level || "debug")) {
          logger
            .forComponent(className)
            .debug(
              `📦 Instantiated ${className}`,
              args.length > 0
                ? { constructorArgs: summarizeArgs(args) }
                : undefined
            );
        }
      }
    };
  };
}

/**
 * Lifecycle decorator - logs React lifecycle methods
 *
 * @example
 * class MyComponent extends React.Component {
 *   @LogLifecycle()
 *   componentDidMount() { }
 *
 *   @LogLifecycle()
 *   componentWillUnmount() { }
 * }
 */
export function LogLifecycle(options: Partial<DecoratorOptions> = {}) {
  return Log({
    ...options,
    logEntry: true,
    logExit: true,
    logArgs: false,
    logTime: true,
  });
}

/**
 * Render decorator - logs render method calls with prop changes
 *
 * @example
 * class MyComponent extends React.Component {
 *   @LogRender()
 *   render() {
 *     return <div>Hello</div>;
 *   }
 * }
 */
export function LogRender(options: Partial<DecoratorOptions> = {}) {
  return function (
    target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalRender = descriptor.value;
    const className = target.constructor.name;

    let renderCount = 0;
    let prevProps: Record<string, unknown> | null = null;

    descriptor.value = function (this: { props?: Record<string, unknown> }) {
      renderCount++;

      if (!shouldLog(options.level || "debug")) {
        return originalRender.apply(this);
      }

      const componentLogger = logger.forComponent(className);
      const config = getConfig();

      // Detect prop changes
      let propChanges: Record<string, { prev: unknown; next: unknown }> | null =
        null;
      if (config.trackPropChanges && prevProps && this.props) {
        propChanges = detectChanges(prevProps, this.props);
      }

      const startTime = performance.now();
      const result = originalRender.apply(this);
      const duration = performance.now() - startTime;

      componentLogger.debug(
        `🎨 Render #${renderCount} (${duration.toFixed(2)}ms)`,
        propChanges && Object.keys(propChanges).length > 0
          ? { propChanges, renderCount }
          : { renderCount }
      );

      if (this.props) {
        prevProps = { ...this.props };
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * State change decorator - logs state changes
 * Only works with class components using setState
 *
 * @example
 * @LogState()
 * class MyComponent extends React.Component {
 *   state = { count: 0 };
 *   // setState calls will be logged
 * }
 */
export function LogState() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(
    constructor: T
  ): T {
    const className = constructor.name;

    return class extends constructor {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...args);

        // Store original setState
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = this as any;
        const originalSetState = self.setState;

        if (originalSetState) {
          self.setState = function (
            updater:
              | Record<string, unknown>
              | ((
                  prevState: Record<string, unknown>
                ) => Record<string, unknown>),
            callback?: () => void
          ) {
            const prevState: Record<string, unknown> = self.state || {};

            // Call original setState
            originalSetState.call(this, updater, () => {
              const nextState: Record<string, unknown> = self.state || {};

              // Detect state changes
              const changes = detectChanges(prevState, nextState);

              if (Object.keys(changes).length > 0 && shouldLog("debug")) {
                logger
                  .forComponent(className)
                  .debug("🗃️ State updated", changes);
              }

              if (callback) callback();
            });
          };
        }
      }
    };
  };
}

/**
 * Error boundary decorator - wraps component to catch errors
 *
 * @example
 * @LogErrors()
 * class MyComponent extends React.Component {
 *   // Errors in render and lifecycle will be caught and logged
 * }
 */
export function LogErrors() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends new (...args: any[]) => object>(
    constructor: T
  ): T {
    const className = constructor.name;

    return class extends constructor {
      componentDidCatch?(
        error: Error,
        errorInfo: { componentStack: string }
      ): void;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(...args: any[]) {
        super(...args);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const self = this as any;
        const originalDidCatch = self.componentDidCatch;

        self.componentDidCatch = function (
          error: Error,
          errorInfo: { componentStack: string }
        ) {
          logger.forComponent(className).error("💥 Component error caught", {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            componentStack: errorInfo.componentStack,
          });

          if (originalDidCatch) {
            originalDidCatch.call(this, error, errorInfo);
          }
        };
      }
    };
  };
}

/**
 * Async method decorator - specifically for async methods with better timing
 *
 * @example
 * class MyService {
 *   @LogAsync()
 *   async fetchData() {
 *     return await api.get('/data');
 *   }
 * }
 */
export function LogAsync(options: Partial<DecoratorOptions> = {}) {
  const opts = {
    ...defaultDecoratorOptions,
    ...options,
    logTime: true,
    logExit: true,
  };

  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: unknown[]) {
      if (!shouldLog(opts.level!)) {
        return originalMethod.apply(this, args);
      }

      const componentLogger = logger
        .forComponent(className)
        .withTags("async", ...(opts.tags || []));
      const prefix = opts.prefix ? `${opts.prefix} ` : "";

      componentLogger.log(
        opts.level!,
        `${prefix}⏳ ${propertyKey}() started`,
        opts.logArgs && args.length > 0
          ? { args: summarizeArgs(args) }
          : undefined
      );

      const startTime = performance.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - startTime;

        componentLogger.log(
          opts.level!,
          `${prefix}✅ ${propertyKey}() completed (${duration.toFixed(2)}ms)`,
          opts.logReturn ? { result: summarizeValue(result) } : undefined
        );

        return result;
      } catch (error) {
        const duration = performance.now() - startTime;

        componentLogger.error(
          `${prefix}❌ ${propertyKey}() failed (${duration.toFixed(2)}ms)`,
          {
            error:
              error instanceof Error
                ? { message: error.message, stack: error.stack }
                : error,
          }
        );

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Debounced logging decorator - prevents log spam for frequently called methods
 *
 * @example
 * class SearchComponent {
 *   @LogDebounced(300)
 *   handleSearch(query: string) {
 *     // Will only log after 300ms of inactivity
 *   }
 * }
 */
export function LogDebounced(
  delayMs: number,
  options: Partial<DecoratorOptions> = {}
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let callCount = 0;

    descriptor.value = function (...args: unknown[]) {
      callCount++;
      const currentCallCount = callCount;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const result = originalMethod.apply(this, args);

      timeoutId = setTimeout(() => {
        if (shouldLog(options.level || "debug")) {
          logger
            .forComponent(className)
            .debug(
              `🔄 ${propertyKey}() (debounced, ${currentCallCount} calls)`,
              options.logArgs && args.length > 0
                ? { lastArgs: summarizeArgs(args) }
                : undefined
            );
        }
        callCount = 0;
      }, delayMs);

      return result;
    };

    return descriptor;
  };
}

/**
 * Throttled logging decorator - limits log frequency for high-frequency methods
 *
 * @example
 * class ScrollHandler {
 *   @LogThrottled(100)
 *   handleScroll(event: ScrollEvent) {
 *     // Will log at most once every 100ms
 *   }
 * }
 */
export function LogThrottled(
  intervalMs: number,
  options: Partial<DecoratorOptions> = {}
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    let lastLogTime = 0;
    let callCount = 0;

    descriptor.value = function (...args: unknown[]) {
      callCount++;
      const now = Date.now();

      const result = originalMethod.apply(this, args);

      if (now - lastLogTime >= intervalMs) {
        if (shouldLog(options.level || "debug")) {
          logger
            .forComponent(className)
            .debug(
              `⚡ ${propertyKey}() (throttled, ${callCount} calls since last log)`,
              options.logArgs && args.length > 0
                ? { lastArgs: summarizeArgs(args) }
                : undefined
            );
        }
        lastLogTime = now;
        callCount = 0;
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Conditional logging decorator - only logs when condition is met
 *
 * @example
 * class DataProcessor {
 *   @LogWhen(args => args[0]?.length > 100)
 *   processData(data: any[]) {
 *     // Only logs when data has more than 100 items
 *   }
 * }
 */
export function LogWhen(
  condition: (args: unknown[], result?: unknown) => boolean,
  options: Partial<DecoratorOptions> = {}
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = function (...args: unknown[]) {
      const result = originalMethod.apply(this, args);

      if (condition(args, result) && shouldLog(options.level || "debug")) {
        logger
          .forComponent(className)
          .log(options.level || "debug", `📌 ${propertyKey}() (conditional)`, {
            args: options.logArgs !== false ? summarizeArgs(args) : undefined,
            result: options.logReturn ? summarizeValue(result) : undefined,
          });
      }

      return result;
    };

    return descriptor;
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Summarize function arguments for logging
 */
function summarizeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => summarizeValue(arg));
}

/**
 * Summarize a value for logging (avoid huge objects, functions, etc.)
 */
function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function")
    return `[Function: ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();

  if (typeof value === "object") {
    // React element
    if ("$$typeof" in value) return "[React Element]";

    // DOM element
    if (value instanceof Element) return `[${value.tagName}]`;

    // Event
    if (value instanceof Event)
      return `[${value.constructor.name}: ${value.type}]`;

    // Array
    if (Array.isArray(value)) {
      if (value.length > 10) {
        return `[Array(${value.length})]`;
      }
      return value.map((v) => summarizeValue(v));
    }

    // Plain object
    const keys = Object.keys(value);
    if (keys.length > 10) {
      return `[Object with ${keys.length} keys]`;
    }

    const summary: Record<string, unknown> = {};
    for (const key of keys) {
      summary[key] = summarizeValue((value as Record<string, unknown>)[key]);
    }
    return summary;
  }

  // Truncate long strings
  if (typeof value === "string" && value.length > 200) {
    return value.slice(0, 200) + "...";
  }

  return value;
}

/**
 * Detect changes between two objects
 */
function detectChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, { prev: unknown; next: unknown }> {
  const changes: Record<string, { prev: unknown; next: unknown }> = {};

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    const prevValue = prev[key];
    const nextValue = next[key];

    if (!Object.is(prevValue, nextValue)) {
      changes[key] = {
        prev: summarizeValue(prevValue),
        next: summarizeValue(nextValue),
      };
    }
  }

  return changes;
}
