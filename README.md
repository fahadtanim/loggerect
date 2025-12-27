<p align="center">
  <img src="https://raw.githubusercontent.com/fahadtanim/loggerect/main/loggerect.png" alt="loggerect" width="200" />
</p>

<h1 align="center">loggerect</h1>

<p align="center">
  A powerful, zero-dependency logger for React and Node.js with full source path tracking, TypeScript decorators, and environment-aware output. See exactly where your logs come from.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/loggerect"><img src="https://img.shields.io/npm/v/loggerect.svg" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.npmjs.com/package/loggerect"><img src="https://img.shields.io/npm/dm/loggerect.svg" alt="npm downloads" /></a>
  <a href="https://bundlephobia.com/package/loggerect"><img src="https://img.shields.io/bundlephobia/minzip/loggerect" alt="bundle size" /></a>
</p>

## ✨ Features

- 🎯 **Accurate Source Tracking** - See exact file:line in browser console (via build plugins)
- 🎨 **Beautiful Console Output** - Styled badges, timestamps, and structured formatting
- 🌈 **Unified Colors** - Server console colors match browser console (ANSI + CSS)
- ⚛️ **React Support** - Hooks, HOCs, and decorators for React (optional)
- 🖥️ **Node.js Compatible** - Works in pure Node.js without React
- 🔧 **Highly Configurable** - Customize everything from log levels to badge styles
- 🌍 **Environment-Aware** - Different behavior for development vs production
- 📦 **Zero Dependencies** - Lightweight and fast
- 🖥️ **SSR Compatible** - Works seamlessly with Next.js, Remix, and other SSR frameworks
- 🧹 **Smart Filtering** - Automatically filters internal React/Node.js function names
- 🔌 **Universal Plugin Support** - Works with Vite, Webpack, Turbopack, Rollup, and esbuild

## 📦 Installation

```bash
npm install loggerect
```

## 🚀 Quick Start

### Basic Usage (Node.js & React)

```ts
import { logger, configure } from "loggerect";

// Configure (optional - has sensible defaults)
configure({
  level: "debug",
  timestamps: true,
});

// Log messages
logger.trace("Detailed trace information");
logger.debug("Debug information");
logger.info("General information");
logger.warn("Warning message");
logger.error("Error occurred", { details: "error info" });
```

### Node.js Usage

```js
// Pure Node.js - no React needed!
const { logger } = require("loggerect");
// or
import { logger } from "loggerect";

// Use in any Node.js application
logger.info("Server started", { port: 3000 });
logger.debug("Processing request", { method: "GET", path: "/api/users" });

// Component-scoped logging (works in Node.js too!)
const apiLogger = logger.forComponent("API").withTags("http", "rest");
apiLogger.info("Request received", { userId: 123 });

// Performance timing
logger.time("databaseQuery");
await queryDatabase();
logger.timeEnd("databaseQuery"); // Logs: ⏱️ databaseQuery: 45.23ms
```

### React Hooks

```tsx
import { useLogger, useLifecycleLogger } from "loggerect";

function MyComponent() {
  const log = useLogger("MyComponent");
  useLifecycleLogger("MyComponent"); // Auto-logs mount/unmount

  const handleClick = () => {
    log.info("Button clicked!");
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

## 🔌 Source Tracking Setup

For accurate source file:line tracking in the browser console, add one of the build plugins:

### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import logrectPlugin from "loggerect/vite-plugin";

export default defineConfig({
  plugins: [logrectPlugin()],
});
```

### Next.js (Turbopack)

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.{ts,tsx,js,jsx}": {
        loaders: ["loggerect/loader"],
      },
    },
  },
};

export default nextConfig;
```

### Next.js (Webpack)

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      const logrectPlugin = require("loggerect/unplugin");
      config.plugins.push(logrectPlugin.webpack());
    }
    return config;
  },
};

export default nextConfig;
```

### Webpack

```js
// webpack.config.js
const logrectPlugin = require("loggerect/unplugin");

module.exports = {
  plugins: [logrectPlugin.webpack()],
};
```

### Rollup

```js
// rollup.config.js
import logrectPlugin from "loggerect/unplugin";

export default {
  plugins: [logrectPlugin.rollup()],
};
```

### esbuild

