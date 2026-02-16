/**
 * IVXPProvider Order Processing & Storage tests.
 *
 * Tests the processOrder pipeline, deliverable storage with SHA-256 content hashing,
 * push delivery mode, and order status transitions.
 *
 * Uses mocks from @ivxp/test-utils to avoid real blockchain calls.
 *
 * @see Story 3.17 - IVXPProvider Order Processing & Storage
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "crypto";
import {
  MockCryptoService,
  MockPaymentService,
  MockOrderStorage,
  TEST_ACCOUNTS,
} from "@ivxp/test-utils";
import type { ServiceDefinition, ServiceRequest } from "@ivxp/protocol";
import { IVXPProvider, type IVXPProviderConfig, type ServiceHandler } from "./provider.js";
import type { StoredDeliverable } from "./deliverable-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Test service definitions. */
const TEST_SERVICES: readonly ServiceDefinition[] = [
  {
    type: "code_review",
    base_price_usdc: 10,
    estimated_delivery_hours: 1,
  },
  {
    type: "translation",
    base_price_usdc: 25,
    estimated_delivery_hours: 2,
  },
];

/** Minimal valid config. */
const MINIMAL_CONFIG: IVXPProviderConfig = {
  privateKey: TEST_ACCOUNTS.provider.privateKey as `0x${string}`,
  services: TEST_SERVICES,
};

/**
 * Create a provider with mock services for order processing tests.
 */
function createProcessingTestProvider(
  overrides?: Partial<IVXPProviderConfig> & {
    verifyResult?: boolean;
    paymentVerifyResult?: boolean;
  },
): {
  provider: IVXPProvider;
  orderStore: MockOrderStorage;
} {
  const orderStore = new MockOrderStorage();
  const mockCrypto = new MockCryptoService({
    address: TEST_ACCOUNTS.provider.address,
    verifyResult: overrides?.verifyResult ?? true,
  });
  const mockPayment = new MockPaymentService({
    verifyResult: overrides?.paymentVerifyResult ?? true,
  });

  const provider = new IVXPProvider({
    ...MINIMAL_CONFIG,
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    orderStore,
    allowPrivateDeliveryUrls: true,
    ...overrides,
  });

  return { provider, orderStore };
}

/**
 * Build a minimal valid ServiceRequest.
 */
function buildServiceRequest(serviceType: string): ServiceRequest {
  return {
    protocol: "IVXP/1.0",
    message_type: "service_request",
    timestamp: new Date().toISOString(),
    client_agent: {
      name: "TestClient",
      wallet_address: TEST_ACCOUNTS.client.address,
    },
    service_request: {
      type: serviceType,
      description: "Test request",
      budget_usdc: 100,
    },
  };
}

/**
 * Create a quoted order and trigger delivery acceptance to get a "paid" order,
 * then wait for async processing to complete.
 */
