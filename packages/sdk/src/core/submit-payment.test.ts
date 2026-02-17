/**
 * submitPayment() unit tests.
 *
 * Tests the IVXPClient.submitPayment() method for:
 * - Successful end-to-end payment flow
 * - IVXP message signing with payment proof
 * - PartialSuccessError when notification fails
 * - Wire-format payload structure (story spec format)
 * - Input validation (orderId, priceUsdc, paymentAddress)
 * - Event emission
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  createMockOrderStatusResponse,
  resetOrderCounter,
  DEFAULT_TX_HASH,
} from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "./client.js";
import { PartialSuccessError } from "../errors/specific.js";
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

/** Quote input for submitPayment. */
interface SubmitPaymentQuote {
  readonly priceUsdc: number;
  readonly paymentAddress: `0x${string}`;
}

/** Default quote for tests. */
const DEFAULT_QUOTE: SubmitPaymentQuote = {
  priceUsdc: 10,
  paymentAddress: TEST_ACCOUNTS.provider.address,
};

/** Default order ID for tests. */
const DEFAULT_ORDER_ID = "ivxp-00000001-0000-0000-000000000000";

/** Expected payment endpoint URL for DEFAULT_ORDER_ID. */
const EXPECTED_PAYMENT_URL = `http://provider.test/ivxp/orders/${DEFAULT_ORDER_ID}/payment`;

/** Create a fully mocked client for submitPayment tests. */
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
      defaultPostResponse: createMockOrderStatusResponse("paid"),
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

