/**
 * Retry with Exponential Backoff
 * Provides resilient API calls with configurable retry logic
 */

import { logWarn, logError, logDebug } from "./loggerStructured.js";

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Jitter factor 0-1 to randomize delay (default: 0.1) */
  jitterFactor?: number;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  /** Operation name for logging */
  operationName?: string;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "isRetryable" | "onRetry" | "operationName">> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Calculate exponential delay with optional jitter
 */
export function exponentialDelay(
  attempt: number,
  initialDelayMs: number,
  backoffMultiplier: number,
  maxDelayMs: number,
  jitterFactor: number,
): number {
  // Calculate base delay with exponential backoff
  const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(baseDelay, maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up")
    ) {
      return true;
    }

    // Rate limiting
    if (
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    ) {
      return true;
    }

    // Temporary server errors
    if (
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("service unavailable") ||
      message.includes("internal server error")
    ) {
      return true;
    }

    // Transient errors
    if (name.includes("transient") || message.includes("temporarily")) {
      return true;
    }
  }

  // Check for HTTP status codes on response objects
  if (typeof error === "object" && error !== null) {
    const statusCode =
      (error as Record<string, unknown>)["statusCode"] ??
      (error as Record<string, unknown>)["status"];
    if (typeof statusCode === "number") {
      // Retry on 429, 502, 503, 504
      return [429, 502, 503, 504].includes(statusCode);
    }
  }

  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    backoffMultiplier = DEFAULT_OPTIONS.backoffMultiplier,
    jitterFactor = DEFAULT_OPTIONS.jitterFactor,
    isRetryable = defaultIsRetryable,
    onRetry,
    operationName = "operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      logDebug(`${operationName}: attempt ${attempt}/${maxRetries + 1}`);
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we've exhausted retries
      if (attempt > maxRetries) {
        logError(`${operationName}: all ${maxRetries} retries exhausted`, {
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        logError(`${operationName}: non-retryable error`, {
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }

      // Calculate delay
      const delayMs = exponentialDelay(
        attempt,
        initialDelayMs,
        backoffMultiplier,
        maxDelayMs,
        jitterFactor,
      );

      logWarn(`${operationName}: attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        delayMs,
      });

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, error, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for a function
 */
export function withRetry<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  options: RetryOptions = {},
): (...args: T) => Promise<R> {
  return (...args: T) => retryWithBackoff(() => fn(...args), options);
}

/**
 * Retry decorator options for specific error types
 */
export const RETRY_PRESETS = {
  /** Quick retry for transient network issues */
  quick: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
  } satisfies RetryOptions,

  /** Standard retry for API calls */
  standard: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  } satisfies RetryOptions,

  /** Aggressive retry for critical operations */
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
  } satisfies RetryOptions,

  /** Rate limit specific retry (longer delays) */
  rateLimit: {
    maxRetries: 3,
    initialDelayMs: 5000,
    maxDelayMs: 60000,
    backoffMultiplier: 3,
  } satisfies RetryOptions,
} as const;
