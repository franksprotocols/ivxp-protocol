/**
 * Provider delivery handler integration tests.
 *
 * Tests the handleOrderDelivery function that orchestrates:
 * - Push delivery with retry (AC1, AC2)
 * - Fallback to Store & Forward (AC3)
 * - Skip push when no endpoint (AC4)
 * - Event emission for delivery lifecycle
 *
 * Uses mocked fetch to simulate push delivery responses.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "../core/events.js";
import {
  handleOrderDelivery,
  type DeliverableOrder,
  type DeliveryHandlerResult,
  type ProviderDeliveryEventMap,
} from "./provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Intercept setTimeout to resolve immediately for fast tests.
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
 * Create a test order with deliverable data.
 */
function createTestOrder(overrides?: Partial<DeliverableOrder>): DeliverableOrder {
  return {
    orderId: "ivxp-test-order-123",
    content: "# Analysis Report\nMarket is bullish.",
    contentHash: "sha256:abc123def456",
    format: "markdown",
    deliveryEndpoint: "https://client.example.com/callback",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// handleOrderDelivery
// ---------------------------------------------------------------------------

describe("handleOrderDelivery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AC1: Successful push delivery
  // -------------------------------------------------------------------------

  describe("AC1: Successful push delivery", () => {
    it("should return delivered status via push method on success", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const order = createTestOrder();
      const result = await handleOrderDelivery(order);

      expect(result.status).toBe("delivered");
      expect(result.method).toBe("push");
      expect(result.attempts).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it("should emit delivery.push.started event", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const events: Array<{ orderId: string; endpoint: string }> = [];
      emitter.on("delivery.push.started", (payload) => events.push(payload));

      await handleOrderDelivery(createTestOrder(), undefined, emitter);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toBe("ivxp-test-order-123");
      expect(events[0].endpoint).toBe("https://client.example.com/callback");
    });

    it("should emit delivery.push.success event on success", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const events: Array<{ orderId: string; attempts: number }> = [];
      emitter.on("delivery.push.success", (payload) => events.push(payload));

      await handleOrderDelivery(createTestOrder(), undefined, emitter);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toBe("ivxp-test-order-123");
      expect(events[0].attempts).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // AC2: Retry with exponential backoff
  // -------------------------------------------------------------------------

  describe("AC2: Retry with exponential backoff", () => {
    it("should retry and succeed on second attempt", async () => {
      interceptDelays();

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await handleOrderDelivery(createTestOrder());

      expect(result.status).toBe("delivered");
      expect(result.method).toBe("push");
      expect(result.attempts).toBe(2);
    });

    it("should pass retry configuration through", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await handleOrderDelivery(createTestOrder(), {
        maxRetries: 2,
        initialDelayMs: 500,
      });

      expect(result.attempts).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Fallback to Store & Forward
  // -------------------------------------------------------------------------

  describe("AC3: Fallback to Store & Forward", () => {
    it("should return delivery_failed with store_and_forward method when all push retries exhausted", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const result = await handleOrderDelivery(createTestOrder(), { maxRetries: 2 });

      expect(result.status).toBe("delivery_failed");
      expect(result.method).toBe("store_and_forward");
      expect(result.error).toBeDefined();
    });

    it("should emit delivery.push.failed event with fallback info", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const events: Array<{
        orderId: string;
        attempts: number;
        error: string;
        fallback: "store_and_forward";
      }> = [];
      emitter.on("delivery.push.failed", (payload) => events.push(payload));

      await handleOrderDelivery(createTestOrder(), { maxRetries: 1 }, emitter);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toBe("ivxp-test-order-123");
      expect(events[0].fallback).toBe("store_and_forward");
      expect(events[0].error).toBeDefined();
    });

    it("should not emit success event on failure", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const successEvents: unknown[] = [];
      emitter.on("delivery.push.success", (payload) => successEvents.push(payload));

      await handleOrderDelivery(createTestOrder(), { maxRetries: 1 }, emitter);

      expect(successEvents).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // AC4: No delivery endpoint provided
  // -------------------------------------------------------------------------

  describe("AC4: No delivery endpoint (Store & Forward mode)", () => {
    it("should return delivered via store_and_forward when no endpoint", async () => {
      const order = createTestOrder({ deliveryEndpoint: undefined });
      const result = await handleOrderDelivery(order);

      expect(result.status).toBe("delivered");
      expect(result.method).toBe("store_and_forward");
      expect(result.attempts).toBe(0);
    });

    it("should return delivered via store_and_forward for empty endpoint", async () => {
      const order = createTestOrder({ deliveryEndpoint: "" });
      const result = await handleOrderDelivery(order);

      expect(result.status).toBe("delivered");
      expect(result.method).toBe("store_and_forward");
      expect(result.attempts).toBe(0);
    });

    it("should not call fetch when no endpoint provided", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const order = createTestOrder({ deliveryEndpoint: undefined });
      await handleOrderDelivery(order);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not emit any delivery push events when no endpoint", async () => {
      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const pushEvents: unknown[] = [];

      emitter.on("delivery.push.started", (p) => pushEvents.push(p));
      emitter.on("delivery.push.success", (p) => pushEvents.push(p));
      emitter.on("delivery.push.failed", (p) => pushEvents.push(p));

      const order = createTestOrder({ deliveryEndpoint: undefined });
      await handleOrderDelivery(order, undefined, emitter);

      expect(pushEvents).toHaveLength(0);
    });

    it("should emit delivery.store_and_forward event when no endpoint", async () => {
      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const events: Array<{ orderId: string; reason: string }> = [];
      emitter.on("delivery.store_and_forward", (payload) => events.push(payload));

      const order = createTestOrder({ deliveryEndpoint: undefined });
      await handleOrderDelivery(order, undefined, emitter);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toBe("ivxp-test-order-123");
      expect(events[0].reason).toBe("no_endpoint");
    });
  });

  // -------------------------------------------------------------------------
  // Event emission
  // -------------------------------------------------------------------------

  describe("event emission", () => {
    it("should work without an emitter (optional parameter)", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      // Should not throw when emitter is omitted
      const result = await handleOrderDelivery(createTestOrder());
      expect(result.status).toBe("delivered");
    });

    it("should emit started then success in order", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const eventOrder: string[] = [];

      emitter.on("delivery.push.started", () => eventOrder.push("started"));
      emitter.on("delivery.push.success", () => eventOrder.push("success"));
      emitter.on("delivery.push.failed", () => eventOrder.push("failed"));

      await handleOrderDelivery(createTestOrder(), undefined, emitter);

      expect(eventOrder).toEqual(["started", "success"]);
    });

    it("should emit started then failed in order on failure", async () => {
      interceptDelays();

      const mockFetch = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
      vi.stubGlobal("fetch", mockFetch);

      const emitter = new EventEmitter<ProviderDeliveryEventMap>();
      const eventOrder: string[] = [];

      emitter.on("delivery.push.started", () => eventOrder.push("started"));
      emitter.on("delivery.push.success", () => eventOrder.push("success"));
      emitter.on("delivery.push.failed", () => eventOrder.push("failed"));

      await handleOrderDelivery(createTestOrder(), { maxRetries: 1 }, emitter);

      expect(eventOrder).toEqual(["started", "failed"]);
    });
  });
});
