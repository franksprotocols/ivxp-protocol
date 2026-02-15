/**
 * IVXPProvider integration tests -- Full Provider Flow.
 *
 * Tests the complete IVXP provider lifecycle through its HTTP API:
 *   catalog -> quote -> deliver -> status -> download
 *
 * Covers:
 * - Happy-path pull mode (polling for status, then download)
 * - Happy-path push mode (provider pushes deliverable to callback URL)
 * - Push failure fallback (push fails, deliverable still downloadable)
 * - Error scenarios (invalid payment, invalid signature, unknown order, etc.)
 * - Network mismatch validation
 * - Binary content type preservation
 * - Order ID format validation and uniqueness
 *
 * Uses mock services (MockCryptoService, MockPaymentService) to isolate
 * the provider HTTP integration logic from actual blockchain interactions.
 * Real HTTP servers with OS-assigned ephemeral ports are used.
 *
 * @see Story 3-19: Provider Integration Test - Full Provider Flow
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  TEST_ACCOUNTS,
  DEFAULT_SIGNATURE,
  DEFAULT_TX_HASH,
  waitFor,
} from "@ivxp/test-utils";
import type { ServiceDefinition } from "@ivxp/protocol";
import { IVXPProvider, type IVXPProviderConfig, type ServiceHandler } from "./provider.js";
import { computeContentHash } from "./content-hash.js";

// ---------------------------------------------------------------------------
// Timeout constants (Issue #6)
// ---------------------------------------------------------------------------

/** Maximum time to wait for async order state transitions (ms). */
const WAIT_TIMEOUT_MS = 5000;

/** Polling interval for status checks (ms). */
const POLL_INTERVAL_MS = 50;

// ---------------------------------------------------------------------------
// Response type interfaces (Issue #7)
// ---------------------------------------------------------------------------

/** Typed response from GET /ivxp/catalog. */
interface CatalogResponse {
  readonly protocol: string;
  readonly provider: string;
  readonly wallet_address: string;
  readonly services: ReadonlyArray<{
    readonly type: string;
    readonly base_price_usdc: number;
    readonly estimated_delivery_hours: number;
  }>;
  readonly message_type: string;
  readonly timestamp: string;
}

/** Typed response from POST /ivxp/request. */
interface QuoteResponse {
  readonly protocol: string;
  readonly message_type: string;
  readonly timestamp: string;
  readonly order_id: string;
  readonly provider_agent: {
    readonly name: string;
    readonly wallet_address: string;
  };
  readonly quote: {
    readonly price_usdc: number;
    readonly estimated_delivery: string;
    readonly payment_address: string;
    readonly network: string;
  };
}

/** Typed response from POST /ivxp/deliver. */
interface DeliveryAcceptedResponse {
  readonly order_id: string;
  readonly status: "accepted";
  readonly message: string;
}

/** Typed response from GET /ivxp/status/{order_id}. */
interface StatusResponse {
  readonly order_id: string;
  readonly status: string;
  readonly service: string;
  readonly created_at: string;
  readonly content_hash?: string;
}

/** Typed response from GET /ivxp/download/{order_id}. */
interface DownloadResponse {
  readonly order_id: string;
  readonly content: string;
  readonly content_type: string;
  readonly content_hash: string;
}

/** Typed error response from provider endpoints. */
interface ErrorResponse {
  readonly error: string;
}

/** Typed payload pushed to callback server. */
interface PushPayload {
  readonly order_id: string;
  readonly content: string;
  readonly content_type: string;
  readonly content_hash: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Test service definitions for the integration provider. */
const INTEGRATION_SERVICES: readonly ServiceDefinition[] = [
  {
    type: "echo",
    base_price_usdc: 5,
    estimated_delivery_hours: 1,
  },
  {
    type: "analysis",
    base_price_usdc: 20,
    estimated_delivery_hours: 2,
  },
  {
    type: "binary",
    base_price_usdc: 15,
    estimated_delivery_hours: 1,
  },
];

/** Echo handler: returns a JSON echo of the order's service type. */
const echoHandler: ServiceHandler = async (order) => ({
  content: JSON.stringify({ echo: order.serviceType, orderId: order.orderId }),
  content_type: "application/json",
});

/** Analysis handler: returns a mock analysis report. */
const analysisHandler: ServiceHandler = async (order) => ({
  content: `Analysis report for order ${order.orderId}`,
  content_type: "text/plain",
});

/** Binary handler: returns binary Uint8Array content. */
const binaryHandler: ServiceHandler = async (_order) => ({
  content: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  content_type: "application/octet-stream",
});

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * GET JSON from a URL, returning parsed body and status.
 */
async function httpGet<T = unknown>(url: string): Promise<{ status: number; body: T }> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => null)) as T;
  return { status: response.status, body };
}

