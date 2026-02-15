/**
 * getOrderStatus(), pollOrderUntil(), and waitForDelivery() unit tests.
 *
 * Tests the IVXPClient order-polling methods for:
 * - Successful order status fetch and validation
 * - Input validation (providerUrl, orderId)
 * - Error handling (invalid response format, network errors)
 * - Polling until target status is reached
 * - Abort signal support
 * - MaxPollAttemptsError on exceeded attempts
 * - Event emission for status changes
 * - Terminal state handling
 * - waitForDelivery convenience wrapper
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  createMockOrderStatusResponse,
  resetOrderCounter,
} from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "./client.js";
import { ServiceUnavailableError, MaxPollAttemptsError } from "../errors/specific.js";
import { IVXPError } from "../errors/base.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid config for constructing an IVXPClient. */
const MINIMAL_CONFIG: IVXPClientConfig = {
  privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
};

/** Default order ID for tests. */
const DEFAULT_ORDER_ID = "ivxp-00000001-0000-0000-000000000000";

/** Default provider URL for tests. */
const DEFAULT_PROVIDER_URL = "http://provider.test";

/** Create a fully mocked client for order status tests. */
function createMockedClient(opts?: {
  mockHttp?: MockHttpClient;
}): {
  client: IVXPClient;
  mockHttp: MockHttpClient;
} {
  const mockCrypto = new MockCryptoService({
    address: TEST_ACCOUNTS.client.address,
  });
  const mockPayment = new MockPaymentService();
  const mockHttp = opts?.mockHttp ?? new MockHttpClient();

  const client = new IVXPClient({
    ...MINIMAL_CONFIG,
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    httpClient: mockHttp,
  });

  return { client, mockHttp };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IVXPClient.getOrderStatus()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  // -------------------------------------------------------------------------
  // Successful fetch
  // -------------------------------------------------------------------------

  describe("successful fetch", () => {
    it("should fetch and validate an order status from the provider URL", async () => {
      const wireResponse = createMockOrderStatusResponse("paid", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID);

      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.status).toBe("paid");
      expect(result.serviceType).toBe("code_review");
      expect(result.priceUsdc).toBe(10);
      expect(result.createdAt).toBeDefined();
    });

    it("should call GET {providerUrl}/ivxp/orders/{orderId}", async () => {
      const wireResponse = createMockOrderStatusResponse("quoted", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      await client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID);

      const calls = mockHttp.getGetCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(`${DEFAULT_PROVIDER_URL}/ivxp/orders/${DEFAULT_ORDER_ID}`);
    });

    it("should strip trailing slashes from provider URL", async () => {
      const wireResponse = createMockOrderStatusResponse("quoted", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      await client.getOrderStatus("http://provider.test///", DEFAULT_ORDER_ID);

      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe(`http://provider.test/ivxp/orders/${DEFAULT_ORDER_ID}`);
    });

    it("should return a properly typed OrderStatusResponseOutput object", async () => {
      const wireResponse = createMockOrderStatusResponse("delivered", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID);

      // Should have camelCase fields (Zod transform output)
      expect(result).toHaveProperty("orderId");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("serviceType");
      expect(result).toHaveProperty("priceUsdc");

      // Should NOT have snake_case fields (wire format)
      expect(result).not.toHaveProperty("order_id");
      expect(result).not.toHaveProperty("created_at");
      expect(result).not.toHaveProperty("service_type");
      expect(result).not.toHaveProperty("price_usdc");
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should reject empty provider URL", async () => {
      const { client } = createMockedClient();

      try {
        await client.getOrderStatus("", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject non-HTTP protocol URLs", async () => {
      const { client } = createMockedClient();

      try {
        await client.getOrderStatus("ftp://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject empty orderId", async () => {
      const { client } = createMockedClient();

      try {
        await client.getOrderStatus(DEFAULT_PROVIDER_URL, "");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("orderId");
      }
    });

    it("should reject orderId containing pipe character", async () => {
      const { client } = createMockedClient();

      try {
        await client.getOrderStatus(DEFAULT_PROVIDER_URL, "ivxp-invalid|id");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("pipe");
      }
    });

    it("should not make HTTP request when validation fails", async () => {
      const mockHttp = new MockHttpClient();
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.getOrderStatus(DEFAULT_PROVIDER_URL, "");
      } catch {
        // Expected
      }

      expect(mockHttp.getGetCallCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("should throw IVXPError with INVALID_ORDER_STATUS_FORMAT on invalid response", async () => {
      const mockHttp = new MockHttpClient({ defaultGetResponse: { invalid: true } });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_ORDER_STATUS_FORMAT");
        expect((error as IVXPError).message).toMatch(/validation issue/);
      }
    });

    it("should throw ServiceUnavailableError on network failure", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Network error"),
      });
      const { client } = createMockedClient({ mockHttp });

      await expect(
        client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID),
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it("should re-throw IVXPError subclasses without wrapping", async () => {
      const mockHttp = new MockHttpClient({
        getError: new ServiceUnavailableError("Provider is down"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toBe("Provider is down");
      }
    });

    it("should include provider URL in ServiceUnavailableError message", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Connection refused"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.getOrderStatus(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toContain("http://provider.test");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// pollOrderUntil()
// ---------------------------------------------------------------------------

describe("IVXPClient.pollOrderUntil()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  // -------------------------------------------------------------------------
  // Successful polling
  // -------------------------------------------------------------------------

  describe("successful polling", () => {
    it("should poll until target status is reached", async () => {
      let callCount = 0;
      const mockHttp = new MockHttpClient();
      mockHttp.onGet(`${DEFAULT_PROVIDER_URL}/ivxp/orders/${DEFAULT_ORDER_ID}`, () => {
        callCount += 1;
        // Return "paid" for the first two calls, then "delivered"
        if (callCount < 3) {
          return createMockOrderStatusResponse("paid", { order_id: DEFAULT_ORDER_ID });
        }
        return createMockOrderStatusResponse("delivered", { order_id: DEFAULT_ORDER_ID });
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        targetStatuses: ["delivered"],
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 10,
      });

      expect(result.status).toBe("delivered");
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(callCount).toBe(3);
    });

    it("should use default target statuses (delivered, delivery_failed, confirmed)", async () => {
      const wireResponse = createMockOrderStatusResponse("delivered", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 5,
      });

      expect(result.status).toBe("delivered");
    });

    it("should stop polling on delivery_failed status", async () => {
      const wireResponse = createMockOrderStatusResponse("delivery_failed", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 5,
      });

      expect(result.status).toBe("delivery_failed");
    });

    it("should return immediately if first poll matches target status", async () => {
      const wireResponse = createMockOrderStatusResponse("delivered", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        targetStatuses: ["delivered"],
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 5,
      });

      expect(result.status).toBe("delivered");
      // Should only have made 1 GET call
      expect(mockHttp.getGetCallCount()).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Abort signal
  // -------------------------------------------------------------------------

  describe("abort signal", () => {
    it("should support abort signal for cancellation", async () => {
      const wireResponse = createMockOrderStatusResponse("paid", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const controller = new AbortController();
      // Abort immediately
      controller.abort();

      await expect(
        client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
          targetStatuses: ["delivered"],
          initialDelay: 1,
          maxDelay: 1,
          jitter: 0,
          maxAttempts: 100,
          signal: controller.signal,
        }),
      ).rejects.toThrow(/abort/i);
    });
  });

  // -------------------------------------------------------------------------
  // Max attempts exceeded
  // -------------------------------------------------------------------------

  describe("max attempts exceeded", () => {
    it("should throw MaxPollAttemptsError when max attempts exceeded", async () => {
      const wireResponse = createMockOrderStatusResponse("paid", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
          targetStatuses: ["delivered"],
          initialDelay: 1,
          maxDelay: 1,
          jitter: 0,
          maxAttempts: 3,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(MaxPollAttemptsError);
        expect((error as MaxPollAttemptsError).attempts).toBe(3);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Event emission
  // -------------------------------------------------------------------------

  describe("event emission", () => {
    it("should emit order.status_changed on status change", async () => {
      let callCount = 0;
      const mockHttp = new MockHttpClient();
      mockHttp.onGet(`${DEFAULT_PROVIDER_URL}/ivxp/orders/${DEFAULT_ORDER_ID}`, () => {
        callCount += 1;
        if (callCount === 1) {
          return createMockOrderStatusResponse("paid", { order_id: DEFAULT_ORDER_ID });
        }
        return createMockOrderStatusResponse("delivered", { order_id: DEFAULT_ORDER_ID });
      });
      const { client } = createMockedClient({ mockHttp });

      const statusEvents: Array<{
        orderId: string;
        previousStatus: string | null;
        newStatus: string;
      }> = [];
      client.on("order.status_changed", (payload) => {
        statusEvents.push(payload);
      });

      await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        targetStatuses: ["delivered"],
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 10,
      });

      // First poll: null -> paid, Second poll: paid -> delivered
      expect(statusEvents).toHaveLength(2);
      expect(statusEvents[0].previousStatus).toBeNull();
      expect(statusEvents[0].newStatus).toBe("paid");
      expect(statusEvents[0].orderId).toBe(DEFAULT_ORDER_ID);
      expect(statusEvents[1].previousStatus).toBe("paid");
      expect(statusEvents[1].newStatus).toBe("delivered");
      expect(statusEvents[1].orderId).toBe(DEFAULT_ORDER_ID);
    });

    it("should not emit event when status has not changed", async () => {
      let callCount = 0;
      const mockHttp = new MockHttpClient();
      mockHttp.onGet(`${DEFAULT_PROVIDER_URL}/ivxp/orders/${DEFAULT_ORDER_ID}`, () => {
        callCount += 1;
        // Return "paid" twice, then "delivered"
        if (callCount <= 2) {
          return createMockOrderStatusResponse("paid", { order_id: DEFAULT_ORDER_ID });
        }
        return createMockOrderStatusResponse("delivered", { order_id: DEFAULT_ORDER_ID });
      });
      const { client } = createMockedClient({ mockHttp });

      const statusEvents: Array<{
        orderId: string;
        previousStatus: string | null;
        newStatus: string;
      }> = [];
      client.on("order.status_changed", (payload) => {
        statusEvents.push(payload);
      });

      await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        targetStatuses: ["delivered"],
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 10,
      });

      // null -> paid (1st), paid -> paid (no event), paid -> delivered (2nd)
      expect(statusEvents).toHaveLength(2);
      expect(statusEvents[0].newStatus).toBe("paid");
      expect(statusEvents[1].newStatus).toBe("delivered");
    });
  });

  // -------------------------------------------------------------------------
  // Terminal states
  // -------------------------------------------------------------------------

  describe("terminal states", () => {
    it("should stop polling on 'delivered'", async () => {
      const wireResponse = createMockOrderStatusResponse("delivered", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 5,
      });

      expect(result.status).toBe("delivered");
      expect(mockHttp.getGetCallCount()).toBe(1);
    });

    it("should stop polling on 'delivery_failed'", async () => {
      const wireResponse = createMockOrderStatusResponse("delivery_failed", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 5,
      });

      expect(result.status).toBe("delivery_failed");
      expect(mockHttp.getGetCallCount()).toBe(1);
    });

    it("should continue polling on non-terminal status", async () => {
      let callCount = 0;
      const mockHttp = new MockHttpClient();
      mockHttp.onGet(`${DEFAULT_PROVIDER_URL}/ivxp/orders/${DEFAULT_ORDER_ID}`, () => {
        callCount += 1;
        if (callCount < 3) {
          return createMockOrderStatusResponse("quoted", { order_id: DEFAULT_ORDER_ID });
        }
        return createMockOrderStatusResponse("delivered", { order_id: DEFAULT_ORDER_ID });
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.pollOrderUntil(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        targetStatuses: ["delivered", "delivery_failed"],
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 10,
      });

      expect(result.status).toBe("delivered");
      expect(callCount).toBe(3);
    });
  });
});

// ---------------------------------------------------------------------------
// waitForDelivery()
// ---------------------------------------------------------------------------

describe("IVXPClient.waitForDelivery()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  it("should poll until 'delivered' status", async () => {
    const wireResponse = createMockOrderStatusResponse("delivered", {
      order_id: DEFAULT_ORDER_ID,
    });
    const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
    const { client } = createMockedClient({ mockHttp });

    const result = await client.waitForDelivery(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
      initialDelay: 1,
      maxDelay: 1,
      jitter: 0,
      maxAttempts: 5,
    });

    expect(result.status).toBe("delivered");
  });

  it("should stop on 'delivery_failed' status", async () => {
    const wireResponse = createMockOrderStatusResponse("delivery_failed", {
      order_id: DEFAULT_ORDER_ID,
    });
    const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
    const { client } = createMockedClient({ mockHttp });

    const result = await client.waitForDelivery(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
      initialDelay: 1,
      maxDelay: 1,
      jitter: 0,
      maxAttempts: 5,
    });

    expect(result.status).toBe("delivery_failed");
  });

  it("should forward polling options", async () => {
    const wireResponse = createMockOrderStatusResponse("paid", {
      order_id: DEFAULT_ORDER_ID,
    });
    const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
    const { client } = createMockedClient({ mockHttp });

    // With maxAttempts: 2, it should fail since "paid" is not a target
    try {
      await client.waitForDelivery(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 2,
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MaxPollAttemptsError);
      expect((error as MaxPollAttemptsError).attempts).toBe(2);
    }
  });

  it("should forward abort signal", async () => {
    const wireResponse = createMockOrderStatusResponse("paid", {
      order_id: DEFAULT_ORDER_ID,
    });
    const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
    const { client } = createMockedClient({ mockHttp });

    const controller = new AbortController();
    controller.abort();

    await expect(
      client.waitForDelivery(DEFAULT_PROVIDER_URL, DEFAULT_ORDER_ID, {
        initialDelay: 1,
        maxDelay: 1,
        jitter: 0,
        maxAttempts: 100,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/abort/i);
  });
});
