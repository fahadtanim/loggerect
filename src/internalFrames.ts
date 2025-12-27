import type { StackFrame } from "./stackParser";

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
  /node_modules/,
  /node:/,
  /next-server/,
  /next\/dist/,
  /\.next\//,
  /react-dom/,
  /react\/jsx/,
  /async_hooks/,
];

/**
 * Check if a frame is from internal logrect code
 */
export function isInternalFrame(frame: StackFrame): boolean {
  if (!frame.filePath) return true;

  return internalPatterns.some((pattern) => {
    if (typeof pattern === "string") {
      return frame.filePath!.includes(pattern);
    }
    return pattern.test(frame.filePath!);
  });
}

