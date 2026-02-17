import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRatingCache } from "./rating-cache";
import type { ProviderRatingsWire } from "./types";

function makeCacheData(overrides: Partial<ProviderRatingsWire> = {}): ProviderRatingsWire {
  return {
    provider_address: "0xAAA",
    average_rating: 4.5,
    rating_count: 10,
    rating_distribution: { 1: 0, 2: 0, 3: 1, 4: 4, 5: 5 },
    ratings: [],
    total: 10,
    page: 1,
    limit: 10,
    ...overrides,
  };
}

describe("createRatingCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for cache miss", () => {
    const cache = createRatingCache();
    expect(cache.get("0xAAA", "newest", 1, 10)).toBeNull();
  });

  it("returns cached data on hit", () => {
    const cache = createRatingCache();
    const data = makeCacheData();
    cache.set("0xAAA", "newest", 1, 10, data);
    expect(cache.get("0xAAA", "newest", 1, 10)).toEqual(data);
  });

  it("is case-insensitive for provider address", () => {
    const cache = createRatingCache();
    const data = makeCacheData();
    cache.set("0xAAA", "newest", 1, 10, data);
    expect(cache.get("0xaaa", "newest", 1, 10)).toEqual(data);
  });

  it("returns null after TTL expires", () => {
    const cache = createRatingCache(1000);
    const data = makeCacheData();
    cache.set("0xAAA", "newest", 1, 10, data);

    vi.advanceTimersByTime(1001);
    expect(cache.get("0xAAA", "newest", 1, 10)).toBeNull();
  });

  it("returns data before TTL expires", () => {
    const cache = createRatingCache(1000);
    const data = makeCacheData();
    cache.set("0xAAA", "newest", 1, 10, data);

    vi.advanceTimersByTime(999);
    expect(cache.get("0xAAA", "newest", 1, 10)).toEqual(data);
  });

  it("invalidates all entries for a provider", () => {
    const cache = createRatingCache();
    const data1 = makeCacheData({ page: 1 });
    const data2 = makeCacheData({ page: 2 });
    const dataOther = makeCacheData({
      provider_address: "0xBBB",
    });

    cache.set("0xAAA", "newest", 1, 10, data1);
    cache.set("0xAAA", "newest", 2, 10, data2);
    cache.set("0xBBB", "newest", 1, 10, dataOther);

    cache.invalidate("0xAAA");

    expect(cache.get("0xAAA", "newest", 1, 10)).toBeNull();
    expect(cache.get("0xAAA", "newest", 2, 10)).toBeNull();
    expect(cache.get("0xBBB", "newest", 1, 10)).toEqual(dataOther);
  });

  it("clear removes all entries", () => {
    const cache = createRatingCache();
    cache.set("0xAAA", "newest", 1, 10, makeCacheData());
    cache.set("0xBBB", "newest", 1, 10, makeCacheData());

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it("differentiates by sort, page, and limit", () => {
    const cache = createRatingCache();
    const data1 = makeCacheData({ average_rating: 4.0 });
    const data2 = makeCacheData({ average_rating: 3.0 });

    cache.set("0xAAA", "newest", 1, 10, data1);
    cache.set("0xAAA", "highest", 1, 10, data2);

    expect(cache.get("0xAAA", "newest", 1, 10)?.average_rating).toBe(4.0);
    expect(cache.get("0xAAA", "highest", 1, 10)?.average_rating).toBe(3.0);
  });
});
