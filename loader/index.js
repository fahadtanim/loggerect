/**
 * logrect Webpack/Turbopack Loader
 *
 * A webpack-compatible loader for source location injection.
 * Works with both Webpack and Turbopack (via turbopack.rules).
 *
 * Usage in next.config.ts (Turbopack):
 * ```ts
 * export default {
 *   turbopack: {
 *     rules: {
 *       '*.tsx': {
 *         loaders: ['logrect/loader'],
 *         as: '*.tsx',
 *       },
 *       '*.ts': {
 *         loaders: ['logrect/loader'],
 *         as: '*.ts',
 *       },
 *     },
 *   },
 * }
 * ```
 */

"use strict";

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

// HOC functions
const LOGRECT_HOCS = ["withLogger", "withLoggerRef"];

/**
 * Clean up file path for display
 * Extracts meaningful paths from full file paths, handling Next.js app router, pages router, and src/ directories
 */
function cleanFilePath(filename) {
  if (!filename) return filename;

  let cleaned = filename;

  // Remove query strings and hashes
  cleaned = cleaned.split("?")[0].split("#")[0];

  // Remove file:// prefix
  cleaned = cleaned.replace(/^file:\/\//, "");

  // Try to extract from common Next.js directory structures
  const markers = ["/src/", "/app/", "/pages/", "/components/", "/lib/"];

  for (const marker of markers) {
    const index = cleaned.lastIndexOf(marker);
    if (index !== -1) {
      cleaned = cleaned.slice(index + 1);
      // Remove file extension for cleaner display
      cleaned = cleaned.replace(/\.(js|ts|tsx|jsx)$/, "");
      break;
    }
  }

  // If no marker found, try to get relative path
  if (cleaned === filename || cleaned === filename.replace(/^file:\/\//, "")) {
    const parts = cleaned.split(/[/\\]/);
    // Try to find src/, app/, or pages/ in the path
    let startIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "src" || parts[i] === "app" || parts[i] === "pages") {
        startIndex = i;
        break;
      }
    }
    if (startIndex !== -1) {
      cleaned = parts.slice(startIndex).join("/");
      cleaned = cleaned.replace(/\.(js|ts|tsx|jsx)$/, "");
    } else if (parts.length > 2) {
      // Fallback: use last 2 parts
      cleaned = parts.slice(-2).join("/");
      cleaned = cleaned.replace(/\.(js|ts|tsx|jsx)$/, "");
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

    if (
      !inString &&
      !inTemplate &&
      (char === '"' || char === "'" || char === "`")
    ) {
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
  const escaped = functionNames.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  // Match function calls but not definitions (no "function " before the name)
  // Also handle TypeScript generics like useStateLogger<T>(...) or useStateLogger<Map<K,V>>(...)
  // The generic pattern handles one level of nesting: <[^<>]|<[^<>]*>>
  return new RegExp(
    `(?<!function\\s+)\\b(${escaped.join(
      "|"
    )})(?:<(?:[^<>]|<[^<>]*>)*>)?\\s*\\(`,
    "g"
  );
}

/**
 * Check if the last argument in a function call is an object literal
 * This helps determine if we should merge __source into existing options
 * or add a new options object
 */
function isLastArgObject(argsContent) {
  if (!argsContent || argsContent.length === 0) return false;

  // Trim and check if ends with }
  const trimmed = argsContent.trim();
  if (!trimmed.endsWith("}")) return false;

  // Find the matching { for the last }
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = trimmed.length - 1; i >= 0; i--) {
    const char = trimmed[i];
    const prevChar = i > 0 ? trimmed[i - 1] : "";

    // Handle strings (going backwards)
    if (
      !inString &&
      (char === '"' || char === "'" || char === "`") &&
      prevChar !== "\\"
    ) {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar && prevChar !== "\\") {
      inString = false;
      stringChar = null;
      continue;
    }
    if (inString) continue;

    if (char === "}") depth++;
    else if (char === "{") {
      depth--;
      if (depth === 0) {
        // Found matching brace - check if this is a top-level argument
        // by verifying there's a comma or start of args before it
        const before = trimmed.slice(0, i).trim();
        if (before === "" || before.endsWith(",")) {
          return true;
        }
        // Could be inside another construct, so not a standalone options object
        return false;
      }
    }
  }

  return false;
}

/**
 * Transform code to inject source locations
 */
function transformCode(code, resourcePath) {
  const cleanedPath = cleanFilePath(resourcePath);

  // Skip if this looks like a library definition file
  if (
    code.includes("function useLogger(") ||
    code.includes("function useLifecycleLogger(")
  ) {
    return code;
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
    return code;
  }

  let result = code;
  let offset = 0;

  const hookPattern = createCallPattern(LOGRECT_HOOKS);
  const hocPattern = createCallPattern(LOGRECT_HOCS);
  const loggerMethodPattern =
    /(?<!function\s+)\b(logger|log)\.(trace|debug|info|warn|error|log)\s*\(/g;

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

    let injection = "";
    let insertPos = closeParenIndex + offset;

    if (argsContent === "") {
      // No arguments: hookName() -> hookName({ __source: ... })
      injection = sourceObj;
      result =
        result.slice(0, openParenIndex + 1 + offset) +
        injection +
        result.slice(closeParenIndex + offset);
      offset += injection.length - (closeParenIndex - openParenIndex - 1);
    } else if (argsContent.includes("{") && !argsContent.startsWith("{")) {
      // Has arguments but last one might be options object
      const lastBraceIndex = code.lastIndexOf("}", closeParenIndex);
      if (lastBraceIndex > openParenIndex) {
        injection = `, __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} }`;
        insertPos = lastBraceIndex + offset;
        result =
          result.slice(0, insertPos) + injection + result.slice(insertPos);
        offset += injection.length;
      } else {
        injection = `, ${sourceObj}`;
        result =
          result.slice(0, insertPos) + injection + result.slice(insertPos);
        offset += injection.length;
      }
    } else if (argsContent.startsWith("{")) {
      // First arg is object
      const lastBraceIndex = code.lastIndexOf("}", closeParenIndex);
      if (lastBraceIndex > openParenIndex) {
        injection = `, __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} }`;
        insertPos = lastBraceIndex + offset;
        result =
          result.slice(0, insertPos) + injection + result.slice(insertPos);
        offset += injection.length;
      }
    } else {
      // Simple arguments: hookName("Name") -> hookName("Name", { __source: ... })
      injection = `, ${sourceObj}`;
      result = result.slice(0, insertPos) + injection + result.slice(insertPos);
      offset += injection.length;
    }
  }

  // Reset for HOCs (use original code positions)
  offset = 0;
  result = code;

  // Re-process with fresh result
  offset = 0;

  // Combined processing for all patterns
  const allMatches = [];

  // Collect hook matches
  hookPattern.lastIndex = 0;
  while ((match = hookPattern.exec(code)) !== null) {
    if (!isInsideStringOrComment(code, match.index)) {
      allMatches.push({
        type: "hook",
        index: match.index,
        match: match[0],
        name: match[1],
      });
    }
  }

  // Collect HOC matches
  hocPattern.lastIndex = 0;
  while ((match = hocPattern.exec(code)) !== null) {
    if (!isInsideStringOrComment(code, match.index)) {
      allMatches.push({
        type: "hoc",
        index: match.index,
        match: match[0],
        name: match[1],
      });
    }
  }

  // Collect logger method matches
  loggerMethodPattern.lastIndex = 0;
  while ((match = loggerMethodPattern.exec(code)) !== null) {
    if (!isInsideStringOrComment(code, match.index)) {
      allMatches.push({
        type: "logger",
        index: match.index,
        match: match[0],
        name: `${match[1]}.${match[2]}`,
      });
    }
  }

  // Sort by position (process from end to avoid offset issues)
  allMatches.sort((a, b) => b.index - a.index);

  // Process each match
  for (const m of allMatches) {
    const openParenIndex = m.index + m.match.length - 1;
    const closeParenIndex = findClosingParen(result, openParenIndex + 1);

    if (closeParenIndex === -1) continue;

    const lineNumber = getLineNumber(code, m.index);
    const argsContent = result
      .slice(openParenIndex + 1, closeParenIndex)
      .trim();
    const sourceObj = `{ __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} } }`;

    if (m.type === "hook") {
      if (argsContent === "") {
        // No arguments: add source as first arg
        result =
          result.slice(0, openParenIndex + 1) +
          sourceObj +
          result.slice(closeParenIndex);
      } else {
        // Check if last argument looks like an options object (ends with })
        // by finding if there's a top-level { } at the end
        const lastArgIsObject = isLastArgObject(argsContent);

        if (lastArgIsObject) {
          // Last arg is options object, inject __source into it
          const lastBraceIndex = result.lastIndexOf("}", closeParenIndex);
          if (lastBraceIndex > openParenIndex) {
            const injection = `, __source: { fileName: "${cleanedPath}", lineNumber: ${lineNumber} }`;
            result =
              result.slice(0, lastBraceIndex) +
              injection +
              result.slice(lastBraceIndex);
          }
        } else {
          // No options object, add one with __source
          result =
            result.slice(0, closeParenIndex) +
            `, ${sourceObj}` +
            result.slice(closeParenIndex);
        }
      }
    } else if (m.type === "hoc") {
      if (argsContent && !argsContent.includes(",")) {
        result =
          result.slice(0, closeParenIndex) +
          `, ${sourceObj}` +
          result.slice(closeParenIndex);
      }
    } else if (m.type === "logger" && argsContent) {
      // Count commas
      let commaCount = 0;
      let depth = 0;
      for (const char of argsContent) {
        if (char === "(" || char === "{" || char === "[") depth++;
        else if (char === ")" || char === "}" || char === "]") depth--;
        else if (char === "," && depth === 0) commaCount++;
      }

      if (commaCount < 2) {
        const undefineds = commaCount === 0 ? ", undefined" : "";
        result =
          result.slice(0, closeParenIndex) +
          `${undefineds}, ${sourceObj}` +
          result.slice(closeParenIndex);
      }
    }
  }

  return result;
}

/**
 * Webpack loader function
 */
module.exports = function logrectLoader(source) {
  const resourcePath = this.resourcePath;

  // Skip node_modules and logrect library files
  if (resourcePath.includes("node_modules")) {
    return source;
  }
  if (
    resourcePath.includes("logrect/dist") ||
    resourcePath.includes("logrect\\dist")
  ) {
    return source;
  }

  return transformCode(source, resourcePath);
};

module.exports.default = module.exports;
