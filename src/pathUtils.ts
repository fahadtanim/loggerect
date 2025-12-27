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
 * Check if path is a bundled/compiled path (Next.js, webpack, Turbopack, etc.)
 */
export function isBundledPath(filePath: string): boolean {
  return (
    filePath.includes("/_next/") ||
    filePath.includes("/chunks/") ||
    filePath.includes("webpack://") ||
    filePath.includes("webpack-internal://") ||
    filePath.includes("turbopack://") ||
    filePath.includes("__turbopack__") ||
    filePath.startsWith("[bundled") ||
    /\.[a-f0-9]{6,}\./.test(filePath) || // hashed filenames like _6e37f64f._.js
    filePath.includes(".hot-update.") ||
    filePath.includes("node_modules__pnpm") || // Turbopack pnpm format
    filePath.includes("node_modules__npm") || // Turbopack npm format
    /^[a-f0-9]{8,}$/.test(filePath.split("/").pop() || "") // Turbopack chunk IDs
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
    // Handle Turbopack format: [bundled: path]:line or node_modules__pnpm_xxx format
    // Example: [bundled: node_modules__pnpm_ff82d9a5]:17327
    const bundledMatch = cleaned.match(/\[bundled:\s*([^\]]+)\]/);
    if (bundledMatch) {
      const bundledPath = bundledMatch[1];
      // Try to extract meaningful path from bundled path
      // node_modules__pnpm_ff82d9a5 might contain source hints
      // For now, return the bundled path as-is since it might have useful info
      return bundledPath;
    }

    // Handle Turbopack pnpm format: node_modules__pnpm_xxx or similar
    // Try to extract source path from Turbopack chunk names
    if (
      cleaned.includes("node_modules__pnpm") ||
      cleaned.includes("node_modules__npm")
    ) {
      // Turbopack might encode source paths in chunk names
      // Try to extract from patterns like: node_modules__pnpm_xxx__src__components__Button
      const turbopackMatch = cleaned.match(
        /node_modules__(?:pnpm|npm)_[^_]+__(.+)/
      );
      if (turbopackMatch) {
        const extracted = turbopackMatch[1]
          .replace(/__/g, "/")
          .replace(/\.(js|ts|tsx|jsx)$/, "");
        if (extracted && !extracted.match(/^[a-f0-9]+$/)) {
          return extracted;
        }
      }
    }

    // Handle Turbopack protocol: turbopack://...
    if (cleaned.includes("turbopack://")) {
      // Extract path from turbopack:// protocol
      // Format: turbopack://project/app/components/Button.tsx
      const turbopackProtocolMatch = cleaned.match(
        /turbopack:\/\/[^/]+\/(.+?)(?:\?|$|:)/
      );
      if (turbopackProtocolMatch) {
        const extracted = turbopackProtocolMatch[1].replace(
          /\.(js|ts|tsx|jsx)$/,
          ""
        );
        if (extracted) {
          return extracted;
        }
      }
    }

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
