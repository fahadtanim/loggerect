/**
 * logrect Vite Plugin
 *
 * A lightweight Vite-specific plugin for source location injection.
 * For other bundlers (Webpack, Rollup, esbuild), use 'logrect/unplugin'.
 *
 * Usage in vite.config.ts:
 * ```ts
 * import { defineConfig } from 'vite'
 * import react from '@vitejs/plugin-react'
 * import logrect from 'logrect/vite-plugin'
 *
 * export default defineConfig({
 *   plugins: [react(), logrect()]
 * })
 * ```
 */

const MagicString = require("magic-string");

// Logrect hooks that should have source location injected
const LOGRECT_HOOKS = [
  "useLogger",
  "useLifecycleLogger",
  "useRenderLogger",
  "usePropChangeLogger",
  "useStateLogger",
  "useEffectLogger",
  "useCallbackLogger",
  "useMemoLogger",
  "useTimer",
  "useConditionalLogger",
  "useWhyDidYouRender",
];

// Logger methods
const LOGGER_METHODS = ["trace", "debug", "info", "warn", "error", "log"];

// HOC functions
const LOGRECT_HOCS = ["withLogger", "withLoggerRef"];

/**
 * Clean up file path for display
 */
function cleanFilePath(filename) {
  if (!filename) return filename;

  let cleaned = filename;

  const markers = ["/src/", "/app/", "/pages/", "/components/", "/lib/"];

  for (const marker of markers) {
    const index = cleaned.lastIndexOf(marker);
    if (index !== -1) {
      cleaned = cleaned.slice(index + 1);
      break;
    }
  }

  if (cleaned === filename) {
    const parts = cleaned.split("/");
    if (parts.length > 2) {
      cleaned = parts.slice(-2).join("/");
    }
  }

  return cleaned;
}

/**
 * Find the matching closing parenthesis
 */
