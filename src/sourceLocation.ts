import { shouldIncludeSourcePath } from "./config";
import type { StackFrame } from "./stackParser";
import { parseStackFrame } from "./stackParser";
import { extractFileName, cleanFilePath } from "./pathUtils";
import { isInternalFrame } from "./internalFrames";

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
    const lines = stack.split("\n");

    // Parse all frames
    const frames: StackFrame[] = [];
    for (const line of lines) {
      const frame = parseStackFrame(line, extractFileName);
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
        result.fileName = extractFileName(targetFrame.filePath);
      }

      // Try to extract class name from function name
      // Filter out React/Node.js internal function names
      if (targetFrame.functionName) {
        const internalPatterns = [
          "react_stack",
          "react_internal",
          "Object.",
          "AsyncResource",
          "runInAsyncScope",
          "processTicksAndRejections",
          "nextTick",
          "node:",
          "anonymous",
          "<anonymous>",
        ];
        
        const isInternal = internalPatterns.some((pattern) =>
          targetFrame.functionName!.includes(pattern)
        );
        
        if (!isInternal) {
          const classMatch = targetFrame.functionName.match(
            /^([A-Z][a-zA-Z0-9]*)\./
          );
          if (classMatch) {
            result.className = classMatch[1];
          } else if (
            /^[A-Z][a-zA-Z0-9]*$/.test(targetFrame.functionName)
          ) {
            // If the function name itself is a class name (capitalized)
            result.className = targetFrame.functionName;
          }
        }
      }
    }
  } catch {
    // Silently fail if stack trace parsing fails
  }

  return result;
}

