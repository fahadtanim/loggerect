import { shouldIncludeSourcePath, isDevelopment } from './config';

/**
 * Source location information
 */
export interface SourceLocation {
  filePath: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  functionName: string | null;
  className: string | null;
  fullPath: string | null;
}

/**
 * Stack frame information
 */
interface StackFrame {
  functionName: string | null;
  fileName: string | null;
  filePath: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

/**
 * Parse a single stack frame line
 * Handles various browser formats:
 * - Chrome/V8: "    at functionName (filePath:line:column)"
 * - Firefox: "functionName@filePath:line:column"
 * - Safari: "functionName@filePath:line:column"
 */
function parseStackFrame(frameLine: string): StackFrame | null {
  // Chrome/V8 format: "    at functionName (filePath:line:column)"
  const chromeMatch = frameLine.match(
    /^\s*at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+)|([^)]+))\)?$/
  );
  
  if (chromeMatch) {
    const [, functionName, filePath, line, column] = chromeMatch;
    return {
      functionName: functionName || null,
      fileName: filePath ? extractFileName(filePath) : null,
      filePath: filePath || null,
      lineNumber: line ? parseInt(line, 10) : null,
      columnNumber: column ? parseInt(column, 10) : null,
    };
  }
  
  // Firefox/Safari format: "functionName@filePath:line:column"
  const firefoxMatch = frameLine.match(
    /^(.*)@(.+?):(\d+):(\d+)$/
  );
  
  if (firefoxMatch) {
    const [, functionName, filePath, line, column] = firefoxMatch;
    return {
      functionName: functionName || null,
      fileName: extractFileName(filePath),
      filePath,
      lineNumber: parseInt(line, 10),
      columnNumber: parseInt(column, 10),
    };
  }
  
  // Simple format: "filePath:line:column"
  const simpleMatch = frameLine.match(/^(.+?):(\d+):(\d+)$/);
  
  if (simpleMatch) {
    const [, filePath, line, column] = simpleMatch;
    return {
      functionName: null,
      fileName: extractFileName(filePath),
      filePath,
      lineNumber: parseInt(line, 10),
      columnNumber: parseInt(column, 10),
    };
  }
  
  return null;
}

/**
 * Extract file name from full path
 */
function extractFileName(filePath: string): string {
  // Handle various path formats
  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1];
  
  // Remove query strings and hashes
  return fileName.split('?')[0].split('#')[0];
}

/**
 * Check if path is a bundled/compiled path (Next.js, webpack, etc.)
 */
function isBundledPath(filePath: string): boolean {
  return (
    filePath.includes('/_next/') ||
    filePath.includes('/chunks/') ||
    filePath.includes('webpack://') ||
    filePath.includes('webpack-internal://') ||
    /\.[a-f0-9]{6,}\./.test(filePath) || // hashed filenames like _6e37f64f._.js
    filePath.includes('.hot-update.')
  );
}

/**
 * Clean up file path for display
 */
function cleanFilePath(filePath: string): string {
  if (!filePath) return '';
  
  // For bundled paths, return a simplified indicator
  // The actual source mapping happens when clicking in DevTools
  if (isBundledPath(filePath)) {
    // Try to extract any meaningful component name from the path
    // Next.js turbopack puts some hints in chunk names
    const turboMatch = filePath.match(/chunks\/([^/.]+)/);
    if (turboMatch && !turboMatch[1].match(/^[a-f0-9_]+$/i)) {
      return `[bundled: ${turboMatch[1]}]`;
    }
    return '[bundled]';
  }
  
  // Remove webpack:// prefix
  let cleaned = filePath.replace(/^webpack:\/\/[^/]*/, '');
  
  // Remove webpack-internal:// prefix
  cleaned = cleaned.replace(/^webpack-internal:\/\/\//, '');
  
  // Remove file:// prefix
  cleaned = cleaned.replace(/^file:\/\//, '');
  
  // Remove node_modules path segments for brevity
  const nodeModulesIndex = cleaned.indexOf('node_modules');
  if (nodeModulesIndex === -1) {
    // If not in node_modules, try to get relative path from src/
    const srcIndex = cleaned.indexOf('/src/');
    if (srcIndex !== -1) {
      cleaned = cleaned.slice(srcIndex + 1);
    }
    // Also check for /app/ (Next.js app router)
    const appIndex = cleaned.indexOf('/app/');
    if (appIndex !== -1 && srcIndex === -1) {
      cleaned = cleaned.slice(appIndex + 1);
    }
  }
  
  // Remove query strings
  cleaned = cleaned.split('?')[0];
  
  return cleaned;
}

/**
 * List of internal files/patterns to skip
 */
const internalPatterns = [
  /logrect/i,
  /logger\.ts/,
  /logger\.js/,
  /sourceTracker/,
  /decorators/,
  /hooks\.ts/,
  /hooks\.js/,
  /console\./,
  /native code/,
  /<anonymous>/,
];

/**
 * Check if a frame is from internal logrect code
 */
function isInternalFrame(frame: StackFrame): boolean {
  if (!frame.filePath) return true;
  
  return internalPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return frame.filePath!.includes(pattern);
    }
    return pattern.test(frame.filePath!);
  });
}

