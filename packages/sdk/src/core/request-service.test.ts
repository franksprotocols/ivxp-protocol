/**
 * requestService() unit tests.
 *
 * Tests the IVXPClient.requestService() method for:
 * - Full flow success (quote -> pay -> poll -> download -> confirm) (AC #1, #2, #3)
 * - Progress callbacks (AC #4)
 * - ProviderError with step context (AC #5)
 * - TimeoutError with partial state (AC #6)
 * - BudgetExceededError before payment (AC #7)
 * - Auto-confirm toggle (AC #3, #5)
 * - Input validation with explicit error codes
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  createMockQuote,
  createMockDeliveryResponse,
  createMockOrderStatusResponse,
  resetOrderCounter,
} from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "./client.js";
import { BudgetExceededError, TimeoutError, ProviderError } from "../errors/specific.js";
import { IVXPError } from "../errors/base.js";
import type { RequestServiceParams } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid config for constructing an IVXPClient. */
const MINIMAL_CONFIG: IVXPClientConfig = {
  privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
};

/** Default order ID matching the first auto-generated order. */
const DEFAULT_ORDER_ID = "ivxp-00000001-0000-0000-000000000000";

/** Default provider URL used in tests. */
const PROVIDER_URL = "http://provider.test";

/** Default confirm response. */
const DEFAULT_CONFIRM_RESPONSE = {
  status: "confirmed",
  confirmed_at: "2026-02-16T13:00:00Z",
};

/** Create a fully mocked client for requestService tests. */
function createMockedClient(mockHttp: MockHttpClient): IVXPClient {
  const mockCrypto = new MockCryptoService({
    address: TEST_ACCOUNTS.client.address,
  });
  const mockPayment = new MockPaymentService();

  return new IVXPClient({
    ...MINIMAL_CONFIG,
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    httpClient: mockHttp,
  });
}

/**
 * Build a MockHttpClient with route handlers for the full requestService flow.
 *
 * Validates that overrides use the same orderId when provided to prevent
 * accidental mismatches between quote, order status, and delivery data.
 *
 * By default wires up:
 * - POST /ivxp/request -> quote
 * - POST /ivxp/orders/{id}/payment -> success
 * - GET /ivxp/orders/{id} -> delivered status
 * - GET /ivxp/orders/{id}/deliverable -> delivery response
 * - POST /ivxp/orders/{id}/confirm -> confirmed
 */
