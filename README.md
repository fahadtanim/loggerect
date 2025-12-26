# 🟩 loggerect

A powerful, zero-dependency React logger with full source path tracking, TypeScript decorators, and environment-aware output. See exactly where your logs come from.

[![npm version](https://img.shields.io/npm/v/loggerect.svg)](https://www.npmjs.com/package/loggerect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🎯 **Accurate Source Tracking** - See exact file:line in browser console (via build plugins)
- 🎨 **Beautiful Console Output** - Styled badges, timestamps, and structured formatting
- ⚛️ **React-First Design** - Hooks, HOCs, and decorators for every use case
- 🔧 **Highly Configurable** - Customize everything from log levels to badge styles
- 🌍 **Environment-Aware** - Different behavior for development vs production
- 📦 **Zero Dependencies** - Lightweight and fast
- 🖥️ **SSR Compatible** - Works with Next.js, Remix, and other SSR frameworks
- 🔌 **Universal Plugin Support** - Works with Vite, Webpack, Turbopack, Rollup, and esbuild

## 📦 Installation

```bash
npm install loggerect
```

## 🚀 Quick Start

### Basic Usage

```tsx
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

### Core Logger

```tsx
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

  // Custom Styles
  styles: {
    trace:
      "background: rgba(107, 114, 128, 0.2); color: #9CA3AF; padding: 2px 8px; border-radius: 4px;",
    debug:
      "background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 8px; border-radius: 4px;",
    info: "background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 8px; border-radius: 4px;",
    warn: "background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 4px;",
    error:
      "background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 4px;",
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
// Full library (React + Core)
import { logger, useLogger, withLogger, configure } from "loggerect";

// Core only (no React dependency) - for SSR/Node.js
import { logger, configure } from "loggerect/core";

// React-specific features
import { withLogger, withLoggerRef } from "loggerect/react";

// Hooks only
import { useLogger, useLifecycleLogger, useStateLogger } from "loggerect/hooks";
```

## 🌐 SSR Support

loggerect is fully SSR-compatible. It automatically detects server vs client environments:

```tsx
// Works in Next.js, Remix, etc.
import { useLogger, useLifecycleLogger } from "loggerect";

export default function Page() {
  const log = useLogger("Page");
  useLifecycleLogger("Page"); // Only logs on client

  // Server-side logs work too
  log.info("Rendering page");

  return <div>Hello World</div>;
}
```

## 📋 Console Output Examples

### Pretty Format (Development)

```
[4:25:51 AM] ℹ️ INFO | Navbar.useLifecycleLogger.useEffect() → 🚀 Mounted @ src/components/Navbar.tsx:9
[4:25:51 AM] 🐛 DEBUG | Navbar.Navbar.useEffect() → Scroll listener attached @ src/components/Navbar.tsx:8
[4:25:51 AM] 🐛 DEBUG | 📊 [Navbar].Navbar.useEffect() Data: @ src/components/Navbar.tsx:8
                        { scrollY: 0 }
[4:25:52 AM] ⚠️ WARN | DataService.fetchData() → Rate limit approaching @ src/services/DataService.ts:45
```

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
