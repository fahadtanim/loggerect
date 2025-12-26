/**
 * logrect Babel Plugin
 *
 * Injects source location information into logrect function calls at compile time.
 * This allows accurate file:line tracking in bundled environments like Next.js.
 *
 * Usage in babel.config.js:
 * ```js
 * module.exports = {
 *   plugins: ['logrect/babel-plugin']
 * }
 * ```
 *
 * Or in .babelrc:
 * ```json
 * {
 *   "plugins": ["logrect/babel-plugin"]
 * }
 * ```
 *
 * For Next.js (which uses SWC by default), add to next.config.js:
 * ```js
 * module.exports = {
 *   // Force Babel instead of SWC for logrect source tracking
 *   experimental: {
 *     forceSwcTransforms: false
 *   }
 * }
 * ```
 * Then create a babel.config.js with the plugin.
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

// Logger methods that should have source location injected
const LOGGER_METHODS = ["trace", "debug", "info", "warn", "error", "log"];

// HOC functions
const LOGRECT_HOCS = ["withLogger", "withLoggerRef"];

/**
 * Clean up file path for display
 * Removes absolute path prefix, keeps relative path from src/app/pages
 */
function cleanFilePath(filename) {
  if (!filename) return filename;

  let cleaned = filename;

  // Remove common path prefixes to get a cleaner relative path
  const markers = ["/src/", "/app/", "/pages/", "/components/", "/lib/"];

  for (const marker of markers) {
    const index = cleaned.lastIndexOf(marker);
    if (index !== -1) {
      cleaned = cleaned.slice(index + 1);
      break;
    }
  }

  // If no marker found, try to get just the filename with parent dir
  if (cleaned === filename) {
    const parts = cleaned.split("/");
    if (parts.length > 2) {
      cleaned = parts.slice(-2).join("/");
    }
  }

  return cleaned;
}

module.exports = function logrectBabelPlugin({ types: t }) {
  return {
    name: "logrect-source-injection",

    visitor: {
      CallExpression(path, state) {
        const { node } = path;
        const filename = state.filename || state.file?.opts?.filename;

        if (!filename) return;

        const loc = node.loc;
        if (!loc) return;

        // Determine what kind of call this is
        let callType = null;
        let calleeName = null;

        // Check for direct function calls: useLogger(), useLifecycleLogger(), etc.
        if (t.isIdentifier(node.callee)) {
          calleeName = node.callee.name;
          if (LOGRECT_HOOKS.includes(calleeName)) {
            callType = "hook";
          } else if (LOGRECT_HOCS.includes(calleeName)) {
            callType = "hoc";
          }
        }

        // Check for method calls: logger.info(), log.debug(), etc.
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.property)
        ) {
          const methodName = node.callee.property.name;

          // Check if it's a logger method call
          if (LOGGER_METHODS.includes(methodName)) {
            // Check if the object is 'logger' or 'log' (common variable names)
            if (t.isIdentifier(node.callee.object)) {
              const objectName = node.callee.object.name;
              if (objectName === "logger" || objectName === "log") {
                callType = "loggerMethod";
                calleeName = `${objectName}.${methodName}`;
              }
            }
            // Also check for chained calls like useLogger().info()
            if (t.isCallExpression(node.callee.object)) {
              callType = "loggerMethod";
              calleeName = methodName;
            }
          }
        }

        if (!callType) return;

        // Create source location object
        const cleanedPath = cleanFilePath(filename);
        const sourceProps = [
          t.objectProperty(
            t.identifier("fileName"),
            t.stringLiteral(cleanedPath)
          ),
          t.objectProperty(
            t.identifier("lineNumber"),
            t.numericLiteral(loc.start.line)
          ),
          t.objectProperty(
            t.identifier("columnNumber"),
            t.numericLiteral(loc.start.column + 1)
          ),
        ];

        const sourceObject = t.objectExpression([
          t.objectProperty(
            t.identifier("__source"),
            t.objectExpression(sourceProps)
          ),
        ]);

        // Inject source based on call type
        if (callType === "hook") {
          injectIntoHook(t, node, sourceObject, calleeName);
        } else if (callType === "hoc") {
          injectIntoHOC(t, node, sourceObject);
        } else if (callType === "loggerMethod") {
          injectIntoLoggerMethod(t, node, sourceObject);
        }
      },
    },
  };
};

/**
 * Inject source into hook calls
 * Hooks typically have signature: hookName(componentName, options?)
 * We add/merge __source into options
 */
function injectIntoHook(t, node, sourceObject, hookName) {
  const args = node.arguments;

  // Different hooks have different signatures
  // useLogger(componentName, options?)
  // useLifecycleLogger(componentName, options?)
  // useRenderLogger(componentName, options?)
  // etc.

  if (args.length === 0) {
    // No arguments, add source as first arg options
    args.push(sourceObject);
    return;
  }

  // Check if last argument is an object (options)
  const lastArg = args[args.length - 1];

  if (t.isObjectExpression(lastArg)) {
    // Merge __source into existing options
    const hasSource = lastArg.properties.some(
      (prop) =>
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === "__source"
    );

    if (!hasSource) {
      lastArg.properties.push(
        t.objectProperty(
          t.identifier("__source"),
          sourceObject.properties[0].value
        )
      );
    }
  } else {
    // Add new options object with __source
    args.push(sourceObject);
  }
}

/**
 * Inject source into HOC calls
 * HOCs have signature: withLogger(Component, options?)
 */
function injectIntoHOC(t, node, sourceObject) {
  const args = node.arguments;

  if (args.length < 1) return;

  if (args.length === 1) {
    // Only component, add options with source
    args.push(sourceObject);
  } else if (args.length >= 2) {
    const optionsArg = args[1];

    if (t.isObjectExpression(optionsArg)) {
      // Merge into existing options
      const hasSource = optionsArg.properties.some(
        (prop) =>
          t.isObjectProperty(prop) &&
          t.isIdentifier(prop.key) &&
          prop.key.name === "__source"
      );

      if (!hasSource) {
        optionsArg.properties.push(
          t.objectProperty(
            t.identifier("__source"),
            sourceObject.properties[0].value
          )
        );
      }
    }
  }
}

/**
 * Inject source into logger method calls
 * Logger methods have signature: logger.info(message, data?, context?)
 * We add/merge __source into context (3rd argument)
 */
function injectIntoLoggerMethod(t, node, sourceObject) {
  const args = node.arguments;

  if (args.length === 0) return;

  // Ensure we have at least 3 arguments (message, data, context)
  while (args.length < 3) {
    args.push(t.identifier("undefined"));
  }

  const contextArg = args[2];

  if (t.isObjectExpression(contextArg)) {
    // Merge into existing context
    const hasSource = contextArg.properties.some(
      (prop) =>
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === "__source"
    );

    if (!hasSource) {
      contextArg.properties.push(
        t.objectProperty(
          t.identifier("__source"),
          sourceObject.properties[0].value
        )
      );
    }
  } else if (t.isIdentifier(contextArg) && contextArg.name === "undefined") {
    // Replace undefined with source object
    args[2] = sourceObject;
  } else {
    // Context is something else (variable, call expression, etc.)
    // Wrap it with spread + source
    args[2] = t.objectExpression([
      t.spreadElement(contextArg),
      t.objectProperty(
        t.identifier("__source"),
        sourceObject.properties[0].value
      ),
    ]);
  }
}

// Also export as default for ES modules
module.exports.default = module.exports;