```js
// esbuild.config.js
const logrectPlugin = require("loggerect/unplugin");

require("esbuild").build({
  plugins: [logrectPlugin.esbuild()],
});
```

### Babel (Alternative)

```js
// babel.config.js
module.exports = {
  plugins: ["loggerect/babel-plugin"],
};
```

## 📚 API Reference

### Core Logger (Node.js & React)

```ts
import { logger } from 'loggerect';

// Log levels
logger.trace(message, data?);  // 🔍 Most verbose
logger.debug(message, data?);  // 🐛 Debug info
logger.info(message, data?);   // ℹ️ General info
logger.warn(message, data?);   // ⚠️ Warnings
logger.error(message, data?);  // ❌ Errors

// Component-scoped logger
const componentLogger = logger.forComponent('MyComponent');
componentLogger.info('Scoped to MyComponent');

// With tags and metadata
const taggedLogger = logger
  .forComponent('MyComponent')
  .withTags('auth', 'api')
  .withMetadata({ userId: 123 });

// Performance timing
logger.time('fetchData');
await fetchData();
logger.timeEnd('fetchData'); // Logs: ⏱️ fetchData: 156.78ms

// Lifecycle helpers
logger.mount('ComponentName');    // 🚀 Mounted
logger.unmount('ComponentName');  // 💤 Unmounted
logger.render('ComponentName', 1, 2.5); // 🎨 Render #1 (2.5ms)
```

### React Hooks

#### `useLogger(componentName, options?)`

Creates a component-scoped logger instance.

```tsx
function MyComponent() {
  const log = useLogger("MyComponent");

  useEffect(() => {
    log.info("Component ready");
    log.debug("Fetching data...", { endpoint: "/api/users" });
  }, []);

  return <div>Hello</div>;
}
```

#### `useLifecycleLogger(componentName, options?)`

Automatically logs component mount and unmount events.

```tsx
function MyComponent() {
  useLifecycleLogger("MyComponent");
  // Logs: 🚀 Mounted (on mount)
  // Logs: 💤 Unmounted (lifetime: 5234.12ms) (on unmount)

  return <div>Hello</div>;
}
```

#### `useRenderLogger(componentName, options?)`

Tracks and logs every render with timing.

```tsx
function MyComponent() {
  useRenderLogger("MyComponent");
  // Logs: 🎨 Render #1 (2.34ms)
  // Logs: 🎨 Render #2 (1.12ms)

  return <div>Hello</div>;
}
```

#### `useStateLogger<T>(componentName, stateName, initialValue, options?)`

useState replacement that logs state changes.

