/**
 * loggerect Node.js Example
 * 
 * This example shows how to use loggerect in a pure Node.js application
 * without any React dependencies.
 */

const { logger, configure } = require("loggerect");
// or with ES modules:
// import { logger, configure } from "loggerect";

// Configure logger (optional - has sensible defaults)
configure({
  level: "debug",
  timestamps: true,
  format: "pretty",
});

// Basic logging
logger.info("Server starting...");
logger.debug("Configuration loaded", { env: process.env.NODE_ENV });

// Component-scoped logging (works great for organizing logs by module/service)
const apiLogger = logger.forComponent("API").withTags("http", "rest");
const dbLogger = logger.forComponent("Database").withTags("sql", "query");

// Simulate API request
apiLogger.info("Request received", {
  method: "GET",
  path: "/api/users",
  ip: "127.0.0.1",
});

// Simulate database query
dbLogger.time("userQuery");
// ... simulate async operation
setTimeout(() => {
  dbLogger.timeEnd("userQuery"); // Logs: ⏱️ userQuery: ~1000ms
  dbLogger.debug("Query executed", { rows: 42 });
}, 1000);

// Error logging
try {
  throw new Error("Something went wrong");
} catch (error) {
  logger.error("Caught exception", {
    error: error.message,
    stack: error.stack,
    context: "user registration",
  });
}

// With metadata
const authLogger = logger
  .forComponent("Auth")
  .withTags("security", "authentication")
  .withMetadata({ version: "1.0.0" });

authLogger.info("User logged in", { userId: 123, email: "user@example.com" });

// Performance timing
logger.time("dataProcessing");
// ... do some work
setTimeout(() => {
  logger.timeEnd("dataProcessing");
}, 500);

// Lifecycle helpers (useful for service lifecycle)
logger.mount("UserService"); // 🚀 Mounted
// ... service running
setTimeout(() => {
  logger.unmount("UserService"); // 💤 Unmounted
}, 2000);

console.log("\n✅ All examples completed! Check the logs above.");

