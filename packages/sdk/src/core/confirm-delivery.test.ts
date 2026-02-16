/**
 * confirmDelivery() unit tests.
 *
 * Tests the IVXPClient.confirmDelivery() method for:
 * - Successful delivery confirmation flow (AC #1)
 * - EIP-191 signed confirmation message (AC #2)
 * - Return type: ConfirmationResult with final order status (AC #3)
 * - Order marked as complete (AC #4)
 * - Idempotent already-confirmed handling
 * - Order not in delivered state error
 * - Wire-format payload structure
 * - Input validation (orderId, providerUrl)
 * - Event emission ('order.confirmed')
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  resetOrderCounter,
} from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "./client.js";
import { ServiceUnavailableError } from "../errors/specific.js";
import { IVXPError } from "../errors/base.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid config for constructing an IVXPClient. */
const MINIMAL_CONFIG: IVXPClientConfig = {
  privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
};

/** Default mock signature returned by MockCryptoService. */
const MOCK_SIGNATURE =
  "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab01" as `0x${string}`;

/** Default order ID for tests. */
const DEFAULT_ORDER_ID = "ivxp-00000001-0000-0000-000000000000";

/** Expected confirmation endpoint URL for DEFAULT_ORDER_ID. */
const EXPECTED_CONFIRM_URL = `http://provider.test/ivxp/orders/${DEFAULT_ORDER_ID}/confirm`;

/** Default provider response for successful confirmation. */
const DEFAULT_CONFIRM_RESPONSE = {
  status: "confirmed",
  confirmed_at: "2026-02-16T13:00:00Z",
};

