import React, {
  useRef,
  useEffect,
  memo,
  forwardRef,
  ComponentType,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
} from "react";
import type { HOCOptions } from "./types";
import { logger } from "./logger";
import { shouldLog } from "./config";
import { getComponentName } from "./sourceTracker";
import { safePerformanceNow } from "./ssr";

/**
 * Default HOC options
 */
const defaultHOCOptions: HOCOptions = {
  trackRenders: true,
  trackPropChanges: true,
  logLifecycle: true,
  logEntry: true,
  logExit: false,
  logArgs: true,
  logReturn: false,
  logTime: true,
  logErrors: true,
  level: "debug",
  tags: [],
};

/**
 * Higher-Order Component for logging functional components
 *
 * @example
 * const MyComponent = ({ name }) => <div>Hello {name}</div>;
 * export default withLogger(MyComponent);
 *
 * // With options
 * export default withLogger(MyComponent, {
 *   trackPropChanges: true,
 *   displayName: 'MyAwesomeComponent'
 * });
 */
export function withLogger<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: Partial<HOCOptions> = {}
): ComponentType<P> {
  const opts = { ...defaultHOCOptions, ...options };
  const displayName = opts.displayName || getComponentName(WrappedComponent);

  const LoggedComponent: React.FC<P> = (props) => {
    const renderCount = useRef(0);
    const prevProps = useRef<P | null>(null);
    const mountTime = useRef<number>(0);
    const componentLogger = logger
      .forComponent(displayName)
      .withTags(...(opts.tags || []));

    // Track mount/unmount
    useEffect(() => {
      if (opts.logLifecycle && shouldLog(opts.level!)) {
        mountTime.current = safePerformanceNow();
        componentLogger.mount(displayName);
      }

      return () => {
        if (opts.logLifecycle && shouldLog(opts.level!)) {
          const lifetime = safePerformanceNow() - mountTime.current;
          componentLogger.log(
            opts.level!,
            `💤 Unmounted (lifetime: ${lifetime.toFixed(2)}ms)`
          );
        }
      };
    }, []);

    // Track renders
    renderCount.current++;

    if (opts.trackRenders && shouldLog(opts.level!)) {
      // Detect prop changes
      let propChanges: Record<string, { prev: unknown; next: unknown }> | null =
        null;
      if (opts.trackPropChanges && prevProps.current) {
        propChanges = detectPropChanges(prevProps.current, props);
      }

      componentLogger.log(
        opts.level!,
        `🎨 Render #${renderCount.current}`,
        propChanges && Object.keys(propChanges).length > 0
          ? { propChanges, renderCount: renderCount.current }
          : { renderCount: renderCount.current }
      );
    }

    // Store current props for next comparison
    prevProps.current = { ...props };

    // Render wrapped component
    try {
      return <WrappedComponent {...props} />;
    } catch (error) {
      if (opts.logErrors) {
        componentLogger.error("💥 Render error", {
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
        });
      }
      throw error;
    }
  };

  LoggedComponent.displayName = `withLogger(${displayName})`;

  return LoggedComponent;
}

/**
 * HOC with ref forwarding support
 *
 * @example
 * const MyInput = forwardRef((props, ref) => <input ref={ref} {...props} />);
 * export default withLoggerRef(MyInput);
 */
export function withLoggerRef<P extends object, R>(
  WrappedComponent: ForwardRefExoticComponent<
    PropsWithoutRef<P> & RefAttributes<R>
  >,
  options: Partial<HOCOptions> = {}
): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<R>> {
  const opts = { ...defaultHOCOptions, ...options };
  const displayName = opts.displayName || getComponentName(WrappedComponent);

  const LoggedComponent = forwardRef<R, P>((props, ref) => {
    const renderCount = useRef(0);
    const prevProps = useRef<Record<string, unknown> | null>(null);
    const componentLogger = logger
      .forComponent(displayName)
      .withTags("forwarded-ref", ...(opts.tags || []));

    // Track renders
    renderCount.current++;

    if (opts.trackRenders && shouldLog(opts.level!)) {
      let propChanges: Record<string, { prev: unknown; next: unknown }> | null =
        null;
      if (opts.trackPropChanges && prevProps.current) {
        propChanges = detectPropChanges(
          prevProps.current,
          props as unknown as Record<string, unknown>
        );
      }

      componentLogger.log(
        opts.level!,
        `🎨 Render #${renderCount.current}`,
        propChanges && Object.keys(propChanges).length > 0
          ? { propChanges }
          : undefined
      );
    }

    prevProps.current = { ...props } as Record<string, unknown>;

    return <WrappedComponent {...props} ref={ref} />;
  });

  LoggedComponent.displayName = `withLoggerRef(${displayName})`;

  return LoggedComponent;
}

