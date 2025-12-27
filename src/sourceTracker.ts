/**
 * Source tracker module - orchestrates source location tracking
 *
 * This module re-exports all source tracking utilities from their
 * respective modules for backward compatibility.
 */

// Types
export type { SourceLocation } from "./sourceLocation";
export type { StackFrame } from "./stackParser";

// Core source location extraction
export { getSourceLocation } from "./sourceLocation";

// Stack trace utilities
export { getStackTrace } from "./stackTrace";

// Formatting utilities
export { formatSourceLocation, createSourceLink } from "./sourceFormatter";

// Component utilities
export { getComponentName } from "./componentUtils";

// Path utilities (for advanced use cases)
export { extractFileName, isBundledPath, cleanFilePath } from "./pathUtils";
