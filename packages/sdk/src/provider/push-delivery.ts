/**
 * Push delivery service for the IVXP Provider.
 *
 * Implements proactive POST delivery to client callback endpoints with:
 * - Exponential backoff retry (configurable max retries, default 3)
 * - Per-attempt timeout via AbortSignal
 * - 20% jitter on retry delays to prevent thundering herd
 * - Fallback to Store & Forward when push fails
 *
 * All functions are pure or return new objects (no mutation).
 *
 * @see Story 3.12 - FR-P8: Push Delivery
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default maximum number of push delivery attempts. */
const DEFAULT_MAX_RETRIES = 3;

/** Default initial delay between retries in milliseconds. */
const DEFAULT_INITIAL_DELAY_MS = 1_000;

/** Default per-attempt timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Jitter factor (plus/minus 20%). */
const JITTER_FACTOR = 0.2;

/** Allowed URL protocols for push delivery endpoints. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for a push delivery attempt.
 */
export interface PushDeliveryOptions {
  /** Client's callback URL to POST the deliverable to. */
  readonly deliveryEndpoint: string;

  /** Maximum number of delivery attempts (default: 3). Must be >= 1. */
  readonly maxRetries?: number;

  /** Initial delay between retries in milliseconds (default: 1000). */
  readonly initialDelayMs?: number;

  /** Per-attempt timeout in milliseconds (default: 10000). */
  readonly timeoutMs?: number;

  /**
   * Optional callback invoked after each failed delivery attempt.
   * Receives the attempt number (1-based), max retries, and error message.
   * Use this for logging, metrics, or observability instead of console output.
   */
  readonly onRetry?: (attempt: number, maxRetries: number, error: string) => void;
}

/**
 * Wire-format payload sent to the client's delivery endpoint.
 *
 * Matches the IVXP/1.0 push delivery specification.
 */
export interface PushDeliveryPayload {
  readonly order_id: string;
  readonly status: "delivered";
  readonly deliverable: {
    readonly content: string;
    readonly content_hash: string;
    readonly format: string;
  };
  readonly delivered_at: string;
}

/**
 * Result of a push delivery attempt.
 *
 * Always returned (never throws) to allow the caller to decide
 * how to handle success vs failure (e.g. update order status).
 */
export interface PushDeliveryResult {
  /** Whether the delivery was successfully acknowledged. */
  readonly success: boolean;

  /** Number of attempts made (1-based). */
  readonly attempts: number;

  /** Error message from the last failed attempt (undefined on success). */
  readonly error?: string;
}

/**
 * Parameters for building a push delivery payload.
 */
export interface BuildPayloadParams {
  readonly orderId: string;
  readonly content: string;
  readonly contentHash: string;
  readonly format: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether push delivery should be attempted.
 *
 * Returns false when the delivery endpoint is undefined, empty,
 * malformed, or uses a non-HTTP(S) protocol. Only http: and https:
 * protocols are allowed to prevent SSRF attacks via protocols like
 * file:, ftp:, or data:.
 *
 * @param deliveryEndpoint - The client's callback URL (may be undefined)
 * @returns true if push delivery should be attempted
 */
export function shouldAttemptPush(deliveryEndpoint: string | undefined): boolean {
  if (deliveryEndpoint === undefined || deliveryEndpoint.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(deliveryEndpoint);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Build a push delivery payload from order data.
 *
 * Returns a new immutable payload object each time.
 *
 * @param params - Order data for the payload
 * @returns A fresh PushDeliveryPayload
 */
export function buildDeliveryPayload(params: BuildPayloadParams): PushDeliveryPayload {
  return {
    order_id: params.orderId,
    status: "delivered",
    deliverable: {
      content: params.content,
      content_hash: params.contentHash,
      format: params.format,
    },
    delivered_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the delay for a retry attempt with exponential backoff and jitter.
 *
 * Uses the formula: initialDelay * 2^attempt * (1 +/- 20% jitter)
 *
 * @param attempt - Zero-based retry attempt index
 * @param initialDelayMs - Base delay in milliseconds
 * @returns Jittered delay in milliseconds
 */
function computeRetryDelay(attempt: number, initialDelayMs: number): number {
  const baseDelay = initialDelayMs * Math.pow(2, attempt);
  const jitter = 1 + (Math.random() * 2 * JITTER_FACTOR - JITTER_FACTOR);
  return Math.max(baseDelay * jitter, 0);
}

/**
 * Sleep for the specified number of milliseconds.
 *
 * @param ms - Duration to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// pushDelivery
// ---------------------------------------------------------------------------

/**
 * Attempt to push a deliverable to the client's callback endpoint.
 *
 * Sends a POST request with the delivery payload. On failure, retries
 * with exponential backoff (1s, 2s, 4s by default) and 20% jitter.
 *
 * **Never throws.** Always returns a PushDeliveryResult indicating
 * success or failure. The caller is responsible for updating order
 * status based on the result.
 *
 * @param payload - The delivery payload to send
 * @param options - Delivery configuration (endpoint, retries, timeouts)
 * @returns Result with success status, attempt count, and optional error
 */
export async function pushDelivery(
  payload: PushDeliveryPayload,
  options: PushDeliveryOptions,
): Promise<PushDeliveryResult> {
  const {
    deliveryEndpoint,
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onRetry,
  } = options;

  // Validate maxRetries >= 1
  if (maxRetries < 1) {
    return {
      success: false,
      attempts: 0,
      error: "maxRetries must be >= 1",
    };
  }

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(deliveryEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        return { success: true, attempts: attempt };
      }

      lastError = `Push delivery failed: HTTP ${response.status}`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : "Unknown push delivery error";
    }

    // Notify caller of failed attempt via onRetry callback (AC2)
    onRetry?.(attempt, maxRetries, lastError ?? "Unknown error");

    // Apply exponential backoff with jitter between retries
    // (skip delay after the last attempt)
    if (attempt < maxRetries) {
      const delay = computeRetryDelay(attempt - 1, initialDelayMs);
      await sleep(delay);
    }
  }

  return {
    success: false,
    attempts: maxRetries,
    error: lastError,
  };
}
