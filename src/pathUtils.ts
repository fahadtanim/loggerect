/**
 * Extract file name from full path
 */
export function extractFileName(filePath: string): string {
  // Handle various path formats
  const parts = filePath.split(/[/\\]/);
  const fileName = parts[parts.length - 1];

  // Remove query strings and hashes
  return fileName.split("?")[0].split("#")[0];
}

/**
 * Check if path is a bundled/compiled path (Next.js, webpack, etc.)
 */
export function isBundledPath(filePath: string): boolean {
  return (
    filePath.includes("/_next/") ||
    filePath.includes("/chunks/") ||
    filePath.includes("webpack://") ||
    filePath.includes("webpack-internal://") ||
    /\.[a-f0-9]{6,}\./.test(filePath) || // hashed filenames like _6e37f64f._.js
    filePath.includes(".hot-update.")
  );
}

/**
 * Clean up file path for display
 */
export function cleanFilePath(filePath: string): string {
  if (!filePath) return "";

  // Remove query strings and hashes first
  let cleaned = filePath.split("?")[0].split("#")[0];

  // For bundled paths, try to extract the actual source file path
  // In SSR, Next.js paths are bundled but we can extract the original path
  if (isBundledPath(cleaned)) {
    // Try to extract file path from Next.js app router structure
    // Examples:
    // - /_next/static/chunks/app/docs/page.js -> app/docs/page
    // - /_next/static/chunks/app/docs/page.tsx -> app/docs/page
    // - file:///path/to/project/app/docs/page.tsx -> app/docs/page
    const appRouterMatch = cleaned.match(
      /(?:^|\/)(app\/[^?]+)\.(js|ts|tsx|jsx)/
    );
    if (appRouterMatch) {
      return appRouterMatch[1];
    }

    // Try to extract from pages router
    // Example: /_next/static/chunks/pages/docs.js -> pages/docs
    const pagesRouterMatch = cleaned.match(
      /(?:^|\/)(pages\/[^?]+)\.(js|ts|tsx|jsx)/
    );
    if (pagesRouterMatch) {
      return pagesRouterMatch[1];
    }

    // Try to extract from src/ directory (common in Next.js projects)
    // Example: /_next/static/chunks/src/components/Button.js -> src/components/Button
    const srcMatch = cleaned.match(/(?:^|\/)(src\/[^?]+)\.(js|ts|tsx|jsx)/);
    if (srcMatch) {
      return srcMatch[1];
    }

    // Try to extract from components directory
    // Example: /_next/static/chunks/components/Button.js -> components/Button
    const componentsMatch = cleaned.match(
      /(?:^|\/)(components\/[^?]+)\.(js|ts|tsx|jsx)/
    );
    if (componentsMatch) {
      return componentsMatch[1];
    }

    // Try to extract any meaningful component name from the path
    // Next.js turbopack puts some hints in chunk names
    const turboMatch = cleaned.match(/chunks\/([^/.]+)/);
    if (turboMatch && !turboMatch[1].match(/^[a-f0-9_]+$/i)) {
      return `[bundled: ${turboMatch[1]}]`;
    }

    // For SSR, show a simplified bundled indicator but don't hide it completely
    // This helps developers know the source is from SSR
    return "[bundled]";
  }

  // Remove webpack:// prefix
  cleaned = cleaned.replace(/^webpack:\/\/[^/]*/, "");

  // Remove webpack-internal:// prefix
  cleaned = cleaned.replace(/^webpack-internal:\/\/\//, "");

  // Remove file:// prefix
  cleaned = cleaned.replace(/^file:\/\//, "");

  // Filter out node_modules and node: paths - don't show them
  if (cleaned.includes("node_modules") || cleaned.startsWith("node:")) {
    return "";
  }

  // Remove node_modules path segments for brevity
  const nodeModulesIndex = cleaned.indexOf("node_modules");
  if (nodeModulesIndex === -1) {
    // If not in node_modules, try to get relative path from src/
    const srcIndex = cleaned.indexOf("/src/");
    if (srcIndex !== -1) {
      cleaned = cleaned.slice(srcIndex + 1);
    }
    // Also check for /app/ (Next.js app router)
    const appIndex = cleaned.indexOf("/app/");
    if (appIndex !== -1 && srcIndex === -1) {
      cleaned = cleaned.slice(appIndex + 1);
    }
    // Check for /components/ directory
    const componentsIndex = cleaned.indexOf("/components/");
    if (componentsIndex !== -1 && srcIndex === -1 && appIndex === -1) {
      cleaned = cleaned.slice(componentsIndex + 1);
    }
  }

  return cleaned;
}

