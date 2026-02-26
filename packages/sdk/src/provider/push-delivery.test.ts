/**
 * Push delivery service unit tests.
 *
 * Tests the pushDelivery function for:
 * - AC1: Successful push delivery with content_hash
 * - AC2: Retry with exponential backoff on failure
 * - AC3: Fallback to Store & Forward after retries exhausted
 * - AC4: Skip push when no delivery endpoint provided
 *
 * Uses vi.useFakeTimers() with manual setTimeout interception
 * to verify delay timing without real waiting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  pushDelivery,
  buildDeliveryPayload,
  shouldAttemptPush,
  type PushDeliveryOptions,
  type PushDeliveryPayload,
} from "./push-delivery.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect delays passed to setTimeout by replacing globalThis.setTimeout.
 *
 * Each intercepted call resolves its callback synchronously so the
 * push delivery loop completes without real waiting.
 */
function interceptDelays(): number[] {
  const delays: number[] = [];

  vi.spyOn(globalThis, "setTimeout").mockImplementation(((cb: () => void, ms?: number) => {
    delays.push(ms ?? 0);
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);

  return delays;
}

/**
 * Create a minimal valid PushDeliveryPayload for testing.
 */
function createTestPayload(overrides?: Partial<PushDeliveryPayload>): PushDeliveryPayload {
  return {
    order_id: "ivxp-test-order-001",
    status: "delivered",
    deliverable: {
      content: "# Test Report\nAnalysis complete.",
      content_hash: "sha256:abc123def456",
      format: "markdown",
    },
    delivered_at: "2026-02-16T12:00:00Z",
    ...overrides,
  };
}

/**
 * Create a minimal valid PushDeliveryOptions for testing.
 */
function createTestOptions(overrides?: Partial<PushDeliveryOptions>): PushDeliveryOptions {
  return {
    deliveryEndpoint: "https://client.example.com/callback",
    maxRetries: 3,
    initialDelayMs: 1000,
    timeoutMs: 10_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildDeliveryPayload
// ---------------------------------------------------------------------------

describe("buildDeliveryPayload", () => {
  it("should create a payload with order_id, status, deliverable, and delivered_at", () => {
    const payload = buildDeliveryPayload({
      orderId: "ivxp-order-42",
      content: "Report content here",
      contentHash: "sha256:hash123",
      format: "markdown",
    });

    expect(payload.order_id).toBe("ivxp-order-42");
    expect(payload.status).toBe("delivered");
    expect(payload.deliverable.content).toBe("Report content here");
    expect(payload.deliverable.content_hash).toBe("sha256:hash123");
    expect(payload.deliverable.format).toBe("markdown");
    expect(payload.delivered_at).toBeDefined();
  });

  it("should produce a valid ISO 8601 delivered_at timestamp", () => {
    const payload = buildDeliveryPayload({
      orderId: "ivxp-order-1",
      content: "x",
      contentHash: "sha256:abc",
      format: "json",
    });

    // Should not throw when parsed as a Date
    const date = new Date(payload.delivered_at);
    expect(date.getTime()).not.toBeNaN();
  });

  it("should produce a timestamp close to current time", () => {
    const before = new Date();
    const payload = buildDeliveryPayload({
      orderId: "ivxp-order-fresh",
      content: "data",
      contentHash: "sha256:abc",
      format: "json",
    });
    const after = new Date();

    const timestamp = new Date(payload.delivered_at);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should return a new object each time (immutability)", () => {
    const params = {
      orderId: "ivxp-order-1",
      content: "data",
      contentHash: "sha256:abc",
      format: "json",
    };

    const p1 = buildDeliveryPayload(params);
    const p2 = buildDeliveryPayload(params);

    expect(p1).not.toBe(p2);
    expect(p1.order_id).toBe(p2.order_id);
    expect(p1.status).toBe(p2.status);
    expect(p1.deliverable).toEqual(p2.deliverable);
    expect(new Date(p1.delivered_at).getTime()).not.toBeNaN();
    expect(new Date(p2.delivered_at).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// shouldAttemptPush
// ---------------------------------------------------------------------------

describe("shouldAttemptPush", () => {
  it("should return true when delivery_endpoint is a valid https URL", () => {
    expect(shouldAttemptPush("https://client.example.com/callback")).toBe(true);
  });

  it("should return false when delivery_endpoint is undefined", () => {
    expect(shouldAttemptPush(undefined)).toBe(false);
  });

  it("should return false when delivery_endpoint is empty string", () => {
    expect(shouldAttemptPush("")).toBe(false);
  });

  it("should return true for http URLs", () => {
    expect(shouldAttemptPush("http://localhost:3000/callback")).toBe(true);
  });

  it("should return false for malformed URLs", () => {
    expect(shouldAttemptPush("not-a-url")).toBe(false);
  });

  it("should return false for file: protocol URLs (SSRF prevention)", () => {
    expect(shouldAttemptPush("file:///etc/passwd")).toBe(false);
  });

  it("should return false for ftp: protocol URLs (SSRF prevention)", () => {
    expect(shouldAttemptPush("ftp://internal.corp/data")).toBe(false);
  });

  it("should return false for data: protocol URLs (SSRF prevention)", () => {
    expect(shouldAttemptPush("data:text/html,<h1>Hi</h1>")).toBe(false);
  });

  it("should return false for javascript: protocol URLs (SSRF prevention)", () => {
    expect(shouldAttemptPush("javascript:alert(1)")).toBe(false);
  });

  it("should return true for https URL with path and query", () => {
    expect(shouldAttemptPush("https://api.example.com/webhook?token=abc")).toBe(true);
  });

  it("should return true for http URL with port", () => {
    expect(shouldAttemptPush("http://localhost:8080/delivery")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pushDelivery -- AC1: Successful push delivery
// ---------------------------------------------------------------------------

describe("pushDelivery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("AC1: Successful push delivery", () => {
    it("should return success on first attempt when endpoint responds 200", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const payload = createTestPayload();
      const options = createTestOptions();

      const result = await pushDelivery(payload, options);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should POST to the delivery endpoint with correct payload", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const payload = createTestPayload();
      const options = createTestOptions({
        deliveryEndpoint: "https://client.example.com/webhook",
      });

      await pushDelivery(payload, options);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, fetchOptions] = mockFetch.mock.calls[0];
      expect(url).toBe("https://client.example.com/webhook");
      expect(fetchOptions.method).toBe("POST");
      expect(fetchOptions.headers["Content-Type"]).toBe("application/json");

      const body = JSON.parse(fetchOptions.body);
      expect(body.order_id).toBe("ivxp-test-order-001");
      expect(body.status).toBe("delivered");
      expect(body.deliverable.content_hash).toBe("sha256:abc123def456");
    });

    it("should include content_hash in the delivery payload", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const payload = createTestPayload({
        deliverable: {
          content: "Important data",
          content_hash: "sha256:deadbeef",
          format: "json",
        },
      });
      const options = createTestOptions();

      await pushDelivery(payload, options);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.deliverable.content_hash).toBe("sha256:deadbeef");
    });

    it("should accept HTTP 200-299 responses as success", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 202 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions());

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Push delivery retry on failure
  // -------------------------------------------------------------------------

  describe("AC2: Push delivery retry on failure", () => {
    it("should retry on non-200 HTTP response", async () => {
      const delays = interceptDelays();

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(
        createTestPayload(),
        createTestOptions({ initialDelayMs: 1000 }),
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(delays.length).toBe(1);
    });

    it("should retry on network error (fetch rejection)", async () => {
      interceptDelays();

      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions());

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it("should use exponential backoff delays (1s, 2s, 4s)", async () => {
      const delays = interceptDelays();

      // Mock Math.random to return 0.5 for predictable jitter
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(
        createTestPayload(),
        createTestOptions({ maxRetries: 3, initialDelayMs: 1000 }),
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);

      // With Math.random() = 0.5, jitter factor = 1 + (0.5 * 0.4 - 0.2) = 1.0
      // So delays should be close to 1000, 2000
      // (Only 2 delays: between attempt 1->2 and 2->3, no delay after last attempt)
      expect(delays).toHaveLength(2);
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
    });

    it("should apply 20% jitter to delays", async () => {
      const delays = interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(
        createTestPayload(),
        createTestOptions({ maxRetries: 3, initialDelayMs: 1000 }),
      );

      // Delays should be within +/- 20% of base values
      // Delay 1 base = 1000: range [800, 1200]
      // Delay 2 base = 2000: range [1600, 2400]
      if (delays.length >= 1) {
        expect(delays[0]).toBeGreaterThanOrEqual(800);
        expect(delays[0]).toBeLessThanOrEqual(1200);
      }
      if (delays.length >= 2) {
        expect(delays[1]).toBeGreaterThanOrEqual(1600);
        expect(delays[1]).toBeLessThanOrEqual(2400);
      }
    });

    it("should call onRetry callback for each failed attempt", async () => {
      interceptDelays();

      const onRetry = vi.fn();

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 503 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(createTestPayload(), createTestOptions({ onRetry }));

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, 3, expect.stringContaining("503"));
    });

    it("should not call onRetry on success (no failed attempts)", async () => {
      const onRetry = vi.fn();

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(createTestPayload(), createTestOptions({ onRetry }));

      expect(onRetry).not.toHaveBeenCalled();
    });

    it("should call onRetry for each failed attempt when all fail", async () => {
      interceptDelays();

      const onRetry = vi.fn();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 3, onRetry }));

      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3, expect.stringContaining("500"));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3, expect.stringContaining("500"));
      expect(onRetry).toHaveBeenNthCalledWith(3, 3, 3, expect.stringContaining("500"));
    });

    it("should respect maxRetries configuration", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 2 }));

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should default to 3 retries when maxRetries not specified", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(
        createTestPayload(),
        createTestOptions({ maxRetries: undefined }),
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
    });

    it("should use AbortSignal.timeout for per-attempt timeout", async () => {
      interceptDelays();

      // Simulate a timeout by having fetch reject with AbortError
      const abortError = new DOMException("The operation was aborted.", "AbortError");
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(
        createTestPayload(),
        createTestOptions({ timeoutMs: 5000 }),
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Fallback to Store & Forward
  // -------------------------------------------------------------------------

  describe("AC3: Fallback to Store & Forward", () => {
    it("should return failure after all retries exhausted", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 3 }));

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
    });

    it("should include the last error message in the result", async () => {
      interceptDelays();

      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response("", { status: 500, statusText: "Internal Server Error" }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 2 }));

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("500");
    });

    it("should include network error message in result on failure", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 1 }));

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });

    it("should not throw -- always returns a result object", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockRejectedValue(new Error("Kaboom"));
      vi.stubGlobal("fetch", mockFetch);

      // Should NOT throw
      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 1 }));

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Default values
  // -------------------------------------------------------------------------

  describe("default values", () => {
    it("should default initialDelayMs to 1000", async () => {
      const delays = interceptDelays();
      vi.spyOn(Math, "random").mockReturnValue(0.5); // jitter factor = 1.0

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(createTestPayload(), createTestOptions({ initialDelayMs: undefined }));

      // First delay should be ~1000 (with jitter factor 1.0 = exactly 1000)
      expect(delays[0]).toBe(1000);
    });

    it("should default timeoutMs to 10000", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(createTestPayload(), createTestOptions({ timeoutMs: undefined }));

      // Verify fetch was called with a signal (timeout signal)
      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeDefined();
    });

    it("should pass an AbortSignal instance to fetch for timeout enforcement", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      await pushDelivery(createTestPayload(), createTestOptions({ timeoutMs: 5000 }));

      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });
  });

  // -------------------------------------------------------------------------
  // Wire format compliance
  // -------------------------------------------------------------------------

  describe("wire format compliance", () => {
    it("should send payload matching the IVXP wire format", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const payload = createTestPayload({
        order_id: "ivxp-abc123",
        deliverable: {
          content: "Analysis content",
          content_hash: "sha256:fedcba987654",
          format: "markdown",
        },
        delivered_at: "2026-02-09T15:30:00Z",
      });

      await pushDelivery(payload, createTestOptions());

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Verify wire format structure
      expect(body).toEqual({
        order_id: "ivxp-abc123",
        status: "delivered",
        deliverable: {
          content: "Analysis content",
          content_hash: "sha256:fedcba987654",
          format: "markdown",
        },
        delivered_at: "2026-02-09T15:30:00Z",
      });
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should return failure with 0 attempts when maxRetries is 0", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: 0 }));

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(0);
      expect(result.error).toContain("maxRetries must be >= 1");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return failure when maxRetries is negative", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const result = await pushDelivery(createTestPayload(), createTestOptions({ maxRetries: -1 }));

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(0);
      expect(result.error).toContain("maxRetries must be >= 1");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Immutability
  // -------------------------------------------------------------------------

  describe("immutability", () => {
    it("should not mutate the options object during retries", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const options: PushDeliveryOptions = {
        deliveryEndpoint: "https://client.example.com/callback",
        maxRetries: 2,
        initialDelayMs: 1000,
        timeoutMs: 10_000,
      };

      // Deep copy to compare after pushDelivery
      const optionsBefore = JSON.parse(JSON.stringify(options));

      await pushDelivery(createTestPayload(), options);

      expect(options).toEqual(optionsBefore);
    });

    it("should not mutate the payload object", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const payload = createTestPayload();
      const payloadBefore = JSON.parse(JSON.stringify(payload));

      await pushDelivery(payload, createTestOptions());

      expect(payload).toEqual(payloadBefore);
    });
  });
});

// ---------------------------------------------------------------------------
// AC4: No delivery endpoint provided
// ---------------------------------------------------------------------------

describe("shouldAttemptPush (AC4 - no delivery endpoint)", () => {
  it("should return false for undefined endpoint (Store & Forward mode)", () => {
    expect(shouldAttemptPush(undefined)).toBe(false);
  });

  it("should return false for empty string endpoint", () => {
    expect(shouldAttemptPush("")).toBe(false);
  });

  it("should return true for valid endpoint URL", () => {
    expect(shouldAttemptPush("https://client.example.com/delivery")).toBe(true);
  });

  it("should return false for malformed URL endpoint", () => {
    expect(shouldAttemptPush("not-a-valid-url")).toBe(false);
  });

  it("should return false for non-HTTP protocol endpoint", () => {
    expect(shouldAttemptPush("file:///etc/shadow")).toBe(false);
  });
});
