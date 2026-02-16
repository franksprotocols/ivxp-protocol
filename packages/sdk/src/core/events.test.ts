/**
 * EventEmitter unit tests.
 *
 * Tests the standalone EventEmitter class and its integration with
 * IVXPClient via the on/off/emit public API.
 *
 * Covers:
 * - Event subscription (on)
 * - Event emission with typed payloads
 * - Handler removal (off)
 * - removeAllListeners
 * - Handler error isolation
 * - Multiple handlers per event
 * - No-op behavior for unknown events
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "./events.js";
import type { SDKEventMap } from "./events.js";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  createMockServiceCatalog,
  createMockQuote,
  createMockDeliveryResponse,
  resetOrderCounter,
} from "@ivxp/test-utils";
import { IVXPClient } from "./client.js";

// ---------------------------------------------------------------------------
// Test-only event map for standalone emitter tests
// ---------------------------------------------------------------------------

/**
 * A minimal event map for testing the generic EventEmitter in isolation
 * from the full SDKEventMap.
 */
type TestEventMap = {
  "test.created": { id: string; value: number };
  "test.updated": { id: string; newValue: number };
  "test.deleted": { id: string };
};

// ---------------------------------------------------------------------------
// EventEmitter standalone tests
// ---------------------------------------------------------------------------

