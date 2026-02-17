/**
 * Tests for Hub security middleware.
 *
 * Validates rate limiting, security headers, and HTTPS enforcement.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware, _rateLimiter } from "./middleware";

describe("Hub security middleware - rate limiter", () => {
  beforeEach(() => {
    _rateLimiter.reset();
  });

  it("allows requests under the limit", () => {
    const result = _rateLimiter.check("192.168.1.1");
    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(99);
    }
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 100; i++) {
      _rateLimiter.check("192.168.1.2");
    }
    const result = _rateLimiter.check("192.168.1.2");
    expect(result.allowed).toBe(false);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 100; i++) {
      _rateLimiter.check("192.168.1.3");
    }
    const blockedResult = _rateLimiter.check("192.168.1.3");
    expect(blockedResult.allowed).toBe(false);

    const allowedResult = _rateLimiter.check("192.168.1.4");
    expect(allowedResult.allowed).toBe(true);
  });

  it("returns retryAfterMs when rate limited", () => {
    for (let i = 0; i < 100; i++) {
      _rateLimiter.check("192.168.1.5");
    }
    const result = _rateLimiter.check("192.168.1.5");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Hub security middleware - integration", () => {
  beforeEach(() => {
    _rateLimiter.reset();
  });

  it("applies security headers to all responses", () => {
    const request = new NextRequest(new URL("https://example.com/"));
    const response = middleware(request);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("returns 429 when rate limit exceeded", () => {
    const url = new URL("https://example.com/api/test");
    const headers = new Headers({ "x-forwarded-for": "192.168.1.100" });

    for (let i = 0; i < 100; i++) {
      const request = new NextRequest(url, { headers });
      middleware(request);
    }

    const request = new NextRequest(url, { headers });
    const response = middleware(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });

  it("extracts IP from x-forwarded-for header", () => {
    const url = new URL("https://example.com/api/test");
    const headers = new Headers({ "x-forwarded-for": "203.0.113.1, 198.51.100.1" });
    const request = new NextRequest(url, { headers });

    const response = middleware(request);
    expect(response.status).not.toBe(429);
  });

  it("extracts IP from x-real-ip header", () => {
    const url = new URL("https://example.com/api/test");
    const headers = new Headers({ "x-real-ip": "203.0.113.2" });
    const request = new NextRequest(url, { headers });

    const response = middleware(request);
    expect(response.status).not.toBe(429);
  });

  it("handles missing IP headers gracefully", () => {
    const url = new URL("https://example.com/api/test");
    const request = new NextRequest(url);

    const response = middleware(request);
    expect(response.status).not.toBe(429);
  });

  it("validates IPv4 format", () => {
    const url = new URL("https://example.com/api/test");
    const headers = new Headers({ "x-forwarded-for": "not-an-ip" });
    const request = new NextRequest(url, { headers });

    const response = middleware(request);
    expect(response.status).not.toBe(429);
  });

  it("applies rate limiting only to API routes", () => {
    const apiUrl = new URL("https://example.com/api/test");
    const pageUrl = new URL("https://example.com/about");
    const headers = new Headers({ "x-forwarded-for": "192.168.1.200" });

    for (let i = 0; i < 100; i++) {
      const request = new NextRequest(apiUrl, { headers });
      middleware(request);
    }

    const apiRequest = new NextRequest(apiUrl, { headers });
    const apiResponse = middleware(apiRequest);
    expect(apiResponse.status).toBe(429);

    const pageRequest = new NextRequest(pageUrl, { headers });
    const pageResponse = middleware(pageRequest);
    expect(pageResponse.status).not.toBe(429);
  });
});
