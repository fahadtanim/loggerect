import type { LogrectConfig, LogrectUserConfig, Environment, LogLevel } from './types';

/**
 * Detect current environment
 */
function detectEnvironment(): Environment {
  // Check Node environment
  if (typeof process !== 'undefined' && process.env) {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'development') return 'development';
  }
  
  // Check for common development indicators
  if (typeof window !== 'undefined') {
    // React DevTools check
    // @ts-expect-error - React DevTools adds this property
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      return 'development';
    }
    
    // Localhost check
    if (window.location?.hostname === 'localhost' || 
        window.location?.hostname === '127.0.0.1' ||
        window.location?.hostname.includes('.local')) {
      return 'development';
    }
  }
  
  // Default to production for safety
  return 'production';
}

/**
 * Default log level styles
 */
const defaultStyles = {
  trace: 'background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-weight: 600;',
  debug: 'background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;',
  info: 'background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: 600;',
  warn: 'background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;',
  error: 'background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 600;',
};

/**
 * Default badges
 */
const defaultBadges = {
  trace: '🔍',
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  render: '🎨',
  mount: '🚀',
  unmount: '💤',
  update: '🔄',
  props: '📦',
  state: '🗃️',
  time: '⏱️',
};

/**
 * Default configuration
 */
export const defaultConfig: LogrectConfig = {
  environment: detectEnvironment(),
  level: detectEnvironment() === 'production' ? 'warn' : 'trace',
  format: detectEnvironment() === 'production' ? 'minimal' : 'pretty',
  timestamps: true,
  timestampFormat: 'locale',
  includeSourcePath: 'auto',
  includeStackTrace: detectEnvironment() !== 'production',
  colors: true,
  styles: defaultStyles,
  prefix: '[logrect]',
  groupLogs: true,
  collapseGroups: true,
  maxDepth: 4,
  maxArrayLength: 100,
  maxStringLength: 1000,
  transports: [],
  performance: true,
  persist: false,
  storageKey: 'logrect_logs',
  maxPersistedLogs: 1000,
  trackRenders: true,
  trackPropChanges: true,
  trackStateChanges: true,
  batchLogs: false,
  batchInterval: 100,
  badges: defaultBadges,
  silent: false,
};

/**
 * Current configuration (mutable singleton)
 */
let currentConfig: LogrectConfig = { ...defaultConfig };

/**
 * Configuration subscribers
 */
const configSubscribers: Set<(config: LogrectConfig) => void> = new Set();

/**
 * Configure logrect globally
 */
export function configure(userConfig: LogrectUserConfig): LogrectConfig {
  currentConfig = {
    ...currentConfig,
    ...userConfig,
    styles: {
      ...currentConfig.styles,
      ...userConfig.styles,
    },
    badges: {
      ...currentConfig.badges,
      ...userConfig.badges,
    },
  };
  
  // Notify subscribers
  configSubscribers.forEach(subscriber => subscriber(currentConfig));
  
  return currentConfig;
}

/**
 * Get current configuration
 */
export function getConfig(): LogrectConfig {
  return { ...currentConfig };
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): LogrectConfig {
  currentConfig = { ...defaultConfig };
  configSubscribers.forEach(subscriber => subscriber(currentConfig));
  return currentConfig;
}

/**
 * Subscribe to configuration changes
 */
export function subscribeToConfig(callback: (config: LogrectConfig) => void): () => void {
  configSubscribers.add(callback);
  return () => configSubscribers.delete(callback);
}

/**
 * Check if a log level should be output
 */
export function shouldLog(level: LogLevel): boolean {
  if (currentConfig.silent) return false;
  
  const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
  const currentLevelIndex = levels.indexOf(currentConfig.level);
  const targetLevelIndex = levels.indexOf(level);
  
  return targetLevelIndex >= currentLevelIndex;
}

/**
 * Check if source path should be included
 */
export function shouldIncludeSourcePath(): boolean {
  if (currentConfig.includeSourcePath === 'auto') {
    return currentConfig.environment === 'development';
  }
  return currentConfig.includeSourcePath;
}

/**
 * Check if in development mode
 */
export function isDevelopment(): boolean {
  return currentConfig.environment === 'development';
}

/**
 * Check if in production mode
 */
export function isProduction(): boolean {
  return currentConfig.environment === 'production';
}

/**
 * Preset configurations
 */
export const presets = {
  development: {
    environment: 'development' as Environment,
    level: 'trace' as LogLevel,
    format: 'pretty' as const,
    includeSourcePath: true,
    includeStackTrace: true,
    trackRenders: true,
    trackPropChanges: true,
    trackStateChanges: true,
  },
  
  production: {
    environment: 'production' as Environment,
    level: 'warn' as LogLevel,
    format: 'minimal' as const,
    includeSourcePath: false,
    includeStackTrace: false,
    trackRenders: false,
    trackPropChanges: false,
    trackStateChanges: false,
    colors: false,
  },
  
  test: {
    environment: 'test' as Environment,
    level: 'error' as LogLevel,
    format: 'json' as const,
    silent: true,
  },
  
  verbose: {
    level: 'trace' as LogLevel,
    format: 'detailed' as const,
    includeSourcePath: true,
    includeStackTrace: true,
    maxDepth: 10,
    collapseGroups: false,
  },
  
  minimal: {
    level: 'info' as LogLevel,
    format: 'minimal' as const,
    timestamps: false,
    includeSourcePath: false,
    colors: false,
    groupLogs: false,
  },
};

/**
 * Apply a preset configuration
 */
export function applyPreset(presetName: keyof typeof presets): LogrectConfig {
  return configure(presets[presetName]);
}


