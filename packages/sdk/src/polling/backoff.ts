/**
 * Polling with exponential backoff and jitter.
 *
 * Provides a generic `pollWithBackoff` function that repeatedly calls an
 * async function until it returns a non-null value, applying exponential
 * backoff between attempts with configurable jitter to prevent thundering
 * herd effects.
 *
 * Also provides a convenience `pollOrderStatus` wrapper for the common
 * pattern of polling until an order reaches a target status.
 */

import { IVXPError } from "../errors/base.js";
import { MaxPollAttemptsError } from "../errors/specific.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default initial delay between poll attempts in milliseconds.
 *
 * 1 second balances responsiveness for typical API polling scenarios
 * (order status, transaction confirmation) against unnecessary load.
 * Matches common cloud-provider SDK defaults (AWS, GCP).
 */
const DEFAULT_INITIAL_DELAY = 1_000;

/**
 * Default maximum delay cap in milliseconds.
 *
 * 30 seconds prevents individual waits from becoming excessively long
 * while still allowing the total polling window to reach ~10 minutes
 * with the default 20 attempts.
 */
const DEFAULT_MAX_DELAY = 30_000;

/** Default jitter factor (±20%). */
const DEFAULT_JITTER = 0.2;

/** Default maximum number of poll attempts. */
const DEFAULT_MAX_ATTEMPTS = 20;

/** Minimum allowed delay in milliseconds after jitter clamping. */
const MIN_DELAY_MS = 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration options for `pollWithBackoff`.
 *
 * All fields are optional. Sensible defaults are applied when omitted.
 */