/** Create a fully mocked client for confirmDelivery tests. */
function createMockedClient(opts?: {
  mockCrypto?: MockCryptoService;
  mockPayment?: MockPaymentService;
  mockHttp?: MockHttpClient;
}): {
  client: IVXPClient;
  mockCrypto: MockCryptoService;
  mockPayment: MockPaymentService;
  mockHttp: MockHttpClient;
} {
  const mockCrypto =
    opts?.mockCrypto ?? new MockCryptoService({ address: TEST_ACCOUNTS.client.address });
  const mockPayment = opts?.mockPayment ?? new MockPaymentService();
  const mockHttp =
    opts?.mockHttp ??
    new MockHttpClient({
      defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
    });

  const client = new IVXPClient({
    ...MINIMAL_CONFIG,
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    httpClient: mockHttp,
  });

  return { client, mockCrypto, mockPayment, mockHttp };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IVXPClient.confirmDelivery()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  // -------------------------------------------------------------------------
  // Successful confirmation flow (AC #1, #3, #4)
  // -------------------------------------------------------------------------

  describe("successful confirmation flow", () => {
    it("should confirm delivery and return ConfirmationResult", async () => {
      const { client } = createMockedClient();

      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result).toBeDefined();
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.status).toBe("confirmed");
      expect(result.confirmedAt).toBe("2026-02-16T13:00:00Z");
      expect(result.signature).toMatch(/^0x/);
    });

    it("should POST to {providerUrl}/ivxp/orders/{orderId}/confirm", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      const calls = mockHttp.getPostCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(EXPECTED_CONFIRM_URL);
    });

    it("should strip trailing slashes from provider URL", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.confirmDelivery("http://provider.test///", DEFAULT_ORDER_ID);

      const calls = mockHttp.getPostCalls();
      expect(calls[0].url).toBe(EXPECTED_CONFIRM_URL);
    });

    it("should URL-encode orderId in the request path", async () => {
      const orderId = "ivxp-order with spaces";
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.confirmDelivery("http://provider.test", orderId);

      const calls = mockHttp.getPostCalls();
      expect(calls[0].url).toBe(
        `http://provider.test/ivxp/orders/${encodeURIComponent(orderId)}/confirm`,
      );
    });

    it("should return status 'confirmed' as terminal state (AC #4)", async () => {
      const { client } = createMockedClient();

      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.status).toBe("confirmed");
    });

    it("should return the confirmedAt timestamp from provider response", async () => {
      const customTimestamp = "2026-03-01T15:30:00Z";
      const mockHttp = new MockHttpClient({
        defaultPostResponse: {
          status: "confirmed",
          confirmed_at: customTimestamp,
        },
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.confirmedAt).toBe(customTimestamp);
    });
  });

  // -------------------------------------------------------------------------
  // Signed confirmation (AC #2)
  // -------------------------------------------------------------------------

  describe("signed confirmation", () => {
    it("should sign a confirmation message with orderId and timestamp", async () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });
      const { client } = createMockedClient({ mockCrypto });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      const signCalls = mockCrypto.getSignCalls();
      expect(signCalls).toHaveLength(1);
      expect(signCalls[0].message).toContain(`Confirm delivery: ${DEFAULT_ORDER_ID}`);
      expect(signCalls[0].message).toContain("Timestamp:");
    });

    it("should include confirmation message format: 'Confirm delivery: {orderId} | Timestamp: {ISO}'", async () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });
      const { client } = createMockedClient({ mockCrypto });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      const signCalls = mockCrypto.getSignCalls();
      const message = signCalls[0].message;
      expect(message).toMatch(/^Confirm delivery: .+ \| Timestamp: \d{4}-\d{2}-\d{2}T/);
    });

    it("should return the EIP-191 signature in the result (AC #2)", async () => {
      const { client } = createMockedClient();

      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.signature).toBe(MOCK_SIGNATURE);
    });
  });

  // -------------------------------------------------------------------------
  // Wire-format payload structure
  // -------------------------------------------------------------------------

  describe("wire-format payload", () => {
    it("should include protocol version in POST body", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      const calls = mockHttp.getPostCalls();
      const body = calls[0].body as Record<string, unknown>;
      expect(body.protocol).toBe("IVXP/1.0");
      expect(body.message_type).toBe("delivery_confirmation");
    });

    it("should include order_id and timestamp in POST body", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      const calls = mockHttp.getPostCalls();
      const body = calls[0].body as Record<string, unknown>;
      expect(body.order_id).toBe(DEFAULT_ORDER_ID);
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe("string");
      expect(Date.parse(body.timestamp as string)).not.toBeNaN();
    });

    it("should include confirmation object with message, signature, and signer", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      const calls = mockHttp.getPostCalls();
      const body = calls[0].body as Record<string, unknown>;
      const confirmation = body.confirmation as Record<string, unknown>;
      expect(confirmation).toBeDefined();
      expect(typeof confirmation.message).toBe("string");
      expect(confirmation.signature).toBe(MOCK_SIGNATURE);
      expect(confirmation.signer).toBe(TEST_ACCOUNTS.client.address);
    });
  });

  // -------------------------------------------------------------------------
  // Response validation (Zod schema)
  // -------------------------------------------------------------------------

  describe("response validation", () => {
    it("should throw IVXPError with INVALID_CONFIRMATION_FORMAT for invalid response", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: { invalid: true },
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_CONFIRMATION_FORMAT");
        expect((error as IVXPError).message).toMatch(/validation issue/);
      }
    });

    it("should throw for invalid confirmed_at timestamp format", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: {
          status: "confirmed",
          confirmed_at: "not-a-timestamp",
        },
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_CONFIRMATION_FORMAT");
      }
    });

    it("should throw when status field is not 'confirmed'", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: {
          status: "some_other_status",
          confirmed_at: "2026-02-16T13:00:00Z",
        },
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_CONFIRMATION_FORMAT");
      }
    });

    it("should not expose raw response data in validation error details", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: { secret_key: "super-secret-value", invalid: true },
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        const ivxpError = error as IVXPError;
        expect(ivxpError.details).toHaveProperty("issueCount");
        expect(ivxpError.details).not.toHaveProperty("issues");
      }
    });

    it("should accept valid ISO 8601 timestamps with milliseconds", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: {
          status: "confirmed",
          confirmed_at: "2026-02-16T13:00:00.123Z",
        },
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.confirmedAt).toBe("2026-02-16T13:00:00.123Z");
    });

    it("should accept valid ISO 8601 timestamps with timezone offset", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: {
          status: "confirmed",
          confirmed_at: "2026-02-16T13:00:00+08:00",
        },
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.confirmedAt).toBe("2026-02-16T13:00:00+08:00");
    });
  });

  // -------------------------------------------------------------------------
  // Already confirmed (idempotent handling)
  // -------------------------------------------------------------------------

  describe("already confirmed handling", () => {
    it("should return success when order is already confirmed", async () => {
      const mockHttp = new MockHttpClient({
        postError: new IVXPError("Already confirmed", "ORDER_ALREADY_CONFIRMED"),
      });
      const { client } = createMockedClient({ mockHttp });

      // Should not throw, should return success
      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.status).toBe("confirmed");
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.signature).toMatch(/^0x/);
    });

    it("should return confirmedAt with local timestamp on already-confirmed", async () => {
      const mockHttp = new MockHttpClient({
        postError: new IVXPError("Already confirmed", "ORDER_ALREADY_CONFIRMED"),
      });
      const { client } = createMockedClient({ mockHttp });

      const before = new Date().toISOString();
      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
      const after = new Date().toISOString();

      // confirmedAt should be a valid ISO timestamp between before and after
      expect(result.confirmedAt).toBeDefined();
      expect(result.confirmedAt >= before).toBe(true);
      expect(result.confirmedAt <= after).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("should throw ServiceUnavailableError on network failure", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Network error"),
      });
      const { client } = createMockedClient({ mockHttp });

      await expect(
        client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it("should re-throw IVXPError subclasses without wrapping", async () => {
      const mockHttp = new MockHttpClient({
        postError: new ServiceUnavailableError("Provider is down"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toBe("Provider is down");
      }
    });

    it("should re-throw IVXPError with ORDER_NOT_DELIVERED code", async () => {
      const mockHttp = new MockHttpClient({
        postError: new IVXPError("Order not in delivered state", "ORDER_NOT_DELIVERED"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("ORDER_NOT_DELIVERED");
      }
    });

    it("should include provider URL in ServiceUnavailableError message", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Connection refused"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toContain("http://provider.test");
      }
    });

    it("should handle string errors from provider", async () => {
      const mockHttp = new MockHttpClient({
        postError: "Unexpected server error" as unknown as Error,
      });
      const { client } = createMockedClient({ mockHttp });

      await expect(
        client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow(ServiceUnavailableError);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should reject empty provider URL", async () => {
      const { client } = createMockedClient();

      try {
        await client.confirmDelivery("", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject non-HTTP protocol URLs", async () => {
      const { client } = createMockedClient();

      try {
        await client.confirmDelivery("ftp://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject empty orderId", async () => {
      const { client } = createMockedClient();

      try {
        await client.confirmDelivery("http://provider.test", "");
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
        await client.confirmDelivery("http://provider.test", "order|injected");
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
        await client.confirmDelivery("http://provider.test", "");
      } catch {
        // Expected
      }

      expect(mockHttp.getPostCallCount()).toBe(0);
    });

    it("should accept https:// provider URLs", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.confirmDelivery("https://provider.test", DEFAULT_ORDER_ID);

      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      const calls = mockHttp.getPostCalls();
      expect(calls[0].url).toBe(`https://provider.test/ivxp/orders/${DEFAULT_ORDER_ID}/confirm`);
    });
  });

  // -------------------------------------------------------------------------
  // Event emission (AC #4)
  // -------------------------------------------------------------------------

  describe("event emission", () => {
    it("should emit 'order.confirmed' event on successful confirmation", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      const receivedEvents: Array<{ orderId: string; confirmedAt: string }> = [];
      client.on("order.confirmed", (payload) => {
        receivedEvents.push(payload);
      });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].orderId).toBe(DEFAULT_ORDER_ID);
      expect(receivedEvents[0].confirmedAt).toBe("2026-02-16T13:00:00Z");
    });

    it("should not emit event on confirmation failure", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Network error"),
      });
      const { client } = createMockedClient({ mockHttp });

      const receivedEvents: unknown[] = [];
      client.on("order.confirmed", (payload) => {
        receivedEvents.push(payload);
      });

      await expect(
        client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow();

      expect(receivedEvents).toHaveLength(0);
    });

    it("should not emit event on already-confirmed (idempotent)", async () => {
      const mockHttp = new MockHttpClient({
        postError: new IVXPError("Already confirmed", "ORDER_ALREADY_CONFIRMED"),
      });
      const { client } = createMockedClient({ mockHttp });

      const receivedEvents: unknown[] = [];
      client.on("order.confirmed", (payload) => {
        receivedEvents.push(payload);
      });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      // Already-confirmed path returns success but does not emit the event
      // since the provider already handled it
      expect(receivedEvents).toHaveLength(0);
    });

    it("should not propagate event handler errors to confirmDelivery caller", async () => {
      const mockHttp = new MockHttpClient({
        defaultPostResponse: DEFAULT_CONFIRM_RESPONSE,
      });
      const { client } = createMockedClient({ mockHttp });

      client.on("order.confirmed", () => {
        throw new Error("Handler error that should be swallowed");
      });

      // confirmDelivery should succeed despite the throwing handler
      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    });

    it("should invoke all handlers even if an earlier one throws", async () => {
      const { client } = createMockedClient();

      const callOrder: number[] = [];

      client.on("order.confirmed", () => {
        callOrder.push(1);
        throw new Error("First handler throws");
      });

      client.on("order.confirmed", () => {
        callOrder.push(2);
      });

      client.on("order.confirmed", () => {
        callOrder.push(3);
      });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(callOrder).toEqual([1, 2, 3]);
    });

    it("should call multiple handlers for the same event in registration order", async () => {
      const { client } = createMockedClient();

      const receivedPayloads: Array<{ orderId: string; confirmedAt: string }> = [];
      const handler1 = (payload: { orderId: string; confirmedAt: string }) => {
        receivedPayloads.push({ ...payload, orderId: `h1-${payload.orderId}` });
      };
      const handler2 = (payload: { orderId: string; confirmedAt: string }) => {
        receivedPayloads.push({ ...payload, orderId: `h2-${payload.orderId}` });
      };

      client.on("order.confirmed", handler1);
      client.on("order.confirmed", handler2);

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(receivedPayloads).toHaveLength(2);
      expect(receivedPayloads[0].orderId).toBe(`h1-${DEFAULT_ORDER_ID}`);
      expect(receivedPayloads[1].orderId).toBe(`h2-${DEFAULT_ORDER_ID}`);
    });

    it("should not call handler after off() is invoked", async () => {
      const { client } = createMockedClient();

      const receivedEvents: unknown[] = [];
      const handler = (payload: { orderId: string; confirmedAt: string }) => {
        receivedEvents.push(payload);
      };

      client.on("order.confirmed", handler);
      client.off("order.confirmed", handler);

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      expect(receivedEvents).toHaveLength(0);
    });

    it("should remove Map entry after last handler is unsubscribed via off()", async () => {
      const { client } = createMockedClient();

      const handler1 = () => {
        /* no-op */
      };
      const handler2 = () => {
        /* no-op */
      };

      client.on("order.confirmed", handler1);
      client.on("order.confirmed", handler2);

      // Remove both handlers
      client.off("order.confirmed", handler1);
      client.off("order.confirmed", handler2);

      // Should not throw or call any handlers
      const result = await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);
      expect(result.status).toBe("confirmed");
    });

    it("should not throw when off() is called for an event with no handlers", () => {
      const { client } = createMockedClient();

      const handler = () => {
        /* no-op */
      };

      // off() on an event that was never subscribed to should be a no-op
      expect(() => client.off("order.confirmed", handler)).not.toThrow();
    });

    it("should not remove other handlers when removing a non-registered handler", async () => {
      const { client } = createMockedClient();

      const receivedEvents: unknown[] = [];
      const registeredHandler = (payload: { orderId: string; confirmedAt: string }) => {
        receivedEvents.push(payload);
      };
      const nonRegisteredHandler = () => {
        /* never registered */
      };

      client.on("order.confirmed", registeredHandler);
      client.off("order.confirmed", nonRegisteredHandler);

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      // The registered handler should still fire
      expect(receivedEvents).toHaveLength(1);
    });

    it("should not call handlers for different event types", async () => {
      const { client } = createMockedClient();

      const confirmedEvents: unknown[] = [];
      const deliveredEvents: unknown[] = [];

      client.on("order.confirmed", (payload) => {
        confirmedEvents.push(payload);
      });
      client.on("order.delivered", (payload) => {
        deliveredEvents.push(payload);
      });

      await client.confirmDelivery("http://provider.test", DEFAULT_ORDER_ID);

      // Only order.confirmed should fire, not order.delivered
      expect(confirmedEvents).toHaveLength(1);
      expect(deliveredEvents).toHaveLength(0);
    });
  });
});