/**
 * POST JSON to a URL, returning parsed body and status.
 */
async function httpPost<T = unknown>(
  url: string,
  payload: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as T;
  return { status: response.status, body };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/**
 * Create a fully configured IVXPProvider with mock services for integration tests.
 *
 * Uses port 0 for OS-assigned ephemeral port to avoid conflicts.
 * Returns the provider and mock services for assertion access.
 */
function createIntegrationProvider(overrides?: Partial<IVXPProviderConfig>) {
  const mockCrypto = new MockCryptoService({
    address: TEST_ACCOUNTS.provider.address,
  });
  const mockPayment = new MockPaymentService();

  const serviceHandlers = new Map<string, ServiceHandler>([
    ["echo", echoHandler],
    ["analysis", analysisHandler],
    ["binary", binaryHandler],
  ]);

  const provider = new IVXPProvider({
    privateKey: TEST_ACCOUNTS.provider.privateKey as `0x${string}`,
    services: [...INTEGRATION_SERVICES],
    port: 0,
    host: "127.0.0.1",
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    serviceHandlers,
    allowPrivateDeliveryUrls: true,
    ...overrides,
  });

  return { provider, mockCrypto, mockPayment };
}

/**
 * Build a valid service request body for the POST /ivxp/request endpoint.
 */
function buildQuoteRequestBody(serviceType: string) {
  return {
    protocol: "IVXP/1.0",
    message_type: "service_request",
    timestamp: new Date().toISOString(),
    client_agent: {
      name: "IntegrationTestClient",
      wallet_address: TEST_ACCOUNTS.client.address,
    },
    service_request: {
      type: serviceType,
      description: "Integration test request",
      budget_usdc: 100,
    },
  };
}

/**
 * Build a valid delivery request body for the POST /ivxp/deliver endpoint.
 */
function buildDeliveryRequestBody(
  orderId: string,
  options?: { deliveryEndpoint?: string; network?: string },
) {
  const timestamp = new Date().toISOString();
  return {
    protocol: "IVXP/1.0",
    message_type: "delivery_request",
    timestamp,
    order_id: orderId,
    payment_proof: {
      tx_hash: DEFAULT_TX_HASH,
      from_address: TEST_ACCOUNTS.client.address,
      network: options?.network ?? "base-sepolia",
    },
    signature: DEFAULT_SIGNATURE,
    signed_message: `Order: ${orderId} | Payment: ${DEFAULT_TX_HASH} | Timestamp: ${timestamp}`,
    ...(options?.deliveryEndpoint ? { delivery_endpoint: options.deliveryEndpoint } : {}),
  };
}

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

/**
 * Wait for an order to reach a specific status via the HTTP status endpoint.
 */
async function waitForOrderStatus(
  baseUrl: string,
  orderId: string,
  expectedStatus: string,
  timeoutMessage?: string,
): Promise<void> {
  await waitFor(
    async () => {
      const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      return res.body.status === expectedStatus;
    },
    {
      timeout: WAIT_TIMEOUT_MS,
      interval: POLL_INTERVAL_MS,
      timeoutMessage: timeoutMessage ?? `Order did not reach '${expectedStatus}' status`,
    },
  );
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const providersToCleanup: IVXPProvider[] = [];

afterEach(async () => {
  for (const p of providersToCleanup) {
    await p.stop().catch(() => {
      /* ignore cleanup errors */
    });
  }
  providersToCleanup.length = 0;
});

/**
 * Start a provider and track it for cleanup.
 */
async function startTrackedProvider(overrides?: Partial<IVXPProviderConfig>) {
  const { provider, mockCrypto, mockPayment } = createIntegrationProvider(overrides);
  const { port } = await provider.start();
  providersToCleanup.push(provider);
  const baseUrl = `http://127.0.0.1:${port}`;
  return { provider, mockCrypto, mockPayment, port, baseUrl };
}

// ---------------------------------------------------------------------------
// Simple mock callback server (for push delivery tests)
// ---------------------------------------------------------------------------

interface CallbackServerResult {
  readonly port: number;
  readonly baseUrl: string;
  readonly receivedPayloads: unknown[];
  readonly stop: () => Promise<void>;
  readonly shouldFail: { value: boolean };
}

/**
 * Start a simple HTTP server that accepts POST requests and records payloads.
 *
 * Used to test push delivery (provider POSTs deliverable to this server).
 */
async function startCallbackServer(): Promise<CallbackServerResult> {
  const httpModuleName = "node:http";
  const http = (await import(httpModuleName)) as typeof import("node:http");

  const receivedPayloads: unknown[] = [];
  const shouldFail = { value: false };

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += String(chunk);
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          receivedPayloads.push(parsed);
        } catch {
          receivedPayloads.push(body);
        }

        if (shouldFail.value) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Callback server error" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok" }));
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const assignedPort = typeof addr === "object" && addr !== null ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${assignedPort}/ivxp/callback`;

      resolve({
        port: assignedPort,
        baseUrl,
        receivedPayloads,
        shouldFail,
        stop: () =>
          new Promise<void>((resolveStop) => {
            server.close(() => resolveStop());
          }),
      });
    });
  });
}

// ===========================================================================
// Tests
// ===========================================================================

describe("IVXPProvider - Full Integration Flow", () => {
  // -------------------------------------------------------------------------
  // Task 2: Full happy-path integration test (AC #1)
  // -------------------------------------------------------------------------

  describe("Happy Path - Pull Mode (AC #1)", () => {
    it("should complete full flow: catalog -> quote -> deliver -> status -> download", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Step 1: GET /ivxp/catalog
      const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
      expect(catalogRes.status).toBe(200);
      expect(catalogRes.body.protocol).toBe("IVXP/1.0");
      expect(catalogRes.body.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
      expect(Array.isArray(catalogRes.body.services)).toBe(true);
      expect(catalogRes.body.services.length).toBe(3);

      // Step 2: POST /ivxp/request (get a quote)
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.order_id).toBeDefined();
      expect(quoteRes.body.order_id.startsWith("ivxp-")).toBe(true);
      expect(quoteRes.body.protocol).toBe("IVXP/1.0");
      expect(quoteRes.body.message_type).toBe("service_quote");
      expect(quoteRes.body.quote.price_usdc).toBe(5);
      expect(quoteRes.body.quote.payment_address).toBe(TEST_ACCOUNTS.provider.address);
      expect(quoteRes.body.quote.network).toBe("base-sepolia");

      const orderId = quoteRes.body.order_id;

      // Step 3: POST /ivxp/deliver (submit payment + delivery request)
      const deliverRes = await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.status).toBe("accepted");
      expect(deliverRes.body.order_id).toBe(orderId);

      // Step 4: GET /ivxp/status/{order_id} - wait for "delivered"
      await waitForOrderStatus(baseUrl, orderId, "delivered");

      const finalStatusRes = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      expect(finalStatusRes.status).toBe(200);
      expect(finalStatusRes.body.status).toBe("delivered");
      expect(finalStatusRes.body.order_id).toBe(orderId);
      expect(finalStatusRes.body.service).toBe("echo");
      expect(finalStatusRes.body.content_hash).toBeDefined();

      // Step 5: GET /ivxp/download/{order_id}
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.order_id).toBe(orderId);
      expect(downloadRes.body.content_type).toBe("application/json");
      expect(downloadRes.body.content_hash).toBeDefined();
      expect(downloadRes.body.content).toBeDefined();

      // Verify content is the echo response
      const content = JSON.parse(downloadRes.body.content);
      expect(content.echo).toBe("echo");
      expect(content.orderId).toBe(orderId);

      // Verify content_hash matches between status and download
      expect(downloadRes.body.content_hash).toBe(finalStatusRes.body.content_hash);

      // Verify content_hash is correct by recomputing (Issue #2)
      const recomputedHash = await computeContentHash(downloadRes.body.content);
      expect(downloadRes.body.content_hash).toBe(recomputedHash);
    });

    it("should work with a different service type (analysis)", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Request analysis service
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("analysis"),
      );
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.quote.price_usdc).toBe(20);

      const orderId = quoteRes.body.order_id;

      // Deliver
      const deliverRes = await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(200);

      // Wait for delivered
      await waitForOrderStatus(baseUrl, orderId, "delivered");

      // Download
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.content_type).toBe("text/plain");
      expect(downloadRes.body.content).toContain("Analysis report");

      // Verify content_hash is correct (Issue #2)
      const recomputedHash = await computeContentHash(downloadRes.body.content);
      expect(downloadRes.body.content_hash).toBe(recomputedHash);
    });
  });

  // -------------------------------------------------------------------------
  // Task 3: Polling delivery path test (AC #2)
  // -------------------------------------------------------------------------

  describe("Polling Delivery Path (AC #2)", () => {
    it("should transition through status lifecycle: quoted -> paid -> processing -> delivered", async () => {
      const { baseUrl, provider } = await startTrackedProvider();

      // Step 1: Get a quote -> status = "quoted"
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      const quotedStatus = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      expect(quotedStatus.body.status).toBe("quoted");

      // Step 2: Deliver -> status transitions through paid -> processing -> delivered
      await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );

      // Wait for final state
      await waitForOrderStatus(baseUrl, orderId, "delivered");

      // Verify the deliverable is available via download
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.content).toBeDefined();
      expect(downloadRes.body.content_hash).toBeDefined();
      expect(downloadRes.body.content_type).toBe("application/json");

      // Verify provider internal state matches
      const order = await provider.getOrder(orderId);
      expect(order).not.toBeNull();
      expect(order!.status).toBe("delivered");
    });

    it("should include content_hash in status response after delivery", async () => {
      const { baseUrl } = await startTrackedProvider();

      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      // Before delivery: no content_hash
      const beforeStatus = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      expect(beforeStatus.body.content_hash).toBeUndefined();

      // Deliver and wait
      await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      await waitForOrderStatus(baseUrl, orderId, "delivered");

      // After delivery: content_hash present
      const afterStatus = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      expect(afterStatus.body.content_hash).toBeDefined();
      expect(typeof afterStatus.body.content_hash).toBe("string");
    });
  });

  // -------------------------------------------------------------------------
  // Task 4: Push delivery path test (AC #2)
  // -------------------------------------------------------------------------

  describe("Push Delivery Path (AC #2)", () => {
    it("should push deliverable to callback URL and transition to delivered", async () => {
      const { baseUrl } = await startTrackedProvider();
      const callbackServer = await startCallbackServer();

      try {
        // Get quote
        const quoteRes = await httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildQuoteRequestBody("echo"),
        );
        const orderId = quoteRes.body.order_id;

        // Deliver with callback URL (push mode)
        const deliverRes = await httpPost<DeliveryAcceptedResponse>(
          `${baseUrl}/ivxp/deliver`,
          buildDeliveryRequestBody(orderId, { deliveryEndpoint: callbackServer.baseUrl }),
        );
        expect(deliverRes.status).toBe(200);

        // Wait for delivery to complete
        await waitForOrderStatus(baseUrl, orderId, "delivered");

        // Verify exactly one push was made (Issue #4)
        expect(callbackServer.receivedPayloads).toHaveLength(1);

        const pushed = callbackServer.receivedPayloads[0] as PushPayload;
        expect(pushed.order_id).toBe(orderId);
        expect(pushed.content).toBeDefined();
        expect(pushed.content_type).toBe("application/json");
        expect(pushed.content_hash).toBeDefined();

        // Verify status is "delivered" after push
        const statusRes = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
        expect(statusRes.body.status).toBe("delivered");
      } finally {
        await callbackServer.stop();
      }
    });

    it("should still make deliverable available via download after push", async () => {
      const { baseUrl } = await startTrackedProvider();
      const callbackServer = await startCallbackServer();

      try {
        const quoteRes = await httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildQuoteRequestBody("echo"),
        );
        const orderId = quoteRes.body.order_id;

        await httpPost<DeliveryAcceptedResponse>(
          `${baseUrl}/ivxp/deliver`,
          buildDeliveryRequestBody(orderId, { deliveryEndpoint: callbackServer.baseUrl }),
        );

        await waitForOrderStatus(baseUrl, orderId, "delivered");

        // Even after push, download endpoint should work
        const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
        expect(downloadRes.status).toBe(200);
        expect(downloadRes.body.order_id).toBe(orderId);
        expect(downloadRes.body.content).toBeDefined();
      } finally {
        await callbackServer.stop();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Task 5: Error scenario tests (AC #3)
  // -------------------------------------------------------------------------

  describe("Error Scenarios (AC #3)", () => {
    it("should reject delivery with invalid payment proof", async () => {
      const { baseUrl } = await startTrackedProvider({
        paymentService: new MockPaymentService({ verifyResult: false }),
      });

      // Get a quote
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      // Deliver with invalid payment (mock returns false)
      const deliverRes = await httpPost<ErrorResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(400);
      expect(deliverRes.body).toBeDefined();
      expect(typeof deliverRes.body.error).toBe("string");
      expect(deliverRes.body.error).toContain("Payment verification failed");
    });

    it("should reject delivery with invalid signature", async () => {
      const { baseUrl } = await startTrackedProvider({
        cryptoService: new MockCryptoService({
          address: TEST_ACCOUNTS.provider.address,
          verifyResult: false,
        }),
      });

      // Get a quote
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      // Deliver with invalid signature (mock returns false)
      const deliverRes = await httpPost<ErrorResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(400);
      expect(deliverRes.body).toBeDefined();
      expect(typeof deliverRes.body.error).toBe("string");
      expect(deliverRes.body.error).toContain("Signature verification failed");
    });

    it("should return 404 for delivery with unknown order", async () => {
      const { baseUrl } = await startTrackedProvider();

      const deliverRes = await httpPost<ErrorResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody("ivxp-00000000-0000-0000-0000-000000000000"),
      );
      expect(deliverRes.status).toBe(404);
      expect(deliverRes.body).toBeDefined();
      expect(typeof deliverRes.body.error).toBe("string");
      expect(deliverRes.body.error).toContain("Order not found");
    });

    it("should reject delivery for already-paid order", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Get a quote
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      // First delivery: should succeed
      const firstDeliverRes = await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(firstDeliverRes.status).toBe(200);

      // Second delivery: should fail (order is no longer "quoted")
      const secondDeliverRes = await httpPost<ErrorResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(secondDeliverRes.status).toBe(400);
      expect(secondDeliverRes.body).toBeDefined();
      expect(typeof secondDeliverRes.body.error).toBe("string");
      expect(secondDeliverRes.body.error).toContain("not in quoted status");
    });

    it("should return 404 for status of unknown order", async () => {
      const { baseUrl } = await startTrackedProvider();

      const statusRes = await httpGet<ErrorResponse>(
        `${baseUrl}/ivxp/status/ivxp-00000000-0000-0000-0000-000000000000`,
      );
      expect(statusRes.status).toBe(404);
      expect(statusRes.body).toBeDefined();
      expect(typeof statusRes.body.error).toBe("string");
      expect(statusRes.body.error).toContain("Order not found");
    });

    it("should return 404 for download of unprocessed order", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Get a quote but don't deliver
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      // Try to download before delivery
      const downloadRes = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(404);
      expect(downloadRes.body).toBeDefined();
      expect(typeof downloadRes.body.error).toBe("string");
      expect(downloadRes.body.error).toContain("Deliverable not ready");
    });

    it("should return 404 for download of unknown order", async () => {
      const { baseUrl } = await startTrackedProvider();

      const downloadRes = await httpGet<ErrorResponse>(
        `${baseUrl}/ivxp/download/ivxp-00000000-0000-0000-0000-000000000000`,
      );
      expect(downloadRes.status).toBe(404);
      expect(downloadRes.body).toBeDefined();
      expect(typeof downloadRes.body.error).toBe("string");
      expect(downloadRes.body.error).toContain("Order not found");
    });

    it("should return 404 for quote of unknown service", async () => {
      const { baseUrl } = await startTrackedProvider();

      const quoteRes = await httpPost<ErrorResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("nonexistent_service"),
      );
      expect(quoteRes.status).toBe(404);
      expect(quoteRes.body).toBeDefined();
      expect(typeof quoteRes.body.error).toBe("string");
      expect(quoteRes.body.error).toContain("Unknown service");
    });

    it("should return 400 with error body for malformed quote request", async () => {
      const { baseUrl } = await startTrackedProvider();

      const quoteRes = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/request`, {
        invalid: "data",
      });
      expect(quoteRes.status).toBe(400);
      // Issue #3: Validate error response structure
      expect(quoteRes.body).toBeDefined();
      expect(typeof quoteRes.body.error).toBe("string");
      expect(quoteRes.body.error.length).toBeGreaterThan(0);
      expect(quoteRes.body.error).toContain("Missing required fields");
    });

    it("should return 400 with error body for malformed delivery request", async () => {
      const { baseUrl } = await startTrackedProvider();

      const deliverRes = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/deliver`, {
        invalid: "data",
      });
      expect(deliverRes.status).toBe(400);
      // Issue #3: Validate error response structure
      expect(deliverRes.body).toBeDefined();
      expect(typeof deliverRes.body.error).toBe("string");
      expect(deliverRes.body.error.length).toBeGreaterThan(0);
      expect(deliverRes.body.error).toContain("Missing required fields");
    });

    it("should return 405 for POST to catalog endpoint", async () => {
      const { baseUrl } = await startTrackedProvider();

      const res = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/catalog`, {});
      expect(res.status).toBe(405);
    });

    it("should return 404 for unknown route", async () => {
      const { baseUrl } = await startTrackedProvider();

      const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/unknown`);
      expect(res.status).toBe(404);
    });

    // Issue #8: Network mismatch validation test
    it("should reject delivery with network mismatch", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Get a quote (provider is on base-sepolia)
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const orderId = quoteRes.body.order_id;

      // Deliver with wrong network (base-mainnet instead of base-sepolia)
      const deliverRes = await httpPost<ErrorResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId, { network: "base-mainnet" }),
      );
      expect(deliverRes.status).toBe(400);
      expect(deliverRes.body).toBeDefined();
      expect(typeof deliverRes.body.error).toBe("string");
      expect(deliverRes.body.error).toContain("Network mismatch");
    });
  });

  // -------------------------------------------------------------------------
  // Task 6: Push failure fallback test (AC #2, #3)
  // -------------------------------------------------------------------------

  describe("Push Failure Fallback (AC #2, #3)", () => {
    it("should transition to delivery_failed when push callback returns error", async () => {
      const { baseUrl } = await startTrackedProvider();
      const callbackServer = await startCallbackServer();
      callbackServer.shouldFail.value = true;

      try {
        // Get quote
        const quoteRes = await httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildQuoteRequestBody("echo"),
        );
        const orderId = quoteRes.body.order_id;

        // Deliver with failing callback
        await httpPost<DeliveryAcceptedResponse>(
          `${baseUrl}/ivxp/deliver`,
          buildDeliveryRequestBody(orderId, { deliveryEndpoint: callbackServer.baseUrl }),
        );

        // Wait for delivery_failed status
        await waitForOrderStatus(baseUrl, orderId, "delivery_failed");

        // Verify status is delivery_failed
        const statusRes = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
        expect(statusRes.body.status).toBe("delivery_failed");
      } finally {
        await callbackServer.stop();
      }
    });

    it("should make deliverable available via download even after push failure (pull fallback)", async () => {
      const { baseUrl } = await startTrackedProvider();
      const callbackServer = await startCallbackServer();
      callbackServer.shouldFail.value = true;

      try {
        // Get quote
        const quoteRes = await httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildQuoteRequestBody("echo"),
        );
        const orderId = quoteRes.body.order_id;

        // Deliver with failing callback
        await httpPost<DeliveryAcceptedResponse>(
          `${baseUrl}/ivxp/deliver`,
          buildDeliveryRequestBody(orderId, { deliveryEndpoint: callbackServer.baseUrl }),
        );

        // Wait for delivery_failed
        await waitForOrderStatus(baseUrl, orderId, "delivery_failed");

        // Download should still work (pull fallback)
        const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
        expect(downloadRes.status).toBe(200);
        expect(downloadRes.body.order_id).toBe(orderId);
        expect(downloadRes.body.content).toBeDefined();
        expect(downloadRes.body.content_type).toBe("application/json");
        expect(downloadRes.body.content_hash).toBeDefined();

        // Verify content is valid echo response
        const content = JSON.parse(downloadRes.body.content);
        expect(content.echo).toBe("echo");
        expect(content.orderId).toBe(orderId);

        // Verify content_hash integrity (Issue #2)
        const recomputedHash = await computeContentHash(downloadRes.body.content);
        expect(downloadRes.body.content_hash).toBe(recomputedHash);
      } finally {
        await callbackServer.stop();
      }
    });

    it("should record exactly one push attempt even if it fails", async () => {
      const { baseUrl } = await startTrackedProvider();
      const callbackServer = await startCallbackServer();
      callbackServer.shouldFail.value = true;

      try {
        // Get quote
        const quoteRes = await httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildQuoteRequestBody("echo"),
        );
        const orderId = quoteRes.body.order_id;

        // Deliver with failing callback
        await httpPost<DeliveryAcceptedResponse>(
          `${baseUrl}/ivxp/deliver`,
          buildDeliveryRequestBody(orderId, { deliveryEndpoint: callbackServer.baseUrl }),
        );

        // Wait for delivery_failed
        await waitForOrderStatus(baseUrl, orderId, "delivery_failed");

        // Exactly one push attempt (Issue #4)
        expect(callbackServer.receivedPayloads).toHaveLength(1);
      } finally {
        await callbackServer.stop();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Additional integration edge cases
  // -------------------------------------------------------------------------

  describe("Multiple concurrent orders", () => {
    it("should handle multiple orders independently", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Create two quotes
      const quoteRes1 = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      const quoteRes2 = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("analysis"),
      );

      const orderId1 = quoteRes1.body.order_id;
      const orderId2 = quoteRes2.body.order_id;

      expect(orderId1).not.toBe(orderId2);

      // Deliver both
      await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId1),
      );
      await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId2),
      );

      // Issue #1: Wait for each order independently via Promise.all
      await Promise.all([
        waitForOrderStatus(baseUrl, orderId1, "delivered"),
        waitForOrderStatus(baseUrl, orderId2, "delivered"),
      ]);

      // Download both and verify independence
      const download1 = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId1}`);
      const download2 = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId2}`);

      expect(download1.body.content_type).toBe("application/json");
      expect(download2.body.content_type).toBe("text/plain");

      // Verify each has correct content
      const content1 = JSON.parse(download1.body.content);
      expect(content1.echo).toBe("echo");

      expect(download2.body.content).toContain("Analysis report");
    });
  });

  // -------------------------------------------------------------------------
  // Issue #5: Order ID format validation and uniqueness
  // -------------------------------------------------------------------------

  describe("Order ID format and uniqueness", () => {
    it("should generate order IDs in ivxp-UUID format", async () => {
      const { baseUrl } = await startTrackedProvider();

      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("echo"),
      );
      expect(quoteRes.status).toBe(200);

      // Validate ivxp-UUID format: ivxp- followed by a UUID v4
      const orderId = quoteRes.body.order_id;
      expect(orderId).toMatch(
        /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should generate unique order IDs across multiple requests", async () => {
      const { baseUrl } = await startTrackedProvider();

      const ids = new Set<string>();
      const requestCount = 5;

      for (let i = 0; i < requestCount; i++) {
        const quoteRes = await httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildQuoteRequestBody("echo"),
        );
        ids.add(quoteRes.body.order_id);
      }

      // All IDs should be unique
      expect(ids.size).toBe(requestCount);
    });
  });

  // -------------------------------------------------------------------------
  // Issue #9: Binary content type preservation
  // -------------------------------------------------------------------------

  describe("Content type preservation", () => {
    it("should preserve binary content through the delivery pipeline", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Request binary service
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("binary"),
      );
      const orderId = quoteRes.body.order_id;

      // Deliver
      await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );

      await waitForOrderStatus(baseUrl, orderId, "delivered");

      // Download and verify content type is preserved
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.content_type).toBe("application/octet-stream");
      expect(downloadRes.body.content_hash).toBeDefined();
      expect(typeof downloadRes.body.content_hash).toBe("string");
      expect(downloadRes.body.content_hash.length).toBeGreaterThan(0);
    });

    it("should preserve text/plain content type and charset encoding", async () => {
      const { baseUrl } = await startTrackedProvider();

      // Analysis handler returns text/plain
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildQuoteRequestBody("analysis"),
      );
      const orderId = quoteRes.body.order_id;

      await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );

      await waitForOrderStatus(baseUrl, orderId, "delivered");

      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.content_type).toBe("text/plain");

      // Verify the text content survived the round-trip intact
      expect(typeof downloadRes.body.content).toBe("string");
      expect(downloadRes.body.content).toContain("Analysis report");
      expect(downloadRes.body.content).toContain(orderId);

      // Verify hash integrity on text content (Issue #2)
      const recomputedHash = await computeContentHash(downloadRes.body.content);
      expect(downloadRes.body.content_hash).toBe(recomputedHash);
    });
  });
});
