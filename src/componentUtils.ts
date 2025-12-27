/**
 * Get component name from various sources
 */
export function getComponentName(
  component: React.ComponentType | Function | string | null | undefined
): string {
  if (!component) return "Unknown";

  if (typeof component === "string") {
    return component;
  }

  // Try displayName first (set by React.memo, forwardRef, etc.)
  if ("displayName" in component && component.displayName) {
    return component.displayName as string;
  }

  // Try function name
  if (component.name) {
    return component.name;
  }

  // Try constructor name for class components
  if (component.constructor && component.constructor.name !== "Function") {
    return component.constructor.name;
  }

  return "Anonymous";
}