describe("EventEmitter", () => {
  // -------------------------------------------------------------------------
  // on() + emit()
  // -------------------------------------------------------------------------

  describe("on() and emit()", () => {
    it("should invoke handler when matching event is emitted", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler = vi.fn();

      emitter.on("test.created", handler);
      emitter.emit("test.created", { id: "abc", value: 42 });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ id: "abc", value: 42 });
    });

    it("should pass typed payload to handler", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const receivedPayloads: Array<{ id: string; value: number }> = [];

      emitter.on("test.created", (payload) => {
        receivedPayloads.push(payload);
      });

      emitter.emit("test.created", { id: "item-1", value: 100 });

      expect(receivedPayloads).toHaveLength(1);
      expect(receivedPayloads[0]).toEqual({ id: "item-1", value: 100 });
    });

    it("should support multiple handlers for the same event", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on("test.created", handler1);
      emitter.on("test.created", handler2);
      emitter.on("test.created", handler3);

      emitter.emit("test.created", { id: "multi", value: 1 });

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();
    });

    it("should invoke handlers in registration order", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const callOrder: number[] = [];

      emitter.on("test.created", () => callOrder.push(1));
      emitter.on("test.created", () => callOrder.push(2));
      emitter.on("test.created", () => callOrder.push(3));

      emitter.emit("test.created", { id: "order", value: 0 });

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should not invoke handlers for different events", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();

      emitter.on("test.created", createdHandler);
      emitter.on("test.updated", updatedHandler);

      emitter.emit("test.created", { id: "x", value: 1 });

      expect(createdHandler).toHaveBeenCalledOnce();
      expect(updatedHandler).not.toHaveBeenCalled();
    });

    it("should handle emit with no registered handlers (no-op)", () => {
      const emitter = new EventEmitter<TestEventMap>();

      // Should not throw
      expect(() => emitter.emit("test.created", { id: "no-handlers", value: 0 })).not.toThrow();
    });

    it("should support the same handler registered for different events", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const calls: string[] = [];

      const handler = () => calls.push("called");

      // Register the same function reference for two events.
      // TypeScript generics ensure type safety at the call-site; internally
      // the handler is stored as EventHandler (payload: unknown) => void.
      emitter.on("test.created", handler as (payload: TestEventMap["test.created"]) => void);
      emitter.on("test.deleted", handler as (payload: TestEventMap["test.deleted"]) => void);

      emitter.emit("test.created", { id: "a", value: 1 });
      emitter.emit("test.deleted", { id: "a" });

      expect(calls).toEqual(["called", "called"]);
    });
  });

  // -------------------------------------------------------------------------
  // off()
  // -------------------------------------------------------------------------

  describe("off()", () => {
    it("should remove a specific handler so it is no longer called", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler = vi.fn();

      emitter.on("test.created", handler);
      emitter.off("test.created", handler);
      emitter.emit("test.created", { id: "removed", value: 0 });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should only remove the specified handler, leaving others intact", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handlerA = vi.fn();
      const handlerB = vi.fn();

      emitter.on("test.created", handlerA);
      emitter.on("test.created", handlerB);
      emitter.off("test.created", handlerA);

      emitter.emit("test.created", { id: "partial", value: 0 });

      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).toHaveBeenCalledOnce();
    });

    it("should be a no-op when removing a handler that was never registered", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler = vi.fn();

      // Should not throw
      expect(() => emitter.off("test.created", handler)).not.toThrow();
    });

    it("should be a no-op when removing from an event with no handlers", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler = vi.fn();

      // No handlers registered for any event
      expect(() => emitter.off("test.deleted", handler)).not.toThrow();
    });

    it("should clean up the internal map entry when last handler is removed", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler = vi.fn();

      emitter.on("test.created", handler);
      emitter.off("test.created", handler);

      // After removing, emitting should have no effect
      emitter.emit("test.created", { id: "cleaned", value: 0 });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // removeAllListeners()
  // -------------------------------------------------------------------------

  describe("removeAllListeners()", () => {
    it("should remove all handlers for a specific event", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test.created", handler1);
      emitter.on("test.created", handler2);
      emitter.removeAllListeners("test.created");

      emitter.emit("test.created", { id: "removed-all", value: 0 });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should not affect handlers for other events", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();

      emitter.on("test.created", createdHandler);
      emitter.on("test.updated", updatedHandler);
      emitter.removeAllListeners("test.created");

      emitter.emit("test.updated", { id: "still-here", newValue: 99 });

      expect(updatedHandler).toHaveBeenCalledOnce();
    });

    it("should remove all handlers for all events when called without argument", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on("test.created", handler1);
      emitter.on("test.updated", handler2);
      emitter.on("test.deleted", handler3);

      emitter.removeAllListeners();

      emitter.emit("test.created", { id: "a", value: 1 });
      emitter.emit("test.updated", { id: "b", newValue: 2 });
      emitter.emit("test.deleted", { id: "c" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it("should be a no-op when called with event that has no handlers", () => {
      const emitter = new EventEmitter<TestEventMap>();

      expect(() => emitter.removeAllListeners("test.created")).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Error isolation
  // -------------------------------------------------------------------------

  describe("error isolation", () => {
    it("should catch and swallow handler errors without propagating", () => {
      const emitter = new EventEmitter<TestEventMap>();

      emitter.on("test.created", () => {
        throw new Error("Handler blew up");
      });

      expect(() => emitter.emit("test.created", { id: "error", value: 0 })).not.toThrow();
    });

    it("should invoke all handlers even if an earlier one throws", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const callOrder: number[] = [];

      emitter.on("test.created", () => {
        callOrder.push(1);
        throw new Error("First handler throws");
      });

      emitter.on("test.created", () => {
        callOrder.push(2);
      });

      emitter.on("test.created", () => {
        callOrder.push(3);
      });

      emitter.emit("test.created", { id: "multi-error", value: 0 });

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should not affect the return flow when handler throws", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const results: string[] = [];

      emitter.on("test.created", () => {
        throw new Error("Kaboom");
      });

      // emit should complete without throwing
      emitter.emit("test.created", { id: "flow", value: 0 });
      results.push("after-emit");

      expect(results).toEqual(["after-emit"]);
    });
  });

  // -------------------------------------------------------------------------
  // Immutability
  // -------------------------------------------------------------------------

  describe("immutability", () => {
    it("should not be affected by modifications to the handler array after on()", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test.created", handler1);
      emitter.on("test.created", handler2);

      // Remove handler1 -- should not affect handler2
      emitter.off("test.created", handler1);

      emitter.emit("test.created", { id: "immutable", value: 0 });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // SDKEventMap type compatibility
  // -------------------------------------------------------------------------

  describe("SDKEventMap compatibility", () => {
    it("should work with SDKEventMap event types", () => {
      const emitter = new EventEmitter<SDKEventMap>();
      const handler = vi.fn();

      emitter.on("catalog.received", handler);
      emitter.emit("catalog.received", { provider: "TestProvider", servicesCount: 3 });

      expect(handler).toHaveBeenCalledWith({
        provider: "TestProvider",
        servicesCount: 3,
      });
    });

    it("should support all SDK event types", () => {
      const emitter = new EventEmitter<SDKEventMap>();
      const events: string[] = [];

      emitter.on("catalog.received", () => events.push("catalog.received"));
      emitter.on("order.quoted", () => events.push("order.quoted"));
      emitter.on("order.paid", () => events.push("order.paid"));
      emitter.on("order.status_changed", () => events.push("order.status_changed"));
      emitter.on("order.delivered", () => events.push("order.delivered"));
      emitter.on("order.confirmed", () => events.push("order.confirmed"));
      emitter.on("payment.sent", () => events.push("payment.sent"));
      emitter.on("payment.confirmed", () => events.push("payment.confirmed"));

      emitter.emit("catalog.received", { provider: "P", servicesCount: 1 });
      emitter.emit("order.quoted", { orderId: "o1", priceUsdc: "10" });
      emitter.emit("order.paid", { orderId: "o1", txHash: "0xabc" });
      emitter.emit("order.status_changed", {
        orderId: "o1",
        previousStatus: null,
        newStatus: "paid",
      });
      emitter.emit("order.delivered", { orderId: "o1", format: "json" });
      emitter.emit("order.confirmed", { orderId: "o1", confirmedAt: "2026-01-01T00:00:00Z" });
      emitter.emit("payment.sent", { txHash: "0xdef" });
      emitter.emit("payment.confirmed", { txHash: "0xdef", blockNumber: 123n });

      expect(events).toEqual([
        "catalog.received",
        "order.quoted",
        "order.paid",
        "order.status_changed",
        "order.delivered",
        "order.confirmed",
        "payment.sent",
        "payment.confirmed",
      ]);
    });

    it("should follow domain.action naming convention for all events", () => {
      // Verify event names follow domain.action pattern
      const eventNames: Array<keyof SDKEventMap> = [
        "catalog.received",
        "order.quoted",
        "order.paid",
        "order.status_changed",
        "order.delivered",
        "order.confirmed",
        "payment.sent",
        "payment.confirmed",
      ];

      const domainActionPattern = /^[a-z]+\.[a-z_]+$/;

      for (const name of eventNames) {
        expect(name).toMatch(domainActionPattern);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Console.error logging in emit
  // -------------------------------------------------------------------------

  describe("error logging", () => {
    it("should call console.error when a handler throws", () => {
      const emitter = new EventEmitter<TestEventMap>();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new Error("Handler error");
      emitter.on("test.created", () => {
        throw error;
      });

      emitter.emit("test.created", { id: "log-test", value: 0 });

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in event handler for "test.created":',
        error,
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

// ---------------------------------------------------------------------------
// IVXPClient event emission integration tests
// ---------------------------------------------------------------------------

describe("IVXPClient event emission integration", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  /**
   * Helper to create a fully mocked IVXPClient for integration testing.
   */
  function createMockedClient(mockHttpOverrides: {
    defaultGetResponse?: unknown;
    defaultPostResponse?: unknown;
    getError?: Error;
    postError?: Error;
  }) {
    const mockCrypto = new MockCryptoService({
      address: TEST_ACCOUNTS.client.address,
    });
    const mockPayment = new MockPaymentService();
    const mockHttp = new MockHttpClient(mockHttpOverrides);

    const client = new IVXPClient({
      privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
      cryptoService: mockCrypto,
      paymentService: mockPayment,
      httpClient: mockHttp,
    });

    return { client, mockCrypto, mockPayment, mockHttp };
  }

  it("should emit 'catalog.received' when getCatalog succeeds", async () => {
    const catalogResponse = createMockServiceCatalog();
    const { client } = createMockedClient({
      defaultGetResponse: catalogResponse,
    });

    const events: Array<{ provider: string; servicesCount: number }> = [];
    client.on("catalog.received", (payload) => {
      events.push(payload);
    });

    await client.getCatalog("http://provider.test");

    expect(events).toHaveLength(1);
    expect(events[0].provider).toBe(catalogResponse.provider);
    expect(events[0].servicesCount).toBe(catalogResponse.services.length);
  });

  it("should emit 'order.quoted' when requestQuote succeeds", async () => {
    const quoteResponse = createMockQuote();
    const { client } = createMockedClient({
      defaultPostResponse: quoteResponse,
    });

    const events: Array<{ orderId: string; priceUsdc: string }> = [];
    client.on("order.quoted", (payload) => {
      events.push(payload);
    });

    await client.requestQuote("http://provider.test", {
      serviceType: "code_review",
      description: "Review my code",
      budgetUsdc: 50,
    });

    expect(events).toHaveLength(1);
    expect(events[0].orderId).toBe(quoteResponse.order_id);
    expect(events[0].priceUsdc).toBeDefined();
  });

  it("should emit 'payment.sent' and 'order.paid' when submitPayment succeeds", async () => {
    const { client } = createMockedClient({
      defaultPostResponse: { status: "paid" },
    });

    const paymentEvents: Array<{ txHash: string }> = [];
    const orderEvents: Array<{ orderId: string; txHash: string }> = [];

    client.on("payment.sent", (payload) => {
      paymentEvents.push(payload);
    });
    client.on("order.paid", (payload) => {
      orderEvents.push(payload);
    });

    await client.submitPayment("http://provider.test", "ivxp-test-order", {
      priceUsdc: 10,
      paymentAddress: "0x1234567890123456789012345678901234567890",
    });

    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0].txHash).toBeDefined();

    expect(orderEvents).toHaveLength(1);
    expect(orderEvents[0].orderId).toBe("ivxp-test-order");
    expect(orderEvents[0].txHash).toBeDefined();
  });

  it("should emit 'order.confirmed' when confirmDelivery succeeds", async () => {
    const { client } = createMockedClient({
      defaultPostResponse: {
        status: "confirmed",
        confirmed_at: "2026-02-16T12:00:00Z",
      },
    });

    const events: Array<{ orderId: string; confirmedAt: string }> = [];
    client.on("order.confirmed", (payload) => {
      events.push(payload);
    });

    await client.confirmDelivery("http://provider.test", "ivxp-test-order");

    expect(events).toHaveLength(1);
    expect(events[0].orderId).toBe("ivxp-test-order");
    expect(events[0].confirmedAt).toBe("2026-02-16T12:00:00Z");
  });

  it("should emit 'order.delivered' with format when downloadDeliverable succeeds", async () => {
    const orderId = "ivxp-download-test-order";
    const wireResponse = createMockDeliveryResponse({
      order_id: orderId,
      deliverable: {
        type: "code_review_result",
        format: "markdown",
        content: "# Report",
      },
    });
    const { client } = createMockedClient({
      defaultGetResponse: wireResponse,
    });

    const events: Array<{ orderId: string; format: string }> = [];
    client.on("order.delivered", (payload) => {
      events.push(payload);
    });

    await client.downloadDeliverable("http://provider.test", orderId);

    expect(events).toHaveLength(1);
    expect(events[0].orderId).toBe(orderId);
    expect(events[0].format).toBe("markdown");
  });
});