describe("IVXPClient.submitPayment()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  // -------------------------------------------------------------------------
  // Successful payment flow (AC #1, #4)
  // -------------------------------------------------------------------------

  describe("successful payment flow", () => {
    it("should send USDC, sign proof, notify provider, and return result", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.submitPayment(
        "http://provider.test",
        DEFAULT_ORDER_ID,
        DEFAULT_QUOTE,
      );

      expect(result).toBeDefined();
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.txHash).toBeDefined();
      expect(result.status).toBe("paid");
    });

    it("should return a PaymentResult with orderId, txHash, and status", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: DEFAULT_TX_HASH,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      const result = await client.submitPayment(
        "http://provider.test",
        DEFAULT_ORDER_ID,
        DEFAULT_QUOTE,
      );

      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.txHash).toBe(DEFAULT_TX_HASH);
      expect(result.status).toBe("paid");
    });

    it("should call paymentService.send() with correct amount and address", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService();
      const { client } = createMockedClient({ mockHttp, mockPayment });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
        priceUsdc: 8.5,
        paymentAddress: TEST_ACCOUNTS.provider.address,
      });

      const sendCalls = mockPayment.getSendCalls();
      expect(sendCalls).toHaveLength(1);
      expect(sendCalls[0].to).toBe(TEST_ACCOUNTS.provider.address);
      expect(sendCalls[0].amount).toBe("8.500000");
    });

    it("should POST payment proof to {providerUrl}/ivxp/orders/{orderId}/payment", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const postCalls = mockHttp.getPostCalls();
      expect(postCalls).toHaveLength(1);
      expect(postCalls[0].url).toBe(EXPECTED_PAYMENT_URL);
    });

    it("should strip trailing slashes from provider URL", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.submitPayment("http://provider.test///", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const postCalls = mockHttp.getPostCalls();
      expect(postCalls[0].url).toBe(EXPECTED_PAYMENT_URL);
    });
  });

  // -------------------------------------------------------------------------
  // Signed payment proof (AC #2)
  // -------------------------------------------------------------------------

  describe("signed payment proof", () => {
    it("should sign IVXP message with orderId and txHash", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });
      const { client } = createMockedClient({ mockHttp, mockCrypto });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const signCalls = mockCrypto.getSignCalls();
      expect(signCalls).toHaveLength(1);
      expect(signCalls[0].message).toContain(`Order: ${DEFAULT_ORDER_ID}`);
      expect(signCalls[0].message).toContain("Payment: 0x");
      expect(signCalls[0].message).toContain("Timestamp:");
    });

    it("should include signature object in POST body with sig, message, signer", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const { client } = createMockedClient({ mockHttp });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const postCalls = mockHttp.getPostCalls();
      const body = postCalls[0].body as Record<string, unknown>;
      const sig = body.signature as Record<string, unknown>;
      expect(sig.sig).toBe(MOCK_SIGNATURE);
      expect(typeof sig.message).toBe("string");
      expect(sig.signer).toBe(TEST_ACCOUNTS.client.address);
    });

    it("should include payment object in wire-format POST body", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: DEFAULT_TX_HASH,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const postCalls = mockHttp.getPostCalls();
      const body = postCalls[0].body as Record<string, unknown>;

      // Protocol fields
      expect(body.protocol).toBe("IVXP/1.0");
      expect(body.message_type).toBe("payment_proof");
      expect(body.timestamp).toBeDefined();
      expect(body.order_id).toBe(DEFAULT_ORDER_ID);

      // Payment object (story spec format)
      const payment = body.payment as Record<string, unknown>;
      expect(payment.tx_hash).toBe(DEFAULT_TX_HASH);
      expect(payment.amount_usdc).toBe("10.000000");
      expect(payment.network).toBe("base-sepolia");
    });

    it("should use the IVXP/1.0 message format for signing", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });
      const { client } = createMockedClient({ mockHttp, mockCrypto });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const signCalls = mockCrypto.getSignCalls();
      // Message format: "Order: {orderId} | Payment: {txHash} | Timestamp: {ISO8601}"
      const message = signCalls[0].message;
      expect(message).toMatch(
        /^Order: .+ \| Payment: 0x[0-9a-f]+ \| Timestamp: \d{4}-\d{2}-\d{2}T/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Partial success handling (AC #3)
  // -------------------------------------------------------------------------

  describe("partial success error", () => {
    it("should throw PartialSuccessError when tx succeeds but notification fails", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Network error: provider unreachable"),
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: DEFAULT_TX_HASH,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PartialSuccessError);
        const partialError = error as PartialSuccessError;
        expect(partialError.txHash).toBe(DEFAULT_TX_HASH);
        expect(partialError.recoverable).toBe(true);
        expect(partialError.originalError).toBeInstanceOf(Error);
        expect(partialError.originalError?.message).toContain("provider unreachable");
      }
    });

    it("should include txHash in PartialSuccessError for recovery", async () => {
      const customTxHash =
        "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`;
      const mockHttp = new MockHttpClient({
        postError: new Error("Timeout"),
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: customTxHash,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PartialSuccessError);
        expect((error as PartialSuccessError).txHash).toBe(customTxHash);
      }
    });

    it("should set PartialSuccessError as recoverable by default", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Notification failed"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PartialSuccessError);
        expect((error as PartialSuccessError).recoverable).toBe(true);
      }
    });

    it("should use generic message without txHash in PartialSuccessError.message", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Connection refused"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PartialSuccessError);
        const msg = (error as PartialSuccessError).message;
        expect(msg).toBe("Payment sent but provider notification failed");
        // txHash should only be in the error property, not the message
        expect(msg).not.toContain("0x");
      }
    });
  });

  // -------------------------------------------------------------------------
  // Payment failure propagation
  // -------------------------------------------------------------------------

  describe("payment failure", () => {
    it("should propagate payment service errors without wrapping in PartialSuccessError", async () => {
      const paymentError = new Error("Insufficient funds");
      const mockPayment = new MockPaymentService({ sendError: paymentError });
      const { client } = createMockedClient({ mockPayment });

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        // Should NOT be PartialSuccessError since tx was never sent
        expect(error).not.toBeInstanceOf(PartialSuccessError);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Insufficient funds");
      }
    });

    it("should not call HTTP post if payment send fails", async () => {
      const mockPayment = new MockPaymentService({
        sendError: new Error("Payment failed"),
      });
      const mockHttp = new MockHttpClient();
      const { client } = createMockedClient({ mockPayment, mockHttp });

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
      } catch {
        // Expected
      }

      expect(mockHttp.getPostCallCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should reject empty provider URL", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject non-HTTP protocol URLs", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("ftp://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject empty orderId", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", "", DEFAULT_QUOTE);
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
        await client.submitPayment("http://provider.test", "ivxp-invalid|id", DEFAULT_QUOTE);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("pipe");
      }
    });

    it("should reject zero priceUsdc", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
          priceUsdc: 0,
          paymentAddress: TEST_ACCOUNTS.provider.address,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("priceUsdc");
      }
    });

    it("should reject negative priceUsdc", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
          priceUsdc: -5,
          paymentAddress: TEST_ACCOUNTS.provider.address,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
      }
    });

    it("should reject NaN priceUsdc", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
          priceUsdc: NaN,
          paymentAddress: TEST_ACCOUNTS.provider.address,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
      }
    });

    it("should reject malformed paymentAddress (wrong length)", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
          priceUsdc: 10,
          paymentAddress: "0x1234" as `0x${string}`,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("paymentAddress");
      }
    });

    it("should reject non-hex paymentAddress", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
          priceUsdc: 10,
          paymentAddress: "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" as `0x${string}`,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("paymentAddress");
      }
    });

    it("should reject zero address as paymentAddress", async () => {
      const { client } = createMockedClient();

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
          priceUsdc: 10,
          paymentAddress: "0x0000000000000000000000000000000000000000" as `0x${string}`,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
        expect((error as IVXPError).message).toContain("zero address");
      }
    });

    it("should not make payment or HTTP calls when validation fails", async () => {
      const mockPayment = new MockPaymentService();
      const mockHttp = new MockHttpClient();
      const { client } = createMockedClient({ mockPayment, mockHttp });

      try {
        await client.submitPayment("http://provider.test", "", DEFAULT_QUOTE);
      } catch {
        // Expected
      }

      expect(mockPayment.getSendCallCount()).toBe(0);
      expect(mockHttp.getPostCallCount()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Event emission (AC #1)
  // -------------------------------------------------------------------------

  describe("event emission", () => {
    it("should emit 'payment.sent' event after successful payment", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: DEFAULT_TX_HASH,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      const sentEvents: Array<{ txHash: string }> = [];
      client.on("payment.sent", (payload) => {
        sentEvents.push(payload);
      });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0].txHash).toBe(DEFAULT_TX_HASH);
    });

    it("should emit 'order.paid' event after successful notification", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid", {
        order_id: DEFAULT_ORDER_ID,
      });
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: DEFAULT_TX_HASH,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      const paidEvents: Array<{ orderId: string; txHash: string }> = [];
      client.on("order.paid", (payload) => {
        paidEvents.push(payload);
      });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      expect(paidEvents).toHaveLength(1);
      expect(paidEvents[0].orderId).toBe(DEFAULT_ORDER_ID);
      expect(paidEvents[0].txHash).toBe(DEFAULT_TX_HASH);
    });

    it("should emit 'payment.sent' but not 'order.paid' on partial success", async () => {
      const mockHttp = new MockHttpClient({
        postError: new Error("Notification failed"),
      });
      const mockPayment = new MockPaymentService({
        txHashToReturn: DEFAULT_TX_HASH,
      });
      const { client } = createMockedClient({ mockHttp, mockPayment });

      const sentEvents: Array<{ txHash: string }> = [];
      const paidEvents: Array<{ orderId: string; txHash: string }> = [];
      client.on("payment.sent", (payload) => sentEvents.push(payload));
      client.on("order.paid", (payload) => paidEvents.push(payload));

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
      } catch {
        // Expected: PartialSuccessError
      }

      expect(sentEvents).toHaveLength(1);
      expect(sentEvents[0].txHash).toBe(DEFAULT_TX_HASH);
      expect(paidEvents).toHaveLength(0);
    });

    it("should not emit any events when payment fails", async () => {
      const mockPayment = new MockPaymentService({
        sendError: new Error("Payment failed"),
      });
      const { client } = createMockedClient({ mockPayment });

      const sentEvents: unknown[] = [];
      const paidEvents: unknown[] = [];
      client.on("payment.sent", (payload) => sentEvents.push(payload));
      client.on("order.paid", (payload) => paidEvents.push(payload));

      try {
        await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);
      } catch {
        // Expected
      }

      expect(sentEvents).toHaveLength(0);
      expect(paidEvents).toHaveLength(0);
    });

    it("should not propagate event handler errors to submitPayment caller", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const { client } = createMockedClient({ mockHttp });

      client.on("payment.sent", () => {
        throw new Error("Handler error that should be swallowed");
      });

      // submitPayment should succeed despite the throwing handler
      const result = await client.submitPayment(
        "http://provider.test",
        DEFAULT_ORDER_ID,
        DEFAULT_QUOTE,
      );
      expect(result.txHash).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // USDC amount formatting
  // -------------------------------------------------------------------------

  describe("USDC amount formatting", () => {
    it("should format integer priceUsdc with 6 decimal places", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService();
      const { client } = createMockedClient({ mockHttp, mockPayment });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
        priceUsdc: 10,
        paymentAddress: TEST_ACCOUNTS.provider.address,
      });

      const sendCalls = mockPayment.getSendCalls();
      expect(sendCalls[0].amount).toBe("10.000000");
    });

    it("should format fractional priceUsdc with 6 decimal places", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockPayment = new MockPaymentService();
      const { client } = createMockedClient({ mockHttp, mockPayment });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, {
        priceUsdc: 8.5,
        paymentAddress: TEST_ACCOUNTS.provider.address,
      });

      const sendCalls = mockPayment.getSendCalls();
      expect(sendCalls[0].amount).toBe("8.500000");
    });
  });

  // -------------------------------------------------------------------------
  // Network configuration
  // -------------------------------------------------------------------------

  describe("network configuration", () => {
    it("should include the configured network in payment object", async () => {
      const orderStatusResponse = createMockOrderStatusResponse("paid");
      const mockHttp = new MockHttpClient({
        defaultPostResponse: orderStatusResponse,
      });
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });
      const mockPayment = new MockPaymentService();

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        network: "base-mainnet",
        cryptoService: mockCrypto,
        paymentService: mockPayment,
        httpClient: mockHttp,
      });

      await client.submitPayment("http://provider.test", DEFAULT_ORDER_ID, DEFAULT_QUOTE);

      const postCalls = mockHttp.getPostCalls();
      const body = postCalls[0].body as Record<string, unknown>;
      const payment = body.payment as Record<string, unknown>;
      expect(payment.network).toBe("base-mainnet");
    });
  });
});
