/**
 * Log levels supported by logrect
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log output format
 */
export type LogFormat = 'pretty' | 'json' | 'minimal' | 'detailed';

/**
 * Environment mode
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: unknown;
  componentName?: string;
  functionName?: string;
  sourcePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Custom transport function for log entries
 */
export type LogTransport = (entry: LogEntry) => void | Promise<void>;

/**
 * Style configuration for console output
 */
export interface LogStyle {
  trace: string;
  debug: string;
  info: string;
  warn: string;
  error: string;
}

/**
 * Filter function to conditionally log entries
 */
export type LogFilter = (entry: LogEntry) => boolean;

/**
 * Transformer function to modify log entries before output
 */
export type LogTransformer = (entry: LogEntry) => LogEntry;

/**
 * Configuration options for logrect
 */
export interface LogrectConfig {
  /** Current environment mode */
  environment: Environment;
  
  /** Minimum log level to output */
  level: LogLevel;
  
  /** Output format */
  format: LogFormat;
  
  /** Whether to include timestamps */
  timestamps: boolean;
  
  /** Timestamp format (ISO, locale, unix) */
  timestampFormat: 'iso' | 'locale' | 'unix' | 'relative';
  
  /** Include source path information (auto-enabled in development) */
  includeSourcePath: boolean | 'auto';
  
  /** Include stack trace for errors */
  includeStackTrace: boolean;
  
  /** Enable colored output in console */
  colors: boolean;
  
  /** Custom styles for each log level */
  styles: Partial<LogStyle>;
  
  /** Prefix for all log messages */
  prefix: string;
  
  /** Group related logs */
  groupLogs: boolean;
  
  /** Collapse grouped logs by default */
  collapseGroups: boolean;
  
  /** Maximum depth for object inspection */
  maxDepth: number;
  
  /** Maximum array length to display */
  maxArrayLength: number;
  
  /** Maximum string length before truncation */
  maxStringLength: number;
  
  /** Custom transports for log output */
  transports: LogTransport[];
  
  /** Filter function to conditionally log */
  filter?: LogFilter;
  
  /** Transform function to modify log entries */
  transformer?: LogTransformer;
  
  /** Enable performance timing */
  performance: boolean;
  
  /** Persist logs to storage */
  persist: boolean;
  
  /** Storage key for persisted logs */
  storageKey: string;
  
  /** Maximum number of persisted logs */
  maxPersistedLogs: number;
  
  /** Enable render tracking for components */
  trackRenders: boolean;
  
  /** Enable prop change detection */
  trackPropChanges: boolean;
  
  /** Enable state change detection */
  trackStateChanges: boolean;
  
  /** Batch logs for better performance */
  batchLogs: boolean;
  
  /** Batch interval in milliseconds */
  batchInterval: number;
  
  /** Custom badges for different log types */
  badges: Record<string, string>;
  
  /** Silent mode - suppress all console output */
  silent: boolean;
}

/**
 * Partial configuration for user overrides
 */
export type LogrectUserConfig = Partial<LogrectConfig>;

/**
 * Context for component/function logging
 */
export interface LogContext {
  componentName?: string;
  componentId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, unknown>;
}

/**
 * Decorator options
 */
export interface DecoratorOptions {
  /** Log method entry */
  logEntry?: boolean;
  
  /** Log method exit */
  logExit?: boolean;
  
  /** Log method arguments */
  logArgs?: boolean;
  
  /** Log return value */
  logReturn?: boolean;
  
  /** Log execution time */
  logTime?: boolean;
  
  /** Log errors */
  logErrors?: boolean;
  
  /** Custom log level for this method */
  level?: LogLevel;
  
  /** Custom tags */
  tags?: string[];
  
  /** Custom message prefix */
  prefix?: string;
}

/**
 * HOC options for wrapping functional components
 */
export interface HOCOptions extends DecoratorOptions {
  /** Track renders */
  trackRenders?: boolean;
  
  /** Track prop changes */
  trackPropChanges?: boolean;
  
  /** Display name override */
  displayName?: string;
  
  /** Log mount/unmount lifecycle */
  logLifecycle?: boolean;
}