```tsx
function Counter() {
  const [count, setCount] = useStateLogger("Counter", "count", 0);
  // Logs: 🗃️ State "count" changed { prev: 0, next: 1 }

  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

#### `usePropChangeLogger<T>(componentName, props, options?)`

Logs whenever props change with diff information.

```tsx
function UserProfile({ user, theme }) {
  usePropChangeLogger("UserProfile", { user, theme });
  // Logs: 📦 Props changed { user: { prev: {...}, next: {...} } }

  return <div>{user.name}</div>;
}
```

#### `useEffectLogger(componentName, effectName, effect, deps, options?)`

useEffect replacement that logs effect execution.

```tsx
function DataFetcher({ userId }) {
  useEffectLogger(
    "DataFetcher",
    "fetchUser",
    () => {
      fetchUser(userId);
    },
    [userId]
  );
  // Logs: ▶️ Effect "fetchUser" running
  // Logs: ⏹️ Effect "fetchUser" cleanup

  return <div>...</div>;
}
```

#### `useCallbackLogger<T>(componentName, callbackName, callback, deps, options?)`

useCallback replacement that logs callback executions.

```tsx
function Form() {
  const handleSubmit = useCallbackLogger(
    "Form",
    "handleSubmit",
    (data) => {
      submitForm(data);
    },
    []
  );
  // Logs: 📞 Callback "handleSubmit" called (2.34ms)

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### `useMemoLogger<T>(componentName, memoName, factory, deps, options?)`

useMemo replacement that logs when values are recomputed.

```tsx
function ExpensiveList({ items }) {
  const sortedItems = useMemoLogger(
    "ExpensiveList",
    "sortedItems",
    () => {
      return items.sort((a, b) => a.name.localeCompare(b.name));
    },
    [items]
  );
  // Logs: 🧮 Memo "sortedItems" computed (5.67ms)

  return (
    <ul>
      {sortedItems.map((item) => (
        <li>{item.name}</li>
      ))}
    </ul>
  );
}
```

#### `useTimer(componentName, options?)`

Manual performance timing within components.

```tsx
function DataLoader() {
  const timer = useTimer("DataLoader");

  const loadData = async () => {
    timer.start("loadData");
    const data = await fetchData();
    timer.end("loadData"); // Logs: ⏱️ loadData: 234.56ms
    return data;
  };

  return <button onClick={loadData}>Load</button>;
}
```

#### `useWhyDidYouRender<T>(componentName, props, options?)`

Debug tool to understand why a component re-rendered.

```tsx
function MyComponent(props) {
  useWhyDidYouRender("MyComponent", props);
  // Logs detailed information about what caused the re-render

  return <div>...</div>;
}
```

### Higher-Order Component (HOC)

```tsx
import { withLogger } from "loggerect";

const MyComponent = ({ name }) => <div>Hello {name}</div>;

// Basic usage
export default withLogger(MyComponent);

// With options
export default withLogger(MyComponent, {
  trackRenders: true,
  trackPropChanges: true,
  logLifecycle: true,
  displayName: "MyAwesomeComponent",
  level: "debug",
  tags: ["ui", "feature"],
});
```

### TypeScript Decorators

> Note: Requires `experimentalDecorators: true` in tsconfig.json

```tsx
import { Log, LogClass, Trace, Debug, Info, Warn, Error } from "loggerect";

class UserService {
  @Log()
  async fetchUser(id: string) {
    // Logs: → fetchUser() { args: ["123"] }
    // Logs: ← fetchUser() (156.78ms)
    return await api.getUser(id);
  }

  @Log({ logArgs: false, logTime: true })
  processData(data: any) {
    // Custom options
  }

  @Debug()
  debugMethod() {
    /* ... */
  }

  @Info()
  infoMethod() {
    /* ... */
  }

  @Warn()
  warnMethod() {
    /* ... */
  }

  @Error()
  errorMethod() {
    /* ... */
  }
}

// Log entire class
@LogClass()
class MyService {
  // All methods will be logged
}
```

## 🎨 Log Levels & Badge Colors

loggerect uses styled badges with consistent colors for each log level:

**Visual demonstration:**

<div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
  <span style="background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🔍 TRACE</span>
  <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🐛 DEBUG</span>
  <span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: 600;">ℹ️ INFO</span>
  <span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;">⚠️ WARN</span>
  <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 600;">❌ ERROR</span>
</div>

| Level     | Badge                                                                                                                                       | Background Color                  | Text Color | Description                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------- | ------------------------------ |
| **TRACE** | <span style="background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🔍 TRACE</span> | `rgba(107, 114, 128, 0.2)` (Gray) | `#9CA3AF`  | Most verbose, detailed tracing |
| **DEBUG** | <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🐛 DEBUG</span>   | `rgba(34, 197, 94, 0.2)` (Green)  | `#22c55e`  | Debug information              |
| **INFO**  | <span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: 600;">ℹ️ INFO</span>   | `rgba(59, 130, 246, 0.2)` (Blue)  | `#3b82f6`  | General information            |
| **WARN**  | <span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;">⚠️ WARN</span>    | `rgba(234, 179, 8, 0.2)` (Yellow) | `#eab308`  | Warnings                       |
| **ERROR** | <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 600;">❌ ERROR</span>   | `rgba(239, 68, 68, 0.2)` (Red)    | `#ef4444`  | Errors                         |

### Additional Badges

| Badge | Usage              |
| ----- | ------------------ |
| 🚀    | Component mount    |
| 💤    | Component unmount  |
| 🎨    | Component render   |
| 🔄    | Component update   |
| 📦    | Prop changes       |
| 🗃️    | State changes      |
| ⏱️    | Performance timing |

All badges use a semi-transparent background (20% opacity) with matching text colors for a modern, readable console appearance.

## ⚙️ Configuration

```tsx
import { configure } from "loggerect";

configure({
  // Environment & Level
  environment: "development", // 'development' | 'production' | 'test'
  level: "debug", // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

  // Formatting
  format: "pretty", // 'pretty' | 'json' | 'minimal' | 'detailed'
  timestamps: true,
  timestampFormat: "locale", // 'locale' | 'iso' | 'unix' | 'relative'
  colors: true,

  // Source Tracking
  includeSourcePath: "auto", // true | false | 'auto'
  includeStackTrace: true,

  // React-specific
  trackRenders: true,
  trackPropChanges: true,
  trackStateChanges: true,

  // Performance
  performance: true,

  // Output Control
  groupLogs: true,
  collapseGroups: true,
  maxDepth: 4,
  maxArrayLength: 100,
  maxStringLength: 1000,

  // Persistence (experimental)
  persist: false,
  storageKey: "loggerect_logs",
  maxPersistedLogs: 1000,

  // Custom Styles (defaults shown below)
  styles: {
    // TRACE: Gray background (rgba(107, 114, 128, 0.2)), Gray text (#9CA3AF)
    trace:
      "background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-weight: 600;",
    // DEBUG: Green background (rgba(34, 197, 94, 0.2)), Green text (#22c55e)
    debug:
      "background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;",
    // INFO: Blue background (rgba(59, 130, 246, 0.2)), Blue text (#3b82f6)
    info: "background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: 600;",
    // WARN: Yellow background (rgba(234, 179, 8, 0.2)), Yellow text (#eab308)
    warn: "background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;",
    // ERROR: Red background (rgba(239, 68, 68, 0.2)), Red text (#ef4444)
    error:
      "background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 600;",
  },

  // Custom Badges
  badges: {
    trace: "🔍",
    debug: "🐛",
    info: "ℹ️",
    warn: "⚠️",
    error: "❌",
    render: "🎨",
    mount: "🚀",
    unmount: "💤",
    props: "📦",
    state: "🗃️",
    time: "⏱️",
  },
});
```

### Environment-Specific Configuration

```tsx
configure({
  // Auto-detected, or set manually
  environment: process.env.NODE_ENV,

  // Different levels per environment
  level: process.env.NODE_ENV === "production" ? "warn" : "trace",

  // Disable source paths in production
  includeSourcePath: process.env.NODE_ENV !== "production",

  // Minimal format in production
  format: process.env.NODE_ENV === "production" ? "minimal" : "pretty",
});
```

## 📤 Entry Points

loggerect provides multiple entry points for different use cases:

```tsx
// Main entry - SSR-safe (no React dependencies)
// Use in server components, API routes, and utility functions
import { logger, configure, isServer, isClient } from "loggerect";

// React hooks (client components only)
import { useLogger, useLifecycleLogger, useStateLogger } from "loggerect/hooks";

// React HOCs (client components only)
import { withLogger, withLoggerRef } from "loggerect/react";

// Core only (alternative SSR entry point)
import { logger, configure } from "loggerect/core";
```

### When to Use Which Entry Point

- **`loggerect`** (main): Use in server components, API routes, and any SSR context
- **`loggerect/hooks`**: Use in client components that need React hooks
- **`loggerect/react`**: Use in client components that need HOCs
- **`loggerect/core`**: Alternative SSR entry point (same as main)

## 🌐 SSR Support

loggerect is fully SSR-compatible with separate entry points for server and client code. The main `loggerect` package is SSR-safe and can be used directly in server components:

```tsx
// Next.js Server Component (SSR-safe)
import { logger, isServer } from "loggerect";

export default async function Page() {
  if (isServer()) {
    const log = logger
      .forComponent("Page")
      .withTags("server", "page");
    
    log.info("Rendering page on server");
  }

  return <div>Hello World</div>;
}
```

### Entry Points for SSR

```tsx
// Main entry - SSR-safe (no React dependencies)
import { logger, configure, isServer, isClient } from "loggerect";

// React hooks (client components only)
import { useLogger, useLifecycleLogger } from "loggerect/hooks";

// React HOCs (client components only)
import { withLogger } from "loggerect/react";
```

### Server Console Colors

loggerect automatically matches console colors between server and browser:
- **Server console**: Uses ANSI color codes (RGB) matching CSS colors exactly
- **Browser console**: Uses CSS styling with matching colors
- **Badge styling**: Same background and text colors on both server and client
- **Component names**: Automatically extracted and filtered from stack traces
- **Smart filtering**: Filters out internal React/Node.js function names and minified code

The server console output will look identical to the browser console, with matching badge colors and spacing.

## 📋 Console Output Examples

### Pretty Format (Development)

The console output uses styled badges with colors matching each log level. Colors are consistent between server and browser consoles. Here's what they look like:

**Example log entries with colored badges:**

<pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 8px; overflow-x: auto; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; line-height: 1.6;">
<span style="color: #6B7280;">[4:25:51 AM]</span> <span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: 600;">ℹ️ INFO</span> <span style="color: #9CA3AF;">|</span> Navbar.useLifecycleLogger.useEffect() → 🚀 Mounted <span style="color: #6B7280; font-size: 0.9em;">@ src/components/Navbar.tsx:9</span>

<span style="color: #6B7280;">[4:25:51 AM]</span> <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🐛 DEBUG</span> <span style="color: #9CA3AF;">|</span> Navbar.Navbar.useEffect() → Scroll listener attached <span style="color: #6B7280; font-size: 0.9em;">@ src/components/Navbar.tsx:8</span>
<span style="color: #6B7280;">[4:25:51 AM]</span> <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🐛 DEBUG</span> <span style="color: #10B981; font-weight: bold;">|</span> 📊 <span style="color: #9CA3AF;">[Navbar].Navbar.useEffect() Data:</span> <span style="color: #6B7280; font-size: 0.9em;">@ src/components/Navbar.tsx:8</span>
<span style="color: #d4d4d4; padding-left: 2rem;">{ scrollY: 0 }</span>

<span style="color: #6B7280;">[4:25:52 AM]</span> <span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;">⚠️ WARN</span> <span style="color: #9CA3AF;">|</span> DataService.fetchData() → Rate limit approaching <span style="color: #6B7280; font-size: 0.9em;">@ src/services/DataService.ts:45</span>

<span style="color: #6B7280;">[4:25:53 AM]</span> <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 600;">❌ ERROR</span> <span style="color: #9CA3AF;">|</span> AuthService.login() → Authentication failed <span style="color: #6B7280; font-size: 0.9em;">@ src/services/AuthService.ts:23</span>

<span style="color: #6B7280;">[4:25:50 AM]</span> <span style="background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🔍 TRACE</span> <span style="color: #9CA3AF;">|</span> Component.render() → Rendering child components <span style="color: #6B7280; font-size: 0.9em;">@ src/components/Component.tsx:15</span>
</pre>

**Badge colors reference:**

- <span style="background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🔍 TRACE</span> - Gray badge (`rgba(107, 114, 128, 0.2)` bg, `#9CA3AF` text)
- <span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🐛 DEBUG</span> - Green badge (`rgba(34, 197, 94, 0.2)` bg, `#22c55e` text)
- <span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px; font-weight: 600;">ℹ️ INFO</span> - Blue badge (`rgba(59, 130, 246, 0.2)` bg, `#3b82f6` text)
- <span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px; font-weight: 600;">⚠️ WARN</span> - Yellow badge (`rgba(234, 179, 8, 0.2)` bg, `#eab308` text)
- <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px; font-weight: 600;">❌ ERROR</span> - Red badge (`rgba(239, 68, 68, 0.2)` bg, `#ef4444` text)

### JSON Format (Production/Logging Services)

```json
{
  "timestamp": "2024-01-15T04:25:51.000Z",
  "level": "info",
  "component": "Navbar",
  "message": "🚀 Mounted"
}
```

### Minimal Format

```
[INFO] Navbar: 🚀 Mounted
```

## 🔧 TypeScript Support

loggerect is written in TypeScript and provides full type definitions:

```tsx
import type {
  LogLevel,
  LogrectConfig,
  HOCOptions,
  DecoratorOptions,
} from "loggerect";

// All hooks and functions are fully typed
const log = useLogger<{ userId: string }>("MyComponent", {
  metadata: { userId: "123" },
});
```

## 📝 License

MIT © [loggerect](https://loggerect.dev)

---

<p align="center">
  <strong>See exactly where your logs come from.</strong><br>
  <a href="https://loggerect.dev">Website</a> · 
  <a href="https://github.com/fahadtanim/loggerect">GitHub</a> · 
  <a href="https://www.npmjs.com/package/loggerect">npm</a>
</p>