/**
 * Get the caller's source location from the stack trace
 * @param skipFrames - Number of additional frames to skip (default: 0)
 */
export function getSourceLocation(skipFrames = 0): SourceLocation {
  const result: SourceLocation = {
    filePath: null,
    fileName: null,
    lineNumber: null,
    columnNumber: null,
    functionName: null,
    className: null,
    fullPath: null,
  };
  
  // Only extract source path in development mode or when explicitly enabled
  if (!shouldIncludeSourcePath()) {
    return result;
  }
  
  try {
    // Create an error to capture the stack trace
    const error = new Error();
    const stack = error.stack;
    
    if (!stack) return result;
    
    // Split stack into lines
    const lines = stack.split('\n');
    
    // Parse all frames
    const frames: StackFrame[] = [];
    for (const line of lines) {
      const frame = parseStackFrame(line);
      if (frame) {
        frames.push(frame);
      }
    }
    
    // Find the first non-internal frame after skipping
    let userFrameIndex = 0;
    let skipped = 0;
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!isInternalFrame(frame)) {
        if (skipped >= skipFrames) {
          userFrameIndex = i;
          break;
        }
        skipped++;
      }
    }
    
    const targetFrame = frames[userFrameIndex];
    
    if (targetFrame) {
      result.functionName = targetFrame.functionName;
      result.lineNumber = targetFrame.lineNumber;
      result.columnNumber = targetFrame.columnNumber;
      result.fullPath = targetFrame.filePath;
      
      if (targetFrame.filePath) {
        result.filePath = cleanFilePath(targetFrame.filePath);
        result.fileName = targetFrame.fileName;
      }
      
      // Try to extract class name from function name
      if (targetFrame.functionName) {
        const classMatch = targetFrame.functionName.match(/^([A-Z][a-zA-Z0-9]*)\./);
        if (classMatch) {
          result.className = classMatch[1];
        }
      }
    }
  } catch {
    // Silently fail if stack trace parsing fails
  }
  
  return result;
}

/**
 * Get full stack trace
 */
export function getStackTrace(skipFrames = 0): string {
  try {
    const error = new Error();
    const stack = error.stack;
    
    if (!stack) return '';
    
    const lines = stack.split('\n');
    
    // Skip the Error line and internal frames
    const filteredLines: string[] = [];
    let skipped = 0;
    
    for (const line of lines.slice(1)) {
      const frame = parseStackFrame(line);
      if (frame && !isInternalFrame(frame)) {
        if (skipped >= skipFrames) {
          filteredLines.push(line.trim());
        }
        skipped++;
      }
    }
    
    return filteredLines.join('\n');
  } catch {
    return '';
  }
}

/**
 * Format source location for display
 */
export function formatSourceLocation(location: SourceLocation, verbose = false): string {
  if (!location.filePath && !location.functionName) {
    return '';
  }
  
  const parts: string[] = [];
  
  if (verbose && location.functionName) {
    parts.push(location.functionName);
  }
  
  if (location.filePath) {
    let pathPart = isDevelopment() ? location.filePath : location.fileName || '';
    
    if (location.lineNumber !== null) {
      pathPart += `:${location.lineNumber}`;
      if (location.columnNumber !== null && verbose) {
        pathPart += `:${location.columnNumber}`;
      }
    }
    
    parts.push(pathPart);
  }
  
  return parts.join(' @ ');
}

/**
 * Get component name from various sources
 */
export function getComponentName(
  component: React.ComponentType | Function | string | null | undefined
): string {
  if (!component) return 'Unknown';
  
  if (typeof component === 'string') {
    return component;
  }
  
  // Try displayName first (set by React.memo, forwardRef, etc.)
  if ('displayName' in component && component.displayName) {
    return component.displayName as string;
  }
  
  // Try function name
  if (component.name) {
    return component.name;
  }
  
  // Try constructor name for class components
  if (component.constructor && component.constructor.name !== 'Function') {
    return component.constructor.name;
  }
  
  return 'Anonymous';
}

/**
 * Create a source location link for IDEs (clickable in console)
 */
export function createSourceLink(location: SourceLocation): string {
  if (!location.fullPath) return '';
  
  // For bundled paths, don't show the ugly URL
  // The browser's DevTools already shows a clickable source-mapped link on the right
  if (isBundledPath(location.fullPath)) {
    return ''; // Let browser's native source link handle it
  }
  
  let link = location.fullPath;
  
  if (location.lineNumber !== null) {
    link += `:${location.lineNumber}`;
    if (location.columnNumber !== null) {
      link += `:${location.columnNumber}`;
    }
  }
  
  return link;
}