export interface PollOptions {
  /** Initial delay in milliseconds (default: 1000). Must be > 0. */
  readonly initialDelay?: number;
  /** Maximum delay in milliseconds (default: 30000). Must be > 0. */
  readonly maxDelay?: number;
  /** Jitter factor as a fraction of delay (default: 0.2 = ±20%). Must be in [0, 1]. */
  readonly jitter?: number;
  /** Maximum poll attempts before error (default: 20). Must be > 0. */
  readonly maxAttempts?: number;
  /** Optional abort signal for cancellation. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate poll options and throw IVXPError for invalid values.
 *
 * Called once at the start of `pollWithBackoff` to fail fast with
 * clear error messages rather than silently misbehaving.
 */
function validateOptions(
  initialDelay: number,
  maxDelay: number,
  maxAttempts: number,
  jitter: number,
): void {
  if (initialDelay <= 0) {
    throw new IVXPError(
      `initialDelay must be greater than 0, got ${initialDelay}`,
      "INVALID_POLL_OPTIONS",
    );
  }
  if (maxDelay <= 0) {
    throw new IVXPError(
      `maxDelay must be greater than 0, got ${maxDelay}`,
      "INVALID_POLL_OPTIONS",
    );
  }
  if (maxAttempts <= 0) {
    throw new IVXPError(
      `maxAttempts must be greater than 0, got ${maxAttempts}`,
      "INVALID_POLL_OPTIONS",
    );
  }
  if (jitter < 0 || jitter > 1) {
    throw new IVXPError(
      `jitter must be between 0 and 1 (inclusive), got ${jitter}`,
      "INVALID_POLL_OPTIONS",
    );
  }
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------

/**
 * Sleep for the specified number of milliseconds.
 *
 * Supports cancellation via AbortSignal. When the signal fires during
 * the sleep, the timeout is cleared and the promise rejects with an error.
 *
 * Uses `{ once: true }` for the abort listener to let the runtime
 * automatically remove the listener after it fires, which is simpler
 * than the manual add/remove pattern (as used in HttpClient) while
 * achieving the same goal. Manual cleanup on normal completion is
 * still performed to prevent the listener from lingering when sleep
 * finishes before abort.
 *
 * @param ms - Duration to sleep in milliseconds
 * @param signal - Optional abort signal for cancellation
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal === undefined) {
      setTimeout(resolve, ms);
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new Error("Sleep aborted"));
    };

    const onTimeout = (): void => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    };

    const timeout = setTimeout(onTimeout, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// Pure delay computation
// ---------------------------------------------------------------------------

/**
 * Compute the base delay for a given attempt purely from configuration.
 *
 * Uses the formula `min(initialDelay * 2^attempt, maxDelay)` so that
 * no mutable state is required across loop iterations.
 *
 * @param attempt - Zero-based attempt index
 * @param initialDelay - Starting delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @returns The base delay (before jitter) for the given attempt
 */
function computeBaseDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
): number {
  return Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
}

/**
 * Apply jitter to a base delay and clamp to a non-negative value.
 *
 * Produces a uniformly distributed delay in
 * `[baseDelay * (1 - jitter), baseDelay * (1 + jitter)]`,
 * clamped to a minimum of 0 to guard against negative values
 * when jitter > 0.5 (which should not happen after validation,
 * but defence-in-depth is preferred).
 *
 * @param baseDelay - The pre-jitter delay in milliseconds
 * @param jitter - Jitter factor in [0, 1]
 * @returns The jittered delay, never less than 0
 */
function applyJitter(baseDelay: number, jitter: number): number {
  const jitterFactor = 1 + (Math.random() * 2 - 1) * jitter;
  return Math.max(baseDelay * jitterFactor, MIN_DELAY_MS);
}

// ---------------------------------------------------------------------------
// pollWithBackoff
// ---------------------------------------------------------------------------

/**
 * Poll a function with exponential backoff and jitter.
 *
 * Repeatedly invokes `fn` until it returns a non-null value. Between
 * attempts, delays exponentially (doubling each time) with optional
 * jitter to prevent thundering herd effects. The delay is capped at
 * `maxDelay`.
 *
 * If `fn` throws an error, it is propagated immediately without retry.
 * Only `null` return values trigger retries.
 *
 * @typeParam T - The expected result type when polling succeeds
 * @param fn - Async function that returns T on success, or null to continue polling
 * @param options - Polling configuration
 * @returns The first non-null value returned by `fn`
 * @throws MaxPollAttemptsError if max attempts are exceeded
 * @throws IVXPError if options are invalid
 * @throws Error if the abort signal fires
 */
export async function pollWithBackoff<T>(
  fn: () => Promise<T | null>,
  options: PollOptions = {},
): Promise<T> {
  const {
    initialDelay = DEFAULT_INITIAL_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    jitter = DEFAULT_JITTER,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    signal,
  } = options;

  validateOptions(initialDelay, maxDelay, maxAttempts, jitter);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check for abort signal before each attempt
    if (signal?.aborted) {
      throw new Error("Polling aborted");
    }

    // Invoke the polled function
    const result = await fn();
    if (result !== null) {
      return result;
    }

    // Only sleep between attempts, not after the last failed attempt
    if (attempt < maxAttempts - 1) {
      const baseDelay = computeBaseDelay(attempt, initialDelay, maxDelay);
      const jitteredDelay = applyJitter(baseDelay, jitter);

      await sleep(jitteredDelay, signal);
    }
  }

  throw new MaxPollAttemptsError(maxAttempts);
}

// ---------------------------------------------------------------------------
// pollOrderStatus
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper for polling an order's status.
 *
 * Polls `getStatus` until it returns an object whose `status` field
 * is one of the `targetStatuses`. If `getStatus` returns `null` or
 * a status not in the target list, polling continues.
 *
 * Uses a generic `TStatus extends string` constraint to preserve
 * the caller's literal string types through the return value.
 *
 * @typeParam TStatus - String literal union for status values
 * @param getStatus - Async function returning the current order state, or null
 * @param targetStatuses - Array of status values that indicate completion
 * @param options - Polling configuration forwarded to `pollWithBackoff`
 * @returns The order state when a target status is reached
 * @throws MaxPollAttemptsError if max attempts are exceeded
 */
export async function pollOrderStatus<TStatus extends string>(
  getStatus: () => Promise<{ readonly status: TStatus } | null>,
  targetStatuses: readonly TStatus[],
  options?: PollOptions,
): Promise<{ readonly status: TStatus }> {
  return pollWithBackoff(async () => {
    const result = await getStatus();
    if (result !== null && targetStatuses.includes(result.status)) {
      return result;
    }
    return null;
  }, options);
}
