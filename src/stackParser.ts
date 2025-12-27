/**
 * Stack frame information
 */
export interface StackFrame {
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
export function parseStackFrame(
  frameLine: string,
  extractFileName: (path: string) => string
): StackFrame | null {
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
  const firefoxMatch = frameLine.match(/^(.*)@(.+?):(\d+):(\d+)$/);

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

