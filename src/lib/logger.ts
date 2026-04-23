/**
 * Simple logger utility for the application.
 * Wraps console methods for consistent logging and future extensibility.
 */

export const logger = {
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.debug("[DEBUG]", ...args);
    }
  },
  info: (...args: unknown[]) => console.info("[INFO]", ...args),
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
};

export default logger;
