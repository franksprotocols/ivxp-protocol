/**
 * downloadDeliverable() unit tests.
 *
 * Tests the IVXPClient.downloadDeliverable() method for:
 * - Successful download of JSON deliverables
 * - Successful download of markdown/text deliverables
 * - Zod schema validation of delivery response
 * - Error handling (network errors, validation errors, not found)
 * - Event emission ('order.delivered')
 * - Input validation (orderId, providerUrl)
 * - Save to file option (savePath)
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  createMockDeliveryResponse,
  resetOrderCounter,
} from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "./client.js";
import { ServiceUnavailableError, OrderNotFoundError } from "../errors/specific.js";
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

/** Expected deliverable endpoint URL for DEFAULT_ORDER_ID. */
const EXPECTED_DELIVERABLE_URL = `http://provider.test/ivxp/orders/${DEFAULT_ORDER_ID}/deliverable`;

/** Create a fully mocked client for downloadDeliverable tests. */
function createMockedClient(opts?: { mockHttp?: MockHttpClient }): {
  client: IVXPClient;
  mockHttp: MockHttpClient;
} {
  const mockCrypto = new MockCryptoService({ address: TEST_ACCOUNTS.client.address });
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

describe("IVXPClient.downloadDeliverable()", () => {
  beforeEach(() => {
    resetOrderCounter();
  });

  // -------------------------------------------------------------------------
  // Successful download -- JSON format (AC #1, #2, #3)
  // -------------------------------------------------------------------------

  describe("successful JSON deliverable download", () => {
    it("should download and validate a JSON deliverable", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "code_review_result",
          format: "json",
          content: { issues: ["unused import"], score: 8.5 },
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.status).toBe("completed");
      expect(result.deliverable.type).toBe("code_review_result");
      expect(result.deliverable.format).toBe("json");
      expect(result.deliverable.content).toEqual({ issues: ["unused import"], score: 8.5 });
    });

    it("should call GET {providerUrl}/ivxp/orders/{orderId}/deliverable", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      const calls = mockHttp.getGetCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(EXPECTED_DELIVERABLE_URL);
    });

    it("should strip trailing slash from provider URL", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      await client.downloadDeliverable("http://provider.test/", DEFAULT_ORDER_ID);

      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe(EXPECTED_DELIVERABLE_URL);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple formats (AC #2)
  // -------------------------------------------------------------------------

  describe("multiple format support", () => {
    it("should download a markdown deliverable", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "research_report",
          format: "markdown",
          content: "# Research Report\n\n## Summary\n\nThis is the result.",
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.deliverable.format).toBe("markdown");
      expect(result.deliverable.content).toContain("# Research Report");
    });

    it("should download a code deliverable", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "code_generation",
          format: "code",
          content: "function hello() { return 'world'; }",
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.deliverable.format).toBe("code");
      expect(result.deliverable.content).toContain("function hello");
    });

    it("should download a deliverable with object content (JSON)", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "analysis_result",
          format: "json",
          content: { metrics: { complexity: 12, coverage: 85.5 }, passed: true },
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      const content = result.deliverable.content as Record<string, unknown>;
      expect(content).toHaveProperty("metrics");
      expect(content).toHaveProperty("passed", true);
    });

    it("should handle deliverable with no format field", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "generic_result",
          content: "Some content",
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.deliverable.format).toBeUndefined();
      expect(result.deliverable.content).toBe("Some content");
    });
  });

  // -------------------------------------------------------------------------
  // Zod schema validation (AC #3)
  // -------------------------------------------------------------------------

  describe("deliverable structure validation", () => {
    it("should validate response against DeliveryResponseSchema", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      // Should have camelCase fields (Zod transform output)
      expect(result).toHaveProperty("orderId");
      expect(result).toHaveProperty("messageType");
      expect(result).toHaveProperty("providerAgent");
      expect(result.providerAgent).toHaveProperty("walletAddress");
      expect(result).toHaveProperty("deliverable");

      // Should NOT have snake_case fields (wire format)
      expect(result).not.toHaveProperty("order_id");
      expect(result).not.toHaveProperty("message_type");
      expect(result).not.toHaveProperty("provider_agent");
    });

    it("should throw IVXPError with INVALID_DELIVERABLE_FORMAT for invalid response", async () => {
      const mockHttp = new MockHttpClient({ defaultGetResponse: { invalid: true } });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_DELIVERABLE_FORMAT");
        expect((error as IVXPError).message).toMatch(/validation issue/);
      }
    });

    it("should throw IVXPError when deliverable field is missing", async () => {
      const incompleteResponse = {
        protocol: "IVXP/1.0",
        message_type: "service_delivery",
        timestamp: new Date().toISOString(),
        order_id: DEFAULT_ORDER_ID,
        status: "completed",
        provider_agent: {
          name: "TestProvider",
          wallet_address: TEST_ACCOUNTS.provider.address,
        },
        // deliverable missing
      };
      const mockHttp = new MockHttpClient({ defaultGetResponse: incompleteResponse });
      const { client } = createMockedClient({ mockHttp });

      await expect(
        client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow(/Invalid deliverable format/);
    });

    it("should not expose raw response data in validation error details", async () => {
      const mockHttp = new MockHttpClient({
        defaultGetResponse: { secret_key: "super-secret-value", invalid: true },
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        const ivxpError = error as IVXPError;
        expect(ivxpError.details).toHaveProperty("issueCount");
        expect(ivxpError.details).not.toHaveProperty("issues");
      }
    });

    it("should include optional fields when present", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        content_hash: "sha256:abc123",
        delivered_at: "2026-02-16T10:00:00Z",
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.contentHash).toBe("sha256:abc123");
      expect(result.deliveredAt).toBe("2026-02-16T10:00:00Z");
    });

    it("should normalize provider wallet address to lowercase", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        provider_agent: {
          name: "TestProvider",
          wallet_address: "0xABCDef1234567890ABCDEF1234567890AbCdEf12",
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(result.providerAgent.walletAddress).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("should throw ServiceUnavailableError on network failure", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Network error"),
      });
      const { client } = createMockedClient({ mockHttp });

      await expect(
        client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it("should re-throw IVXPError subclasses without wrapping", async () => {
      const mockHttp = new MockHttpClient({
        getError: new OrderNotFoundError("Order not found"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(OrderNotFoundError);
        expect((error as OrderNotFoundError).message).toBe("Order not found");
      }
    });

    it("should include provider URL in ServiceUnavailableError message", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Connection refused"),
      });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toContain("http://provider.test");
      }
    });

    it("should throw IVXPError with ORDER_ID_MISMATCH when response orderId differs from requested", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: "ivxp-different-order-id",
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("ORDER_ID_MISMATCH");
        expect((error as IVXPError).message).toContain(DEFAULT_ORDER_ID);
        expect((error as IVXPError).message).toContain("ivxp-different-order-id");
        expect((error as IVXPError).details).toHaveProperty("requestedOrderId", DEFAULT_ORDER_ID);
        expect((error as IVXPError).details).toHaveProperty(
          "receivedOrderId",
          "ivxp-different-order-id",
        );
      }
    });

    it("should not emit event when orderId mismatch is detected", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: "ivxp-different-order-id",
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const receivedEvents: unknown[] = [];
      client.on("order.delivered", (payload) => {
        receivedEvents.push(payload);
      });

      await expect(
        client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow();

      expect(receivedEvents).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("should reject empty provider URL", async () => {
      const { client } = createMockedClient();

      try {
        await client.downloadDeliverable("", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject non-HTTP protocol URLs", async () => {
      const { client } = createMockedClient();

      try {
        await client.downloadDeliverable("ftp://provider.test", DEFAULT_ORDER_ID);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject empty orderId", async () => {
      const { client } = createMockedClient();

      try {
        await client.downloadDeliverable("http://provider.test", "");
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
        await client.downloadDeliverable("http://provider.test", "order|injected");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST_PARAMS");
      }
    });

    it("should not make HTTP request when validation fails", async () => {
      const mockHttp = new MockHttpClient();
      const { client } = createMockedClient({ mockHttp });

      try {
        await client.downloadDeliverable("http://provider.test", "");
      } catch {
        // Expected
      }

      expect(mockHttp.getGetCallCount()).toBe(0);
    });

    it("should accept https:// provider URLs", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("https://provider.test", DEFAULT_ORDER_ID);

      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe(
        `https://provider.test/ivxp/orders/${DEFAULT_ORDER_ID}/deliverable`,
      );
    });

    it("should URL-encode orderId in the request path", async () => {
      const orderId = "ivxp-order with spaces";
      const wireResponse = createMockDeliveryResponse({ order_id: orderId });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      await client.downloadDeliverable("http://provider.test", orderId);

      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe(
        `http://provider.test/ivxp/orders/${encodeURIComponent(orderId)}/deliverable`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Event emission (AC #1)
  // -------------------------------------------------------------------------

  describe("event emission", () => {
    it("should emit 'order.delivered' event on successful download", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const receivedEvents: Array<{ orderId: string; format: string }> = [];
      client.on("order.delivered", (payload) => {
        receivedEvents.push(payload);
      });

      await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].orderId).toBe(DEFAULT_ORDER_ID);
      expect(receivedEvents[0].format).toBe("json");
    });

    it("should not emit event on download failure", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Network error"),
      });
      const { client } = createMockedClient({ mockHttp });

      const receivedEvents: unknown[] = [];
      client.on("order.delivered", (payload) => {
        receivedEvents.push(payload);
      });

      await expect(
        client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID),
      ).rejects.toThrow();

      expect(receivedEvents).toHaveLength(0);
    });

    it("should not propagate event handler errors to downloadDeliverable caller", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      client.on("order.delivered", () => {
        throw new Error("Handler error that should be swallowed");
      });

      // downloadDeliverable should succeed despite the throwing handler
      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    });
  });

  // -------------------------------------------------------------------------
  // Save to file (AC #4)
  // -------------------------------------------------------------------------

  describe("savePath option", () => {
    it("should save string content to file when savePath is provided", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "research_report",
          format: "markdown",
          content: "# Report\n\nThis is the deliverable content.",
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      // Use a temp file path for the test
      const tmpPath = `/tmp/ivxp-test-${Date.now()}-string.md`;

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID, {
        savePath: tmpPath,
      });

      // Verify result is still returned
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);

      // Verify file was written with correct content
      const fsModule = "fs/promises";
      const fs = await import(/* @vite-ignore */ fsModule);
      const fileContent = await fs.readFile(tmpPath, "utf-8");
      expect(fileContent).toBe("# Report\n\nThis is the deliverable content.");

      // Cleanup
      await fs.unlink(tmpPath);
    });

    it("should save object content as formatted JSON to file", async () => {
      const objectContent = { issues: ["unused import"], score: 9.0, summary: "Good code" };
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "code_review_result",
          format: "json",
          content: objectContent,
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const tmpPath = `/tmp/ivxp-test-${Date.now()}-object.json`;

      await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID, {
        savePath: tmpPath,
      });

      // Verify file was written with formatted JSON
      const fsModule = "fs/promises";
      const fs = await import(/* @vite-ignore */ fsModule);
      const fileContent = await fs.readFile(tmpPath, "utf-8");
      expect(JSON.parse(fileContent)).toEqual(objectContent);
      // Verify it's formatted with 2-space indent
      expect(fileContent).toBe(JSON.stringify(objectContent, null, 2));

      // Cleanup
      await fs.unlink(tmpPath);
    });

    it("should throw when savePath points to an invalid directory", async () => {
      const wireResponse = createMockDeliveryResponse({ order_id: DEFAULT_ORDER_ID });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      // Use a path with a non-existent directory
      const invalidPath = "/tmp/non-existent-dir-ivxp-test/file.json";

      // The IVXPError catch block will wrap the fs error as it's not an IVXPError
      await expect(
        client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID, {
          savePath: invalidPath,
        }),
      ).rejects.toThrow();
    });

    it("should still return deliverable result even when saving to file", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "analysis",
          format: "json",
          content: { result: "success" },
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const tmpPath = `/tmp/ivxp-test-${Date.now()}-return.json`;

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID, {
        savePath: tmpPath,
      });

      // Verify result is returned
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.deliverable.content).toEqual({ result: "success" });

      // Cleanup
      const fsModule = "fs/promises";
      const fs = await import(/* @vite-ignore */ fsModule);
      await fs.unlink(tmpPath);
    });
  });

  // -------------------------------------------------------------------------
  // Return type structure
  // -------------------------------------------------------------------------

  describe("return type", () => {
    it("should return a complete DeliveryResponseOutput", async () => {
      const wireResponse = createMockDeliveryResponse({
        order_id: DEFAULT_ORDER_ID,
        deliverable: {
          type: "analysis",
          format: "json",
          content: { result: "success" },
        },
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireResponse });
      const { client } = createMockedClient({ mockHttp });

      const result = await client.downloadDeliverable("http://provider.test", DEFAULT_ORDER_ID);

      // Verify all expected top-level fields
      expect(result.protocol).toBe("IVXP/1.0");
      expect(result.messageType).toBe("service_delivery");
      expect(result.timestamp).toBeDefined();
      expect(result.orderId).toBe(DEFAULT_ORDER_ID);
      expect(result.status).toBe("completed");
      expect(result.providerAgent).toBeDefined();
      expect(result.providerAgent.name).toBe("TestProvider");
      expect(result.deliverable).toBeDefined();
      expect(result.deliverable.type).toBe("analysis");
    });
  });
});
