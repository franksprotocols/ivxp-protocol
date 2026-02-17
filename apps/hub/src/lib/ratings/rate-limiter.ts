/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Tracks request timestamps per key (typically client IP).
 * Not suitable for multi-process deployments -- use Redis-backed
 * rate limiting in production.
 */

interface RateLimitEntry {
  readonly timestamps: readonly number[];
}

/** Configuration for a rate limiter instance */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  readonly maxRequests: number;
  /** Window size in milliseconds */
  readonly windowMs: number;
}

/**
 * Create a rate limiter with the given configuration.
 * Returns a function that checks whether a key is rate-limited.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>();

  /** Evict expired entries periodically to prevent memory leaks */
  const CLEANUP_INTERVAL_MS = 60_000;
  let lastCleanup = Date.now();

  function cleanup(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;

    for (const [key, entry] of store.entries()) {
      const cutoff = now - config.windowMs;
      const active = entry.timestamps.filter((t) => t > cutoff);
      if (active.length === 0) {
        store.delete(key);
      } else {
        store.set(key, { timestamps: active });
      }
    }
  }

  /**
   * Check if the given key is allowed to make a request.
   *
   * @returns { allowed: true, remaining } if under limit,
   *          { allowed: false, retryAfterMs } if rate-limited
   */
  function check(key: string): RateLimitResult {
    const now = Date.now();
    cleanup(now);

    const cutoff = now - config.windowMs;
    const existing = store.get(key);
    const activeTimestamps = existing
      ? existing.timestamps.filter((t) => t > cutoff)
      : [];

    if (activeTimestamps.length >= config.maxRequests) {
      const oldestInWindow = activeTimestamps[0];
      const retryAfterMs = oldestInWindow + config.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }

    store.set(key, { timestamps: [...activeTimestamps, now] });
    return { allowed: true, remaining: config.maxRequests - activeTimestamps.length - 1 };
  }

  /** Reset the store (useful for testing) */
  function reset(): void {
    store.clear();
  }

  return { check, reset };
}

export type RateLimitResult =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterMs: number };
