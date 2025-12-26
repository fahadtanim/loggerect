// Core logger
export { logger, Logger, trace, debug, info, warn, error } from './logger';

// Configuration
export { 
  configure, 
  getConfig, 
  resetConfig, 
  subscribeToConfig,
  shouldLog,
  shouldIncludeSourcePath,
  isDevelopment,
  isProduction,
  presets,
  applyPreset,
  defaultConfig,
} from './config';

// Source tracking
export {
  getSourceLocation,
  getStackTrace,
  formatSourceLocation,
  getComponentName,
  createSourceLink,
  type SourceLocation,
} from './sourceTracker';

// Formatting
export {
  formatTimestamp,
  formatLogEntry,
  formatAsPretty,
  formatAsJSON,
  safeStringify,
} from './formatter';

// Decorators (for class components)
export {
  Log,
  LogClass,
  LogLifecycle,
  LogRender,
  LogState,
  LogErrors,
  LogAsync,
  LogDebounced,
  LogThrottled,
  LogWhen,
} from './decorators';

// HOCs (for functional components)
export {
  withLogger,
  withLoggerRef,
  withLoggerMemo,
  withErrorLogger,
} from './hoc';

// Hooks
export {
  useLogger,
  useLifecycleLogger,
  useRenderLogger,
  usePropChangeLogger,
  useStateLogger,
  useEffectLogger,
  useCallbackLogger,
  useMemoLogger,
  useTimer,
  useConditionalLogger,
  useWhyDidYouRender,
} from './hooks';

// Types
export type {
  LogLevel,
  LogFormat,
  Environment,
  LogEntry,
  LogTransport,
  LogStyle,
  LogFilter,
  LogTransformer,
  LogrectConfig,
  LogrectUserConfig,
  LogContext,
  PerformanceMeasurement,
  DecoratorOptions,
  HOCOptions,
} from './types';

// SSR utilities
export {
  isServer,
  isClient,
  safePerformanceNow,
  safeLocalStorage,
  safeConsole,
} from './ssr';
