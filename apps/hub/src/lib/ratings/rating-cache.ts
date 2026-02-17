import type { ProviderRatingsWire } from "./types";

/** Cache entry with expiration timestamp */
interface CacheEntry {
  readonly data: ProviderRatingsWire;
  readonly expiresAt: number;
}

/** Default cache TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Simple in-memory cache for aggregated provider ratings.
 * Thread-safe for single-process Node.js.
 */
export function createRatingCache(ttlMs: number = DEFAULT_TTL_MS) {
  const cache = new Map<string, CacheEntry>();

  function buildKey(providerAddress: string, sort: string, page: number, limit: number): string {
    return `${providerAddress.toLowerCase()}:${sort}:${page}:${limit}`;
  }

  function get(
    providerAddress: string,
    sort: string,
    page: number,
    limit: number,
  ): ProviderRatingsWire | null {
    const key = buildKey(providerAddress, sort, page, limit);
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  function set(
    providerAddress: string,
    sort: string,
    page: number,
    limit: number,
    data: ProviderRatingsWire,
  ): void {
    const key = buildKey(providerAddress, sort, page, limit);
    cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /** Invalidate all entries for a provider (e.g., after new rating) */
  function invalidate(providerAddress: string): void {
    const prefix = providerAddress.toLowerCase();
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  /** Clear the entire cache */
  function clear(): void {
    cache.clear();
  }

  /** Current number of entries (for testing) */
  function size(): number {
    return cache.size;
  }

  return { get, set, invalidate, clear, size };
}

export type RatingCache = ReturnType<typeof createRatingCache>;