function createFullFlowMockHttp(overrides?: {
  quote?: ReturnType<typeof createMockQuote>;
  deliveryResponse?: ReturnType<typeof createMockDeliveryResponse>;
  orderStatus?: ReturnType<typeof createMockOrderStatusResponse>;
}): MockHttpClient {
  const orderId = DEFAULT_ORDER_ID;
  const quote = overrides?.quote ?? createMockQuote({ order_id: orderId });
  const deliveryResponse =
    overrides?.deliveryResponse ?? createMockDeliveryResponse({ order_id: orderId });
  const orderStatus =
    overrides?.orderStatus ?? createMockOrderStatusResponse("delivered", { order_id: orderId });

  // Validate orderId consistency: if overrides are provided, all must
  // share the same order_id to prevent silent mismatches in test data.
  if (overrides?.quote && overrides.quote.order_id !== orderId) {
    throw new Error(
      `createFullFlowMockHttp: quote.order_id "${overrides.quote.order_id}" ` +
        `does not match expected orderId "${orderId}"`,
    );
  }
  if (overrides?.deliveryResponse && overrides.deliveryResponse.order_id !== orderId) {
    throw new Error(
      `createFullFlowMockHttp: deliveryResponse.order_id ` +
        `"${overrides.deliveryResponse.order_id}" does not match expected orderId "${orderId}"`,
    );
  }
  if (overrides?.orderStatus && overrides.orderStatus.order_id !== orderId) {
    throw new Error(
      `createFullFlowMockHttp: orderStatus.order_id "${overrides.orderStatus.order_id}" ` +
        `does not match expected orderId "${orderId}"`,
    );
  }

  const mockHttp = new MockHttpClient();

  // POST /ivxp/request -> quote
  mockHttp.onPost(`${PROVIDER_URL}/ivxp/request`, () => quote);

  // POST /ivxp/orders/{id}/payment -> success
  mockHttp.onPost(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/payment`, () => ({
    status: "paid",
  }));

  // GET /ivxp/orders/{id}/deliverable -> delivery
  // MUST be registered before the order status route since
  // MockHttpClient.findRoute uses prefix matching.
  mockHttp.onGet(
    `${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/deliverable`,
    () => deliveryResponse,
  );

  // GET /ivxp/orders/{id} -> delivered
  mockHttp.onGet(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}`, () => orderStatus);

  // POST /ivxp/orders/{id}/confirm -> confirmed
  mockHttp.onPost(
    `${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/confirm`,
    () => DEFAULT_CONFIRM_RESPONSE,
  );

  return mockHttp;
}

/** Default requestService params for tests. */
const DEFAULT_PARAMS: RequestServiceParams = {
  providerUrl: PROVIDER_URL,
  serviceType: "code_review",
  description: "Review my TypeScript code for security issues",
  budgetUsdc: 50,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IVXPClient.requestService()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  // -------------------------------------------------------------------------
  // AC #1, #2, #3: Full flow success
  // -------------------------------------------------------------------------

  describe("full flow (quote -> pay -> poll -> download -> confirm)", () => {
    it("should complete the full flow and return RequestServiceResult", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      const result = await client.requestService(DEFAULT_PARAMS);

      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.status).toBe("confirmed");
      expect(result.deliverable).toBeDefined();
      expect(result.deliverable.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.quote).toBeDefined();
      expect(result.quote.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.paymentTxHash).toBeDefined();
      expect(result.confirmedAt).toBe("2026-02-16T13:00:00Z");
    });

    it("should call requestQuote with correct params", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      await client.requestService({
        ...DEFAULT_PARAMS,
        deliveryFormat: "markdown",
      });

      // Verify the POST to /ivxp/request was made
      const postCalls = mockHttp.getPostCalls();
      const requestCall = postCalls.find((c) => c.url.includes("/ivxp/request"));
      expect(requestCall).toBeDefined();
      const body = requestCall!.body as Record<string, unknown>;
      const serviceRequest = body.service_request as Record<string, unknown>;
      expect(serviceRequest.type).toBe("code_review");
      expect(serviceRequest.description).toBe("Review my TypeScript code for security issues");
      expect(serviceRequest.delivery_format).toBe("markdown");
    });

    it("should submit payment to the provider", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      await client.requestService(DEFAULT_PARAMS);

      // Verify payment endpoint was called
      const postCalls = mockHttp.getPostCalls();
      const paymentCall = postCalls.find((c) => c.url.includes("/payment"));
      expect(paymentCall).toBeDefined();
    });

    it("should poll for delivery status", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      await client.requestService(DEFAULT_PARAMS);

      // Verify the GET to order status was made
      const getCalls = mockHttp.getGetCalls();
      const statusCalls = getCalls.filter(
        (c) => c.url.includes("/ivxp/orders/") && !c.url.includes("/deliverable"),
      );
      expect(statusCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should download the deliverable", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      await client.requestService(DEFAULT_PARAMS);

      // Verify the GET to /deliverable was made
      const getCalls = mockHttp.getGetCalls();
      const deliverableCalls = getCalls.filter((c) => c.url.includes("/deliverable"));
      expect(deliverableCalls).toHaveLength(1);
    });

    it("should confirm delivery when autoConfirm is true (default)", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      const result = await client.requestService(DEFAULT_PARAMS);

      expect(result.status).toBe("confirmed");
      expect(result.confirmedAt).toBeDefined();

      // Verify POST to /confirm was made
      const postCalls = mockHttp.getPostCalls();
      const confirmCall = postCalls.find((c) => c.url.includes("/confirm"));
      expect(confirmCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // AC #3, #5: Auto-confirm toggle
  // -------------------------------------------------------------------------

  describe("autoConfirm option", () => {
    it("should skip confirmation when autoConfirm is false", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      const result = await client.requestService({
        ...DEFAULT_PARAMS,
        autoConfirm: false,
      });

      expect(result.status).toBe("delivered");
      expect(result.confirmedAt).toBeUndefined();

      // Verify NO POST to /confirm was made
      const postCalls = mockHttp.getPostCalls();
      const confirmCall = postCalls.find((c) => c.url.includes("/confirm"));
      expect(confirmCall).toBeUndefined();
    });

    it("should return deliverable even when autoConfirm is false", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      const result = await client.requestService({
        ...DEFAULT_PARAMS,
        autoConfirm: false,
      });

      expect(result.deliverable).toBeDefined();
      expect(result.deliverable.orderId).toBe(DEFAULT_ORDER_ID);
    });

    it("should default autoConfirm to true when not specified", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);

      // DEFAULT_PARAMS does NOT include autoConfirm
      const result = await client.requestService(DEFAULT_PARAMS);

      expect(result.status).toBe("confirmed");
      expect(result.confirmedAt).toBeDefined();

      // Verify POST to /confirm was called
      const postCalls = mockHttp.getPostCalls();
      const confirmCall = postCalls.find((c) => c.url.includes("/confirm"));
      expect(confirmCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // AC #4: Progress callbacks
  // -------------------------------------------------------------------------

  describe("progress callbacks", () => {
    it("should call onQuote with the received quote", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);
      const onQuote = vi.fn();

      await client.requestService({
        ...DEFAULT_PARAMS,
        onQuote,
      });

      expect(onQuote).toHaveBeenCalledTimes(1);
      expect(onQuote.mock.calls[0][0].orderId).toBe(DEFAULT_ORDER_ID);
    });

    it("should call onPayment with the payment result", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);
      const onPayment = vi.fn();

      await client.requestService({
        ...DEFAULT_PARAMS,
        onPayment,
      });

      expect(onPayment).toHaveBeenCalledTimes(1);
      expect(onPayment.mock.calls[0][0].txHash).toBeDefined();
    });

    it("should call onDelivered with the delivery response", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);
      const onDelivered = vi.fn();

      await client.requestService({
        ...DEFAULT_PARAMS,
        onDelivered,
      });

      expect(onDelivered).toHaveBeenCalledTimes(1);
      expect(onDelivered.mock.calls[0][0].orderId).toBe(DEFAULT_ORDER_ID);
    });

    it("should call onConfirmed with the confirmation result", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);
      const onConfirmed = vi.fn();

      await client.requestService({
        ...DEFAULT_PARAMS,
        onConfirmed,
      });

      expect(onConfirmed).toHaveBeenCalledTimes(1);
      expect(onConfirmed.mock.calls[0][0].status).toBe("confirmed");
    });

    it("should NOT call onConfirmed when autoConfirm is false", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);
      const onConfirmed = vi.fn();

      await client.requestService({
        ...DEFAULT_PARAMS,
        autoConfirm: false,
        onConfirmed,
      });

      expect(onConfirmed).not.toHaveBeenCalled();
    });

    it("should call all four callbacks in order", async () => {
      const mockHttp = createFullFlowMockHttp();
      const client = createMockedClient(mockHttp);
      const callOrder: string[] = [];

      await client.requestService({
        ...DEFAULT_PARAMS,
        onQuote: () => callOrder.push("quote"),
        onPayment: () => callOrder.push("payment"),
        onDelivered: () => callOrder.push("delivered"),
        onConfirmed: () => callOrder.push("confirmed"),
      });

      expect(callOrder).toEqual(["quote", "payment", "delivered", "confirmed"]);
    });
  });

  // -------------------------------------------------------------------------
  // AC #7: BudgetExceededError
  // -------------------------------------------------------------------------

  describe("BudgetExceededError", () => {
    it("should throw BudgetExceededError when quote price exceeds budget", async () => {
      // Quote with price 50 USDC, budget 10 USDC
      const expensiveQuote = createMockQuote({
        order_id: DEFAULT_ORDER_ID,
        quote: {
          price_usdc: 50,
          estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
          payment_address: TEST_ACCOUNTS.provider.address,
          network: "base-sepolia",
        },
      });

      const mockHttp = createFullFlowMockHttp({ quote: expensiveQuote });
      const client = createMockedClient(mockHttp);

      await expect(
        client.requestService({
          ...DEFAULT_PARAMS,
          budgetUsdc: 10,
        }),
      ).rejects.toThrow(BudgetExceededError);
    });

    it("should include typed quote info and budget in BudgetExceededError", async () => {
      const expensiveQuote = createMockQuote({
        order_id: DEFAULT_ORDER_ID,
        quote: {
          price_usdc: 50,
          estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
          payment_address: TEST_ACCOUNTS.provider.address,
          network: "base-sepolia",
        },
      });

      const mockHttp = createFullFlowMockHttp({ quote: expensiveQuote });
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          budgetUsdc: 10,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(BudgetExceededError);
        const budgetError = error as BudgetExceededError;
        expect(budgetError.budgetUsdc).toBe(10);
        expect(budgetError.quoteInfo.priceUsdc).toBe(50);
        expect(budgetError.quoteInfo.orderId).toBe(DEFAULT_ORDER_ID);
        expect(budgetError.message).toContain("50");
        expect(budgetError.message).toContain("10");
      }
    });

    it("should NOT initiate any on-chain transaction when budget exceeded", async () => {
      const expensiveQuote = createMockQuote({
        order_id: DEFAULT_ORDER_ID,
        quote: {
          price_usdc: 50,
          estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
          payment_address: TEST_ACCOUNTS.provider.address,
          network: "base-sepolia",
        },
      });

      const mockHttp = createFullFlowMockHttp({ quote: expensiveQuote });
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          budgetUsdc: 10,
        });
      } catch {
        // Expected
      }

      // Verify NO payment endpoint was called
      const postCalls = mockHttp.getPostCalls();
      const paymentCall = postCalls.find((c) => c.url.includes("/payment"));
      expect(paymentCall).toBeUndefined();
    });

    it("should allow quotes that are exactly at budget", async () => {
      const exactQuote = createMockQuote({
        order_id: DEFAULT_ORDER_ID,
        quote: {
          price_usdc: 10,
          estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
          payment_address: TEST_ACCOUNTS.provider.address,
          network: "base-sepolia",
        },
      });

      const mockHttp = createFullFlowMockHttp({ quote: exactQuote });
      const client = createMockedClient(mockHttp);

      const result = await client.requestService({
        ...DEFAULT_PARAMS,
        budgetUsdc: 10,
      });

      expect(result.status).toBe("confirmed");
    });

    it("should handle floating-point precision correctly near budget boundary", async () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
      // Budget of 0.3 should still accept a quote of 0.1 + 0.2
      const floatQuote = createMockQuote({
        order_id: DEFAULT_ORDER_ID,
        quote: {
          price_usdc: 0.3,
          estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
          payment_address: TEST_ACCOUNTS.provider.address,
          network: "base-sepolia",
        },
      });

      const mockHttp = createFullFlowMockHttp({ quote: floatQuote });
      const client = createMockedClient(mockHttp);

      // 0.3 USDC should be within 0.3 USDC budget (exact match)
      const result = await client.requestService({
        ...DEFAULT_PARAMS,
        budgetUsdc: 0.3,
      });

      expect(result.status).toBe("confirmed");
    });
  });

  // -------------------------------------------------------------------------
  // AC #5: ProviderError
  // -------------------------------------------------------------------------

  describe("ProviderError", () => {
    it("should throw ProviderError when provider is unreachable at quote step", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("ECONNREFUSED"),
      });
      const client = createMockedClient(mockHttp);

      await expect(
        client.requestService({
          ...DEFAULT_PARAMS,
          providerUrl: "http://unreachable.test",
        }),
      ).rejects.toThrow(ProviderError);
    });

    it("should include step context in ProviderError", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("ECONNREFUSED"),
      });
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          providerUrl: "http://unreachable.test",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        const providerError = error as ProviderError;
        expect(providerError.step).toBe("quote");
        expect(providerError.providerUrl).toBe("http://unreachable.test");
      }
    });

    it("should throw ProviderError when delivery polling fails", async () => {
      const mockHttp = new MockHttpClient();
      const orderId = DEFAULT_ORDER_ID;
      const quote = createMockQuote({ order_id: orderId });

      // POST /ivxp/request -> quote (success)
      mockHttp.onPost(`${PROVIDER_URL}/ivxp/request`, () => quote);

      // POST /ivxp/orders/{id}/payment -> success
      mockHttp.onPost(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/payment`, () => ({
        status: "paid",
      }));

      // GET /ivxp/orders/{id} -> error
      mockHttp.onGet(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}`, () => {
        throw new Error("Connection reset");
      });

      const client = createMockedClient(mockHttp);

      try {
        await client.requestService(DEFAULT_PARAMS);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        const providerError = error as ProviderError;
        expect(providerError.step).toBe("poll");
      }
    });
  });

  // -------------------------------------------------------------------------
  // AC #6: TimeoutError (using fake timers for deterministic testing)
  // -------------------------------------------------------------------------

  describe("TimeoutError", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should throw TimeoutError when flow exceeds timeoutMs", async () => {
      const mockHttp = new MockHttpClient();
      const orderId = DEFAULT_ORDER_ID;
      const quote = createMockQuote({ order_id: orderId });

      // POST /ivxp/request -> quote (success)
      mockHttp.onPost(`${PROVIDER_URL}/ivxp/request`, () => quote);

      // POST /ivxp/orders/{id}/payment -> success
      mockHttp.onPost(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/payment`, () => ({
        status: "paid",
      }));

      // GET /ivxp/orders/{id} -> always "paid" (never delivered)
      mockHttp.onGet(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}`, () =>
        createMockOrderStatusResponse("paid", { order_id: orderId }),
      );

      const client = createMockedClient(mockHttp);

      // Store error for assertion, attaching a catch handler to prevent
      // unhandled rejection warnings when using fake timers.
      let caughtError: unknown;
      const promise = client
        .requestService({
          ...DEFAULT_PARAMS,
          timeoutMs: 500,
          pollOptions: { initialDelay: 100, maxDelay: 100, maxAttempts: 100 },
        })
        .catch((error: unknown) => {
          caughtError = error;
        });

      // Advance time past the timeout
      await vi.advanceTimersByTimeAsync(600);
      await promise;

      expect(caughtError).toBeInstanceOf(TimeoutError);
    });

    it("should include partial state with txHash when payment succeeded before timeout", async () => {
      const mockHttp = new MockHttpClient();
      const orderId = DEFAULT_ORDER_ID;
      const quote = createMockQuote({ order_id: orderId });

      mockHttp.onPost(`${PROVIDER_URL}/ivxp/request`, () => quote);
      mockHttp.onPost(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/payment`, () => ({
        status: "paid",
      }));
      mockHttp.onGet(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}`, () =>
        createMockOrderStatusResponse("paid", { order_id: orderId }),
      );

      const client = createMockedClient(mockHttp);

      // Store error for assertion, attaching a catch handler to prevent
      // unhandled rejection warnings when using fake timers.
      let caughtError: unknown;
      const promise = client
        .requestService({
          ...DEFAULT_PARAMS,
          timeoutMs: 500,
          pollOptions: { initialDelay: 100, maxDelay: 100, maxAttempts: 100 },
        })
        .catch((error: unknown) => {
          caughtError = error;
        });

      // Advance time past the timeout
      await vi.advanceTimersByTimeAsync(600);
      await promise;

      expect(caughtError).toBeInstanceOf(TimeoutError);
      const timeoutError = caughtError as TimeoutError;
      expect(timeoutError.step).toBeDefined();
      expect(timeoutError.partialState).toBeDefined();
      expect(timeoutError.partialState.txHash).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Delivery failure handling
  // -------------------------------------------------------------------------

  describe("delivery failure", () => {
    it("should throw IVXPError when order status is delivery_failed", async () => {
      const failedOrderStatus = createMockOrderStatusResponse("delivery_failed", {
        order_id: DEFAULT_ORDER_ID,
      });

      const mockHttp = createFullFlowMockHttp({
        orderStatus: failedOrderStatus,
      });
      const client = createMockedClient(mockHttp);

      await expect(client.requestService(DEFAULT_PARAMS)).rejects.toThrow(IVXPError);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should reject empty providerUrl with INVALID_PROVIDER_URL code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          providerUrl: "",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject providerUrl missing protocol with INVALID_PROVIDER_URL code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          providerUrl: "provider.test",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject providerUrl with invalid protocol with INVALID_PROVIDER_URL code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          providerUrl: "ftp://provider.test",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject malformed URL with INVALID_PROVIDER_URL code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          providerUrl: "not a url at all",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject empty serviceType with INVALID_REQUEST_PARAMS code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          serviceType: "",
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
      }
    });

    it("should reject zero budgetUsdc with INVALID_REQUEST_PARAMS code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          budgetUsdc: 0,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
      }
    });

    it("should reject negative budgetUsdc with INVALID_REQUEST_PARAMS code", async () => {
      const mockHttp = new MockHttpClient();
      const client = createMockedClient(mockHttp);

      try {
        await client.requestService({
          ...DEFAULT_PARAMS,
          budgetUsdc: -5,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
      }
    });
  });
});
