import { parseStackFrame } from "./stackParser";
import { extractFileName } from "./pathUtils";
import { isInternalFrame } from "./internalFrames";

/**
 * Get full stack trace
 */
export function getStackTrace(skipFrames = 0): string {
  try {
    const error = new Error();
    const stack = error.stack;

    if (!stack) return "";

    const lines = stack.split("\n");

    // Skip the Error line and internal frames
    const filteredLines: string[] = [];
    let skipped = 0;

    for (const line of lines.slice(1)) {
      const frame = parseStackFrame(line, extractFileName);
      if (frame && !isInternalFrame(frame)) {
        if (skipped >= skipFrames) {
          filteredLines.push(line.trim());
        }
        skipped++;
      }
    }

    return filteredLines.join("\n");
  } catch {
    return "";
  }
}

