import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRateLimiter } from "./rate-limiter";

describe("createRateLimiter", () => {
  it("allows requests under the limit", () => {
    const limiter = createRateLimiter({
      maxRequests: 3,
      windowMs: 60_000,
    });

    const r1 = limiter.check("ip-1");
    const r2 = limiter.check("ip-1");
    const r3 = limiter.check("ip-1");

    expect(r1).toEqual({ allowed: true, remaining: 2 });
    expect(r2).toEqual({ allowed: true, remaining: 1 });
    expect(r3).toEqual({ allowed: true, remaining: 0 });
  });

  it("blocks requests over the limit", () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 60_000,
    });

    limiter.check("ip-1");
    limiter.check("ip-1");
    const r3 = limiter.check("ip-1");

    expect(r3.allowed).toBe(false);
    if (!r3.allowed) {
      expect(r3.retryAfterMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("tracks different keys independently", () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
    });

    const r1 = limiter.check("ip-1");
    const r2 = limiter.check("ip-2");

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });

  it("allows requests after window expires", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 1000,
    });

    limiter.check("ip-1");
    const blocked = limiter.check("ip-1");
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    const allowed = limiter.check("ip-1");
    expect(allowed.allowed).toBe(true);

    vi.useRealTimers();
  });

  it("reset clears all entries", () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
    });

    limiter.check("ip-1");
    const blocked = limiter.check("ip-1");
    expect(blocked.allowed).toBe(false);

    limiter.reset();

    const allowed = limiter.check("ip-1");
    expect(allowed.allowed).toBe(true);
  });

  it("returns retryAfterMs of 0 or greater when blocked", () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 5000,
    });

    limiter.check("ip-1");
    const result = limiter.check("ip-1");

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(5000);
    }
  });
});