function findClosingParen(code, startIndex) {
  let depth = 1;
  let i = startIndex;
  let inString = false;
  let stringChar = null;
  let inTemplate = false;
  let templateDepth = 0;

  while (i < code.length && depth > 0) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : "";

    if (!inString && !inTemplate && (char === '"' || char === "'" || char === "`")) {
      if (char === "`") {
        inTemplate = true;
        templateDepth = 1;
      } else {
        inString = true;
        stringChar = char;
      }
    } else if (inString && char === stringChar && prevChar !== "\\") {
      inString = false;
      stringChar = null;
    } else if (inTemplate) {
      if (char === "`" && prevChar !== "\\") {
        templateDepth--;
        if (templateDepth === 0) {
          inTemplate = false;
        }
      } else if (char === "$" && code[i + 1] === "{") {
        templateDepth++;
      }
    } else if (!inString && !inTemplate) {
      if (char === "(") depth++;
      else if (char === ")") depth--;
    }

    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

/**
 * Count line number at position
 */
function getLineNumber(code, position) {
  let line = 1;
  for (let i = 0; i < position && i < code.length; i++) {
    if (code[i] === "\n") line++;
  }
  return line;
}

/**
 * Check if position is inside a string or comment
 */
function isInsideStringOrComment(code, position) {
  let inString = false;
  let stringChar = null;
  let inSingleComment = false;
  let inMultiComment = false;

  for (let i = 0; i < position; i++) {
    const char = code[i];
    const nextChar = code[i + 1];

    if (inSingleComment) {
      if (char === "\n") inSingleComment = false;
      continue;
    }

    if (inMultiComment) {
      if (char === "*" && nextChar === "/") {
        inMultiComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (char === stringChar && code[i - 1] !== "\\") {
        inString = false;
        stringChar = null;
      }
      continue;
    }

    if (char === "/" && nextChar === "/") {
      inSingleComment = true;
      i++;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      inMultiComment = true;
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
    }
  }

  return inString || inSingleComment || inMultiComment;
}

/**
 * Create a regex pattern to match function calls (not definitions)
 */
function createCallPattern(functionNames) {
  const escaped = functionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Match function calls but not definitions (no "function " before the name)
  return new RegExp(`(?<!function\\s+)\\b(${escaped.join("|")})\\s*\\(`, "g");
}

/**
 * Transform code to inject source locations
 */
function transformCode(code, id) {
  const s = new MagicString(code);
  const cleanedPath = cleanFilePath(id);
  let hasChanges = false;

  const hookPattern = createCallPattern(LOGRECT_HOOKS);
  const hocPattern = createCallPattern(LOGRECT_HOCS);
  const loggerMethodPattern = /\b(logger|log)\.(trace|debug|info|warn|error|log)\s*\(/g;

  // Process hooks
  let match;
  while ((match = hookPattern.exec(code)) !== null) {
    if (isInsideStringOrComment(code, match.index)) continue;

    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findClosingParen(code, openParenIndex + 1);

    if (closeParenIndex === -1) continue;

    const lineNumber = getLineNumber(code, match.index);
    const argsContent = code.slice(openParenIndex + 1, closeParenIndex).trim();
    const sourceObj = `{ __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} } }`;

    if (argsContent === "") {
      s.overwrite(openParenIndex, closeParenIndex + 1, `(${sourceObj})`);
    } else if (argsContent.includes("{") && !argsContent.startsWith("{")) {
      const lastBraceIndex = code.lastIndexOf("}", closeParenIndex);
      if (lastBraceIndex > openParenIndex) {
        s.appendLeft(lastBraceIndex, `, __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} }`);
      } else {
        s.appendLeft(closeParenIndex, `, ${sourceObj}`);
      }
    } else if (argsContent.startsWith("{")) {
      const lastBraceIndex = code.lastIndexOf("}", closeParenIndex);
      if (lastBraceIndex > openParenIndex) {
        s.appendLeft(lastBraceIndex, `, __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} }`);
      }
    } else {
      s.appendLeft(closeParenIndex, `, ${sourceObj}`);
    }

    hasChanges = true;
  }

  // Process HOCs
  hocPattern.lastIndex = 0;
  while ((match = hocPattern.exec(code)) !== null) {
    if (isInsideStringOrComment(code, match.index)) continue;

    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findClosingParen(code, openParenIndex + 1);

    if (closeParenIndex === -1) continue;

    const lineNumber = getLineNumber(code, match.index);
    const sourceObj = `{ __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} } }`;
    const argsContent = code.slice(openParenIndex + 1, closeParenIndex).trim();

    if (argsContent && !argsContent.includes(",")) {
      s.appendLeft(closeParenIndex, `, ${sourceObj}`);
      hasChanges = true;
    }
  }

  // Process logger methods
  loggerMethodPattern.lastIndex = 0;
  while ((match = loggerMethodPattern.exec(code)) !== null) {
    if (isInsideStringOrComment(code, match.index)) continue;

    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findClosingParen(code, openParenIndex + 1);

    if (closeParenIndex === -1) continue;

    const lineNumber = getLineNumber(code, match.index);
    const sourceObj = `{ __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} } }`;
    const argsContent = code.slice(openParenIndex + 1, closeParenIndex).trim();

    if (argsContent) {
      let commaCount = 0;
      let depth = 0;
      for (const char of argsContent) {
        if (char === "(" || char === "{" || char === "[") depth++;
        else if (char === ")" || char === "}" || char === "]") depth--;
        else if (char === "," && depth === 0) commaCount++;
      }

      if (commaCount < 2) {
        const undefineds = commaCount === 0 ? ", undefined" : "";
        s.appendLeft(closeParenIndex, `${undefineds}, ${sourceObj}`);
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) {
    return null;
  }

  return {
    code: s.toString(),
    map: s.generateMap({ hires: true }),
  };
}

/**
 * Vite plugin factory
 */
function logrectVitePlugin(options = {}) {
  const { include = /\.[jt]sx?$/, exclude = /node_modules|logrect\/dist/ } = options;

  return {
    name: "logrect-source-injection",
    enforce: "pre",

    transform(code, id) {
      // Filter files
      if (exclude && id.match(exclude)) return null;
      if (include && !id.match(include)) return null;
      
      // Skip logrect library files
      if (id.includes("logrect/dist") || id.includes("logrect\\dist")) return null;
      if (id.includes("hooks.esm") || id.includes("hooks.js")) return null;
      
      // Skip if this looks like a library definition file
      if (code.includes("function useLogger(") || code.includes("function useLifecycleLogger(")) {
        return null;
      }

      // Skip if no logrect usage
      if (
        !code.includes("useLogger") &&
        !code.includes("useLifecycleLogger") &&
        !code.includes("useRenderLogger") &&
        !code.includes("usePropChangeLogger") &&
        !code.includes("useStateLogger") &&
        !code.includes("useEffectLogger") &&
        !code.includes("useCallbackLogger") &&
        !code.includes("useMemoLogger") &&
        !code.includes("useTimer") &&
        !code.includes("useConditionalLogger") &&
        !code.includes("useWhyDidYouRender") &&
        !code.includes("withLogger") &&
        !code.includes("logger.") &&
        !code.includes("log.")
      ) {
        return null;
      }

      return transformCode(code, id);
    },
  };
}

module.exports = logrectVitePlugin;
module.exports.default = logrectVitePlugin;

