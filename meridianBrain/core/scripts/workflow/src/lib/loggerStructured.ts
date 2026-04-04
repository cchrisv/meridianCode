/**
 * Structured Logger
 * JSON-based logging for consistent output
 */

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: LogContext;
}

/**
 * Log context for tracking operations
 */
export interface LogContext {
  operation?: string;
  workItemId?: number;
  sfOrg?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  jsonOutput: boolean;
  includeTimestamp: boolean;
  context?: LogContext;
  /** When true, suppress all log output (useful for CLI --json mode) */
  silent: boolean;
  /** When true, output to stderr instead of stdout */
  useStderr: boolean;
}

/**
 * Log level priority (higher = more important)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Default logger configuration
 */
let config: LoggerConfig = {
  minLevel: "info",
  jsonOutput: false,
  includeTimestamp: true,
  silent: false,
  useStderr: false,
};

/**
 * Configure the logger (minLevel, jsonOutput, silent, etc.).
 *
 * @param newConfig - Partial config to merge with current
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current logger configuration (read-only copy).
 *
 * @returns Current LoggerConfig
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...config };
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  if (config.silent) return false;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.minLevel];
}

/**
 * Output a log message to the appropriate stream
 */
function output(level: LogLevel, message: string): void {
  if (config.useStderr) {
    console.error(message);
  } else {
    switch (level) {
      case "debug":
        console.debug(message);
        break;
      case "info":
        console.info(message);
        break;
      case "warn":
        console.warn(message);
        break;
      case "error":
        console.error(message);
        break;
    }
  }
}

/**
 * Format a log entry
 */
function formatEntry(entry: LogEntry): string {
  if (config.jsonOutput) {
    return JSON.stringify(entry);
  }

  const parts: string[] = [];

  if (config.includeTimestamp) {
    parts.push(`[${entry.timestamp}]`);
  }

  parts.push(`[${entry.level.toUpperCase()}]`);
  parts.push(entry.message);

  if (entry.data !== undefined) {
    if (typeof entry.data === "object") {
      parts.push(JSON.stringify(entry.data, null, 2));
    } else {
      parts.push(String(entry.data));
    }
  }

  return parts.join(" ");
}

/**
 * Create a log entry
 */
function createEntry(
  level: LogLevel,
  message: string,
  data?: unknown,
  context?: LogContext,
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
    context: context ?? config.context,
  };
}

/**
 * Log a debug message (only if minLevel allows).
 *
 * @param message - Log message
 * @param data - Optional structured data
 * @param context - Optional context overrides
 */
export function logDebug(message: string, data?: unknown, context?: LogContext): void {
  if (!shouldLog("debug")) return;
  const entry = createEntry("debug", message, data, context);
  output("debug", formatEntry(entry));
}

/**
 * Log an info message.
 *
 * @param message - Log message
 * @param data - Optional structured data
 * @param context - Optional context overrides
 */
export function logInfo(message: string, data?: unknown, context?: LogContext): void {
  if (!shouldLog("info")) return;
  const entry = createEntry("info", message, data, context);
  output("info", formatEntry(entry));
}

/**
 * Log a warning message
 */
export function logWarn(message: string, data?: unknown, context?: LogContext): void {
  if (!shouldLog("warn")) return;
  const entry = createEntry("warn", message, data, context);
  output("warn", formatEntry(entry));
}

/**
 * Log an error message.
 *
 * @param message - Log message
 * @param data - Optional structured data
 * @param context - Optional context overrides
 */
export function logError(message: string, data?: unknown, context?: LogContext): void {
  if (!shouldLog("error")) return;
  const entry = createEntry("error", message, data, context);
  output("error", formatEntry(entry));
}

/**
 * Log an event (always info level, but with structured event data)
 */
export function logEvent(
  event: string,
  data?: Record<string, unknown>,
  context?: LogContext,
): void {
  if (!shouldLog("info")) return;
  const entry = createEntry("info", `[EVENT] ${event}`, data, context);
  output("info", formatEntry(entry));
}

/**
 * Create a child logger that includes additional context on every log.
 *
 * @param additionalContext - Context merged into every log entry
 * @returns ChildLogger with same methods as global logger
 */
export function createChildLogger(additionalContext: LogContext): ChildLogger {
  return {
    debug: (message: string, data?: unknown) => logDebug(message, data, additionalContext),
    info: (message: string, data?: unknown) => logInfo(message, data, additionalContext),
    warn: (message: string, data?: unknown) => logWarn(message, data, additionalContext),
    error: (message: string, data?: unknown) => logError(message, data, additionalContext),
    event: (event: string, data?: Record<string, unknown>) =>
      logEvent(event, data, additionalContext),
  };
}

/**
 * Child logger interface
 */
export interface ChildLogger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  event: (event: string, data?: Record<string, unknown>) => void;
}

/**
 * Create a timer for measuring operation duration (elapsed ms/s, log on completion).
 *
 * @returns Timer with elapsed(), elapsedSeconds(), and log(operation, level?)
 */
export function createTimer(): Timer {
  const startTime = Date.now();
  return {
    elapsed: () => Date.now() - startTime,
    elapsedSeconds: () => (Date.now() - startTime) / 1000,
    log: (operation: string, level: LogLevel = "info") => {
      const duration = Date.now() - startTime;
      const message = `${operation} completed in ${duration}ms`;
      const context: LogContext = { operation, duration };

      switch (level) {
        case "debug":
          logDebug(message, undefined, context);
          break;
        case "info":
          logInfo(message, undefined, context);
          break;
        case "warn":
          logWarn(message, undefined, context);
          break;
        case "error":
          logError(message, undefined, context);
          break;
      }
    },
  };
}

/**
 * Timer interface
 */
export interface Timer {
  elapsed: () => number;
  elapsedSeconds: () => number;
  log: (operation: string, level?: LogLevel) => void;
}