async function createPaidOrderAndProcess(
  provider: IVXPProvider,
  options?: { deliveryEndpoint?: string },
): Promise<string> {
  const request = buildServiceRequest("code_review");
  const quote = await provider.handleQuoteRequest(request);
  const orderId = quote.order_id;

  await provider.handleDeliveryRequest({
    protocol: "IVXP/1.0",
    message_type: "delivery_request",
    timestamp: new Date().toISOString(),
    order_id: orderId,
    payment_proof: {
      tx_hash:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`,
      from_address: TEST_ACCOUNTS.client.address,
      network: "base-sepolia",
    },
    delivery_endpoint: options?.deliveryEndpoint,
    signature: "0xabcdef01" as `0x${string}`,
    signed_message: `Order: ${orderId}`,
  });

  return orderId;
}

/**
 * Wait for async order processing to complete.
 * Uses a short delay since the mock handler resolves immediately.
 */
async function waitForProcessing(ms = 150): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Track servers for cleanup
// ---------------------------------------------------------------------------

const serversToCleanup: IVXPProvider[] = [];

afterEach(async () => {
  for (const provider of serversToCleanup) {
    await provider.stop().catch(() => {
      /* ignore cleanup errors */
    });
  }
  serversToCleanup.length = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IVXPProvider - Order Processing & Storage", () => {
  // -------------------------------------------------------------------------
  // AC #1: Deliverable stored with SHA256 content_hash
  // -------------------------------------------------------------------------

  describe("deliverable storage with SHA256 content_hash (AC #1)", () => {
    it("should store deliverable with correct SHA256 content_hash for string content", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "Hello, World!",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.contentHash).toBe(
        createHash("sha256").update("Hello, World!").digest("hex"),
      );
    });

    it("should store deliverable with correct SHA256 content_hash for Buffer content", async () => {
      const bufferContent = Buffer.from("Binary data here");
      const handlerFn = vi.fn().mockResolvedValue({
        content: bufferContent,
        content_type: "application/octet-stream",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.contentHash).toBe(
        createHash("sha256").update(bufferContent).digest("hex"),
      );
    });

    it("should store deliverable content and content_type correctly", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: '{"result": "analysis complete"}',
        content_type: "application/json",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.content).toBe('{"result": "analysis complete"}');
      expect(deliverable!.contentType).toBe("application/json");
      expect(deliverable!.orderId).toBe(orderId);
    });

    it("should set createdAt timestamp on deliverable", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.createdAt).toBeDefined();
      expect(Date.parse(deliverable!.createdAt)).not.toBeNaN();
    });

    it("should store contentHash on the order record", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "Hello, World!",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.contentHash).toBe(createHash("sha256").update("Hello, World!").digest("hex"));
    });
  });

  // -------------------------------------------------------------------------
  // AC #2: Order status transitions to "delivered" on success
  // -------------------------------------------------------------------------

  describe("order status transitions to 'delivered' on success (AC #2)", () => {
    it("should transition to 'processing' status during handler execution", async () => {
      let capturedStatus: string | undefined;

      const handlerFn = vi.fn().mockImplementation(async (order) => {
        // Capture the status during handler execution
        const currentOrder = await provider.getOrder(order.orderId);
        capturedStatus = currentOrder?.status;
        return { content: "done", content_type: "text/plain" };
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      expect(capturedStatus).toBe("processing");
    });

    it("should transition to 'delivered' on success without delivery_endpoint (pull mode)", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result content",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivered");
    });
  });

  // -------------------------------------------------------------------------
  // AC #3: Order status transitions to "delivery_failed" on push failure
  //        (deliverable still stored)
  // -------------------------------------------------------------------------

  describe("push delivery and failure handling (AC #3)", () => {
    it("should transition to 'delivered' on successful push delivery", async () => {
      // Use a local HTTP server to simulate successful callback
      const httpModuleName = "node:http";
      const http = await import(/* @vite-ignore */ httpModuleName);

      // Start a mock callback server that accepts deliveries
      const callbackServer = http.createServer(
        (_req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "received" }));
        },
      );

      await new Promise<void>((resolve) => {
        callbackServer.listen(0, "127.0.0.1", () => resolve());
      });

      const addr = callbackServer.address() as { port: number };
      const callbackUrl = `http://127.0.0.1:${addr.port}/callback`;

      try {
        const handlerFn = vi.fn().mockResolvedValue({
          content: "push result",
          content_type: "text/plain",
        });
        const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

        const { provider } = createProcessingTestProvider({ serviceHandlers });
        const orderId = await createPaidOrderAndProcess(provider, {
          deliveryEndpoint: callbackUrl,
        });
        await waitForProcessing();

        const order = await provider.getOrder(orderId);
        expect(order!.status).toBe("delivered");
      } finally {
        await new Promise<void>((resolve) => callbackServer.close(() => resolve()));
      }
    });

    it("should transition to 'delivery_failed' when push delivery fails", async () => {
      // Use a non-existent URL to simulate push failure
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result content",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "http://127.0.0.1:1/nonexistent-callback",
      });
      await waitForProcessing(300);

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivery_failed");
    });

    it("should still store deliverable even when push delivery fails", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result content",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "http://127.0.0.1:1/nonexistent-callback",
      });
      await waitForProcessing(300);

      // Deliverable should be stored even though push failed
      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.content).toBe("result content");
      expect(deliverable!.contentType).toBe("text/plain");
      expect(deliverable!.contentHash).toBe(
        createHash("sha256").update("result content").digest("hex"),
      );
    });

    it("should transition to 'delivery_failed' when callback server returns non-2xx status", async () => {
      const httpModuleName = "node:http";
      const http = await import(/* @vite-ignore */ httpModuleName);

      // Mock callback server that returns 500
      const callbackServer = http.createServer(
        (_req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
        },
      );

      await new Promise<void>((resolve) => {
        callbackServer.listen(0, "127.0.0.1", () => resolve());
      });

      const addr = callbackServer.address() as { port: number };
      const callbackUrl = `http://127.0.0.1:${addr.port}/callback`;

      try {
        const handlerFn = vi.fn().mockResolvedValue({
          content: "push result",
          content_type: "text/plain",
        });
        const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

        const { provider } = createProcessingTestProvider({ serviceHandlers });
        const orderId = await createPaidOrderAndProcess(provider, {
          deliveryEndpoint: callbackUrl,
        });
        await waitForProcessing();

        const order = await provider.getOrder(orderId);
        expect(order!.status).toBe("delivery_failed");

        // Deliverable should still be stored
        const deliverable = provider.getDeliverable(orderId);
        expect(deliverable).toBeDefined();
      } finally {
        await new Promise<void>((resolve) => callbackServer.close(() => resolve()));
      }
    });
  });

  // -------------------------------------------------------------------------
  // getDeliverable() accessor
  // -------------------------------------------------------------------------

  describe("getDeliverable()", () => {
    it("should return undefined for non-existent order", () => {
      const { provider } = createProcessingTestProvider();

      const result = provider.getDeliverable("non-existent-order");
      expect(result).toBeUndefined();
    });

    it("should return stored deliverable after processing", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "deliverable content",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.orderId).toBe(orderId);
    });
  });

  // -------------------------------------------------------------------------
  // Handler error handling
  // -------------------------------------------------------------------------

  describe("handler error handling", () => {
    it("should transition to 'delivery_failed' when handler throws", async () => {
      const handlerFn = vi.fn().mockRejectedValue(new Error("Handler error"));
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivery_failed");
    });

    it("should not store deliverable when handler throws", async () => {
      const handlerFn = vi.fn().mockRejectedValue(new Error("Handler error"));
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeUndefined();
    });

    it("should not set contentHash on order when handler throws", async () => {
      const handlerFn = vi.fn().mockRejectedValue(new Error("Handler error"));
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({ serviceHandlers });
      const orderId = await createPaidOrderAndProcess(provider);
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.contentHash).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Push delivery with binary (Uint8Array) content
  // -------------------------------------------------------------------------

  describe("binary content push delivery", () => {
    it("should push binary content as base64-encoded payload", async () => {
      const httpModuleName = "node:http";
      const http = await import(/* @vite-ignore */ httpModuleName);

      let receivedBody: string = "";

      // Start a mock callback server that captures the request body
      const callbackServer = http.createServer(
        (req: import("http").IncomingMessage, res: import("http").ServerResponse) => {
          const chunks: Uint8Array[] = [];
          req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
          req.on("end", () => {
            receivedBody = Buffer.concat(chunks).toString("utf-8");
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "received" }));
          });
        },
      );

      await new Promise<void>((resolve) => {
        callbackServer.listen(0, "127.0.0.1", () => resolve());
      });

      const addr = callbackServer.address() as { port: number };
      const callbackUrl = `http://127.0.0.1:${addr.port}/callback`;

      try {
        const binaryContent = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
        const handlerFn = vi.fn().mockResolvedValue({
          content: binaryContent,
          content_type: "application/octet-stream",
        });
        const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

        const { provider } = createProcessingTestProvider({ serviceHandlers });
        const orderId = await createPaidOrderAndProcess(provider, {
          deliveryEndpoint: callbackUrl,
        });
        await waitForProcessing();

        const order = await provider.getOrder(orderId);
        expect(order!.status).toBe("delivered");

        // Verify the body was sent with base64 encoding
        const parsed = JSON.parse(receivedBody);
        expect(parsed.content_encoding).toBe("base64");
        expect(parsed.content).toBe(Buffer.from(binaryContent).toString("base64"));
        expect(parsed.content_type).toBe("application/octet-stream");
      } finally {
        await new Promise<void>((resolve) => callbackServer.close(() => resolve()));
      }
    });
  });

  // -------------------------------------------------------------------------
  // SSRF URL validation
  // -------------------------------------------------------------------------

  describe("SSRF URL validation", () => {
    it("should reject delivery to localhost when allowPrivateDeliveryUrls is false", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({
        serviceHandlers,
        allowPrivateDeliveryUrls: false,
      });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "http://localhost:9999/callback",
      });
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivery_failed");
    });

    it("should reject delivery to private IP (10.x) when allowPrivateDeliveryUrls is false", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({
        serviceHandlers,
        allowPrivateDeliveryUrls: false,
      });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "http://10.0.0.1:8080/callback",
      });
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivery_failed");
    });

    it("should reject delivery to private IP (192.168.x) when allowPrivateDeliveryUrls is false", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({
        serviceHandlers,
        allowPrivateDeliveryUrls: false,
      });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "http://192.168.1.1:8080/callback",
      });
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivery_failed");
    });

    it("should reject delivery with ftp:// scheme", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "result",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({
        serviceHandlers,
        allowPrivateDeliveryUrls: false,
      });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "ftp://example.com/file",
      });
      await waitForProcessing();

      const order = await provider.getOrder(orderId);
      expect(order!.status).toBe("delivery_failed");
    });

    it("should still store deliverable when SSRF validation fails", async () => {
      const handlerFn = vi.fn().mockResolvedValue({
        content: "protected result",
        content_type: "text/plain",
      });
      const serviceHandlers = new Map<string, ServiceHandler>([["code_review", handlerFn]]);

      const { provider } = createProcessingTestProvider({
        serviceHandlers,
        allowPrivateDeliveryUrls: false,
      });
      const orderId = await createPaidOrderAndProcess(provider, {
        deliveryEndpoint: "http://localhost:9999/callback",
      });
      await waitForProcessing();

      // Deliverable should still be stored for pull download
      const deliverable = provider.getDeliverable(orderId);
      expect(deliverable).toBeDefined();
      expect(deliverable!.content).toBe("protected result");
    });
  });
});
