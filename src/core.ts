/**
 * Core logrect exports - SSR-safe, no React dependencies
 */

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

// SSR utilities
export {
  isServer,
  isClient,
  safePerformanceNow,
  safeLocalStorage,
  safeConsole,
} from './ssr';

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
} from './types';