/**
 * HOC with memoization and logging
 *
 * @example
 * const ExpensiveComponent = ({ data }) => <div>{data}</div>;
 * export default withLoggerMemo(ExpensiveComponent);
 */
export function withLoggerMemo<P extends object>(
  WrappedComponent: ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean,
  options: Partial<HOCOptions> = {}
): React.MemoExoticComponent<ComponentType<P>> {
  const opts = { ...defaultHOCOptions, ...options };
  const displayName = opts.displayName || getComponentName(WrappedComponent);

  const LoggedComponent = withLogger(WrappedComponent, opts);

  const MemoizedComponent = memo(LoggedComponent, (prevProps, nextProps) => {
    const arePropsEqual = areEqual
      ? areEqual(prevProps, nextProps)
      : shallowEqual(prevProps, nextProps);

    if (!arePropsEqual && opts.trackPropChanges && shouldLog(opts.level!)) {
      const changes = detectPropChanges(prevProps, nextProps);
      if (Object.keys(changes).length > 0) {
        logger
          .forComponent(displayName)
          .debug("📦 Memo check: props changed", changes);
      }
    } else if (arePropsEqual && shouldLog("trace")) {
      logger
        .forComponent(displayName)
        .trace("📦 Memo check: props equal, skipping render");
    }

    return arePropsEqual;
  });

  MemoizedComponent.displayName = `withLoggerMemo(${displayName})`;

  return MemoizedComponent;
}

/**
 * Error boundary HOC with logging
 *
 * @example
 * const MyComponent = ({ data }) => <div>{data.value}</div>;
 * export default withErrorLogger(MyComponent);
 */
export function withErrorLogger<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: Partial<HOCOptions & { fallback?: React.ReactNode }> = {}
): ComponentType<P> {
  const opts = { ...defaultHOCOptions, ...options };
  const displayName = opts.displayName || getComponentName(WrappedComponent);

  class ErrorBoundary extends React.Component<
    P & { children?: React.ReactNode },
    { hasError: boolean; error: Error | null }
  > {
    static displayName = `withErrorLogger(${displayName})`;

    constructor(props: P & { children?: React.ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      logger.forComponent(displayName).error("💥 Error boundary caught error", {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        componentStack: errorInfo.componentStack,
      });
    }

    render() {
      if (this.state.hasError) {
        if (opts.fallback) {
          return opts.fallback;
        }

        return (
          <div
            style={{
              padding: "20px",
              background: "#FEE2E2",
              border: "1px solid #EF4444",
              borderRadius: "8px",
              color: "#991B1B",
            }}
          >
            <h3 style={{ margin: "0 0 10px" }}>Something went wrong</h3>
            <pre
              style={{
                fontSize: "12px",
                overflow: "auto",
                background: "#FFF",
                padding: "10px",
                borderRadius: "4px",
              }}
            >
              {this.state.error?.message}
            </pre>
          </div>
        );
      }

      return <WrappedComponent {...(this.props as P)} />;
    }
  }

  return ErrorBoundary as unknown as ComponentType<P>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Detect changes between previous and next props
 */
function detectPropChanges<P extends object>(
  prevProps: P,
  nextProps: P
): Record<string, { prev: unknown; next: unknown }> {
  const changes: Record<string, { prev: unknown; next: unknown }> = {};

  const allKeys = new Set([
    ...Object.keys(prevProps),
    ...Object.keys(nextProps),
  ]) as Set<keyof P>;

  for (const key of allKeys) {
    const prevValue = prevProps[key];
    const nextValue = nextProps[key];

    if (!Object.is(prevValue, nextValue)) {
      changes[key as string] = {
        prev: summarizeValue(prevValue),
        next: summarizeValue(nextValue),
      };
    }
  }

  return changes;
}

/**
 * Shallow equality check for memoization
 */
function shallowEqual<T extends object>(objA: T, objB: T): boolean {
  if (Object.is(objA, objB)) return true;

  const keysA = Object.keys(objA) as (keyof T)[];
  const keysB = Object.keys(objB) as (keyof T)[];

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.is(objA[key], objB[key])) return false;
  }

  return true;
}

/**
 * Summarize a value for logging
 */
function summarizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function")
    return `[Function: ${value.name || "anonymous"}]`;
  if (typeof value === "symbol") return value.toString();

  if (typeof value === "object") {
    if ("$$typeof" in value) return "[React Element]";
    if (value instanceof Element) return `[${value.tagName}]`;
    if (value instanceof Event)
      return `[${value.constructor.name}: ${value.type}]`;

    if (Array.isArray(value)) {
      return value.length > 5
        ? `[Array(${value.length})]`
        : value.map(summarizeValue);
    }

    const keys = Object.keys(value);
    if (keys.length > 5) {
      return `[Object with ${keys.length} keys]`;
    }
  }

  if (typeof value === "string" && value.length > 100) {
    return value.slice(0, 100) + "...";
  }

  return value;
}
