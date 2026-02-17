/**
 * TS Client <-> TS Provider Interoperability Tests
 *
 * Story 6.5: Verifies that the TypeScript SDK Client and Provider
 * implementations work together correctly over real HTTP.
 *
 * Tests the complete protocol flow:
 *   catalog -> quote -> pay -> deliver -> status -> download
 *
 * Test architecture:
 * - Each describe block creates its own isolated ProviderFixture to prevent
 *   cross-test state leakage (test isolation).
 * - Uses real IVXPProvider HTTP server with mock crypto/payment services.
 * - Uses real IVXPClient making actual HTTP requests via fetch.
 * - No external dependencies required (no Anvil, no blockchain).
 *
 * Acceptance criteria covered:
 * - AC #1: TS Client can successfully call TS Provider services
 * - AC #2: Complete protocol flow succeeds (catalog -> quote -> pay -> deliver -> download)
 * - AC #3: All protocol messages are validated
 * - AC #4: Tests run in CI/CD pipeline (see .github/workflows/interop-tests.yml)
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_ACCOUNTS, MockCryptoService, MockPaymentService } from "@ivxp/test-utils";
import { startProviderFixture, type ProviderFixture } from "./fixtures/provider-fixture.js";
import { createClientFixture, type ClientFixture } from "./fixtures/client-fixture.js";
import {
  httpGet,
  httpPost,
  buildServiceRequestBody,
  buildDeliveryRequestBody,
  waitForCondition,
  FAST_POLL,
} from "./utils/test-helpers.js";
import {
  assertValidCatalog,
  assertValidQuote,
  assertValidDeliveryAccepted,
  assertValidStatusResponse,
  assertValidDownloadResponse,
  assertValidContentHash,
  hasSnakeCaseFields,
  hasDeepSnakeCaseFields,
} from "./utils/assertions.js";
import { computeContentHash } from "../../core/content-hash.js";

// ---------------------------------------------------------------------------
// Test configuration constants
// ---------------------------------------------------------------------------

/** Maximum time for provider startup in beforeAll hooks. */
const SETUP_TIMEOUT_MS = 15_000;

/** Maximum time for individual test cases. */
const TEST_TIMEOUT_MS = 30_000;

/** Maximum time for polling-based tests (delivery wait). */
const POLL_TIMEOUT_MS = FAST_POLL.timeout;

/** Threshold for response time assertions (ms). */
const RESPONSE_TIME_THRESHOLD_MS = 2_000;

// ---------------------------------------------------------------------------
// Response types for typed HTTP calls
// ---------------------------------------------------------------------------

interface CatalogResponse {
  readonly protocol: string;
  readonly message_type: string;
  readonly timestamp: string;
  readonly provider: string;
  readonly wallet_address: string;
  readonly services: ReadonlyArray<{
    readonly type: string;
    readonly base_price_usdc: number;
    readonly estimated_delivery_hours: number;
  }>;
}

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

interface DeliveryAcceptedResponse {
  readonly order_id: string;
  readonly status: "accepted";
  readonly message: string;
}

interface StatusResponse {
  readonly order_id: string;
  readonly status: string;
  readonly service: string;
  readonly created_at: string;
  readonly content_hash?: string;
}

interface DownloadResponse {
  readonly order_id: string;
  readonly content: string;
  readonly content_type: string;
  readonly content_hash: string;
}

/** Error response from provider endpoints. May include optional status_code. */
interface ErrorResponse {
  readonly error: string;
  readonly status_code?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a full order lifecycle: quote -> deliver -> wait -> download.
 * Returns the orderId and download response for further assertions.
 */
async function runFullOrderLifecycle(
  baseUrl: string,
  serviceType: string,
  description = "Lifecycle test",
): Promise<{ orderId: string; download: DownloadResponse }> {
  const quoteRes = await httpPost<QuoteResponse>(
    `${baseUrl}/ivxp/request`,
    buildServiceRequestBody(serviceType, description),
  );
  const orderId = quoteRes.body.order_id;

  await httpPost(`${baseUrl}/ivxp/deliver`, buildDeliveryRequestBody(orderId));

  await waitForCondition(
    async () => {
      const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      return res.body.status === "delivered";
    },
    { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
  );

  const download = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
  return { orderId, download: download.body };
}

// ===========================================================================
// AC #1: TS Client can successfully call TS Provider services
// ===========================================================================

describe("AC #1: TS Client calls TS Provider services", () => {
  let provider: ProviderFixture;
  let client: ClientFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    client = createClientFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should fetch service catalog via SDK client", async () => {
    const catalog = await client.client.getCatalog(baseUrl);

    expect(catalog.provider).toBeDefined();
    expect(catalog.walletAddress.toLowerCase()).toBe(TEST_ACCOUNTS.provider.address.toLowerCase());
    expect(catalog.services).toHaveLength(2);
    expect(catalog.services[0].type).toBe("text_echo");
    expect(catalog.services[0].basePriceUsdc).toBe(1);
    expect(catalog.services[1].type).toBe("json_transform");
    expect(catalog.services[1].basePriceUsdc).toBe(5);
  });

  it("should request a quote via SDK client", async () => {
    const quote = await client.client.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "Interop test echo",
      budgetUsdc: 10,
    });

    expect(quote.orderId).toBeDefined();
    expect(quote.orderId.startsWith("ivxp-")).toBe(true);
    expect(quote.quote.priceUsdc).toBe(1);
    expect(quote.quote.paymentAddress.toLowerCase()).toBe(
      TEST_ACCOUNTS.provider.address.toLowerCase(),
    );
    expect(quote.quote.network).toBe("base-sepolia");
  });

  it("should fetch catalog via direct HTTP GET", async () => {
    const res = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);

    expect(res.status).toBe(200);
    expect(res.body.protocol).toBe("IVXP/1.0");
    expect(res.body.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
    expect(res.body.services).toHaveLength(2);
  });
});

// ===========================================================================
// AC #2: Complete protocol flow succeeds
// ===========================================================================

describe("AC #2: Complete protocol flow (catalog -> quote -> pay -> deliver -> download)", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it(
    "should complete full flow via direct HTTP calls",
    async () => {
      // Step 1: GET /ivxp/catalog
      const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
      expect(catalogRes.status).toBe(200);
      expect(catalogRes.body.services.length).toBeGreaterThan(0);

      // Step 2: POST /ivxp/request (get a quote)
      const quoteRes = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo", "Full flow test"),
      );
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.order_id).toBeDefined();
      const orderId = quoteRes.body.order_id;

      // Step 3: POST /ivxp/deliver (submit payment + delivery request)
      const deliverRes = await httpPost<DeliveryAcceptedResponse>(
        `${baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.status).toBe("accepted");

      // Step 4: GET /ivxp/status/{order_id} - wait for "delivered"
      await waitForCondition(
        async () => {
          const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
          return res.body.status === "delivered";
        },
        { timeout: POLL_TIMEOUT_MS, message: `Order ${orderId} did not reach 'delivered'` },
      );

      const statusRes = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe("delivered");
      expect(statusRes.body.content_hash).toBeDefined();

      // Step 5: GET /ivxp/download/{order_id}
      const downloadRes = await httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${orderId}`);
      expect(downloadRes.status).toBe(200);
      expect(downloadRes.body.order_id).toBe(orderId);
      expect(downloadRes.body.content).toBeDefined();
      expect(downloadRes.body.content_type).toBe("application/json");
      expect(downloadRes.body.content_hash).toBeDefined();

      // Verify content hash matches between status and download
      expect(downloadRes.body.content_hash).toBe(statusRes.body.content_hash);
    },
    TEST_TIMEOUT_MS,
  );

  it("should verify content hash integrity via round-trip recomputation", async () => {
    const { orderId, download } = await runFullOrderLifecycle(baseUrl, "text_echo", "Hash test");

    // Verify content_hash format is valid SHA-256
    assertValidContentHash(download.content_hash);

    // Recompute content hash from downloaded content and verify match
    const recomputedHash = await computeContentHash(download.content);
    expect(download.content_hash).toBe(recomputedHash);

    // Verify the content itself is parseable and references the order
    const content = JSON.parse(download.content);
    expect(content.order_id).toBe(orderId);

    // Verify status endpoint also reports the same hash
    const statusRes = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${orderId}`);
    expect(statusRes.body.content_hash).toBe(download.content_hash);
  });

  it("should work with different service types", async () => {
    const { download } = await runFullOrderLifecycle(baseUrl, "json_transform", "Transform test");

    expect(download.content_type).toBe("application/json");
    const content = JSON.parse(download.content);
    expect(content.transformed).toBe(true);
    expect(content.service).toBe("json_transform");
  });

  it(
    "should handle multiple concurrent orders with unique IDs and correct content",
    async () => {
      const count = 5;

      // Create orders in parallel
      const quotePromises = Array.from({ length: count }, (_, i) =>
        httpPost<QuoteResponse>(
          `${baseUrl}/ivxp/request`,
          buildServiceRequestBody("text_echo", `Concurrent test ${i}`),
        ),
      );
      const quoteResults = await Promise.all(quotePromises);
      const orderIds = quoteResults.map((r) => r.body.order_id);

      // All should have unique order IDs
      const uniqueIds = new Set(orderIds);
      expect(uniqueIds.size).toBe(count);

      // All quotes should succeed
      for (const r of quoteResults) {
        expect(r.status).toBe(200);
        expect(r.body.order_id.startsWith("ivxp-")).toBe(true);
      }

      // Deliver all in parallel
      const deliverResults = await Promise.all(
        orderIds.map((id) =>
          httpPost<DeliveryAcceptedResponse>(
            `${baseUrl}/ivxp/deliver`,
            buildDeliveryRequestBody(id),
          ),
        ),
      );
      for (const r of deliverResults) {
        expect(r.status).toBe(200);
        expect(r.body.status).toBe("accepted");
      }

      // Wait for all to be delivered
      await Promise.all(
        orderIds.map((id) =>
          waitForCondition(
            async () => {
              const res = await httpGet<StatusResponse>(`${baseUrl}/ivxp/status/${id}`);
              return res.body.status === "delivered";
            },
            { timeout: POLL_TIMEOUT_MS },
          ),
        ),
      );

      // Download all and verify each has correct order_id and valid content hash
      const downloads = await Promise.all(
        orderIds.map((id) => httpGet<DownloadResponse>(`${baseUrl}/ivxp/download/${id}`)),
      );

      for (let i = 0; i < count; i++) {
        expect(downloads[i].status).toBe(200);
        expect(downloads[i].body.order_id).toBe(orderIds[i]);
        assertValidContentHash(downloads[i].body.content_hash);

        // Verify content hash integrity
        const recomputed = await computeContentHash(downloads[i].body.content);
        expect(downloads[i].body.content_hash).toBe(recomputed);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it("should respond within acceptable time thresholds", async () => {
    // Catalog response time
    const catalogStart = performance.now();
    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    const catalogDuration = performance.now() - catalogStart;
    expect(catalogRes.status).toBe(200);
    expect(catalogDuration).toBeLessThan(RESPONSE_TIME_THRESHOLD_MS);

    // Quote response time
    const quoteStart = performance.now();
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const quoteDuration = performance.now() - quoteStart;
    expect(quoteRes.status).toBe(200);
    expect(quoteDuration).toBeLessThan(RESPONSE_TIME_THRESHOLD_MS);
  });
});

// ===========================================================================
// AC #3: All protocol messages are validated
// ===========================================================================

describe("AC #3: Protocol message validation", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should return valid IVXP/1.0 catalog response", async () => {
    const res = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/catalog`);
    expect(res.status).toBe(200);
    assertValidCatalog(res.body);
  });

  it("should return valid IVXP/1.0 quote response", async () => {
    const res = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(res.status).toBe(200);
    assertValidQuote(res.body);
  });

  it("should return valid delivery accepted response", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const deliverRes = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(deliverRes.status).toBe(200);
    assertValidDeliveryAccepted(deliverRes.body);
  });

  it("should return valid status response", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const statusRes = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/status/${orderId}`);
    expect(statusRes.status).toBe(200);
    assertValidStatusResponse(statusRes.body, orderId);
  });

  it("should return valid download response with content hash", async () => {
    const { orderId } = await runFullOrderLifecycle(baseUrl, "text_echo");

    const downloadRes = await httpGet<Record<string, unknown>>(
      `${baseUrl}/ivxp/download/${orderId}`,
    );
    expect(downloadRes.status).toBe(200);
    assertValidDownloadResponse(downloadRes.body, orderId);
    assertValidContentHash(downloadRes.body.content_hash as string);
  });

  it("should use snake_case field naming in all wire protocol messages", async () => {
    // Catalog
    const catalogRes = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/catalog`);
    expect(hasSnakeCaseFields(catalogRes.body)).toBe(true);

    // Quote
    const quoteRes = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(hasSnakeCaseFields(quoteRes.body)).toBe(true);
    expect(hasDeepSnakeCaseFields(quoteRes.body)).toBe(true);

    const orderId = (quoteRes.body as unknown as QuoteResponse).order_id;

    // Delivery accepted
    const deliverRes = await httpPost<Record<string, unknown>>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(hasSnakeCaseFields(deliverRes.body)).toBe(true);

    // Status
    const statusRes = await httpGet<Record<string, unknown>>(`${baseUrl}/ivxp/status/${orderId}`);
    expect(hasSnakeCaseFields(statusRes.body)).toBe(true);
  });

  it("should include IVXP/1.0 protocol version in catalog and quote", async () => {
    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    expect(catalogRes.body.protocol).toBe("IVXP/1.0");

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(quoteRes.body.protocol).toBe("IVXP/1.0");
  });

  it("should include valid ISO 8601 timestamps", async () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

    const catalogRes = await httpGet<CatalogResponse>(`${baseUrl}/ivxp/catalog`);
    expect(catalogRes.body.timestamp).toMatch(isoRegex);

    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    expect(quoteRes.body.timestamp).toMatch(isoRegex);
  });

  it("should generate unique order IDs with ivxp- prefix", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await httpPost<QuoteResponse>(
        `${baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      expect(res.body.order_id.startsWith("ivxp-")).toBe(true);
      ids.add(res.body.order_id);
    }
    expect(ids.size).toBe(5);
  });
});

// ===========================================================================
// EIP-191 Signature verification
// ===========================================================================

describe("EIP-191 Signature verification", () => {
  it("should verify signature during delivery and reject invalid signatures", async () => {
    // Provider with signature verification that rejects
    const mockCrypto = new MockCryptoService({
      address: TEST_ACCOUNTS.provider.address,
      verifyResult: false,
    });
    const mockPayment = new MockPaymentService();

    const provider = await startProviderFixture({
      providerOverrides: {
        cryptoService: mockCrypto,
        paymentService: mockPayment,
      },
    });

    try {
      const quoteRes = await httpPost<QuoteResponse>(
        `${provider.baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      const orderId = quoteRes.body.order_id;

      const deliverRes = await httpPost<ErrorResponse>(
        `${provider.baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );

      // Provider should reject due to invalid signature
      expect(deliverRes.status).toBe(400);
      expect(deliverRes.body.error).toContain("Signature verification failed");
    } finally {
      await provider.stop();
    }
  });

  it("should accept delivery when signature verification passes", async () => {
    const provider = await startProviderFixture();

    try {
      const quoteRes = await httpPost<QuoteResponse>(
        `${provider.baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      const orderId = quoteRes.body.order_id;

      const deliverRes = await httpPost<DeliveryAcceptedResponse>(
        `${provider.baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );

      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.status).toBe("accepted");

      // Verify the provider's crypto service was called with verify()
      const verifyCalls = provider.mockCrypto.getVerifyCalls();
      expect(verifyCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      await provider.stop();
    }
  });
});

// ===========================================================================
// Event system tests
// ===========================================================================

describe("Event system", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should emit catalog.received event when fetching catalog", async () => {
    const client = createClientFixture();
    const events: Array<{ provider: string; servicesCount: number }> = [];

    client.client.on("catalog.received", (payload) => {
      events.push(payload);
    });

    await client.client.getCatalog(baseUrl);

    expect(events).toHaveLength(1);
    expect(events[0].servicesCount).toBe(2);
    expect(typeof events[0].provider).toBe("string");
  });

  it("should emit order.quoted event when requesting a quote", async () => {
    const client = createClientFixture();
    const events: Array<{ orderId: string; priceUsdc: string }> = [];

    client.client.on("order.quoted", (payload) => {
      events.push(payload);
    });

    await client.client.requestQuote(baseUrl, {
      serviceType: "text_echo",
      description: "Event test",
      budgetUsdc: 10,
    });

    expect(events).toHaveLength(1);
    expect(events[0].orderId).toBeDefined();
    expect(events[0].orderId.startsWith("ivxp-")).toBe(true);
  });

  it("should support unsubscribing from events via off()", async () => {
    const client = createClientFixture();
    const events: unknown[] = [];

    const handler = (payload: unknown) => {
      events.push(payload);
    };

    client.client.on("catalog.received", handler);
    await client.client.getCatalog(baseUrl);
    expect(events).toHaveLength(1);

    client.client.off("catalog.received", handler);
    await client.client.getCatalog(baseUrl);
    expect(events).toHaveLength(1); // Should not have increased
  });
});

// ===========================================================================
// Error scenarios
// ===========================================================================

describe("Error scenarios", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should return 404 for unknown endpoints", async () => {
    const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("should return 405 for wrong HTTP method on catalog", async () => {
    const res = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/catalog`, {});
    expect(res.status).toBe(405);
    expect(res.body.error).toBeDefined();
  });

  it("should return 405 for GET on POST-only endpoints", async () => {
    const requestRes = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/request`);
    expect(requestRes.status).toBe(405);

    const deliverRes = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/deliver`);
    expect(deliverRes.status).toBe(405);
  });

  it("should return error for delivery with unknown order ID", async () => {
    const res = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody("ivxp-nonexistent-order"),
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("should return 404 for status of unknown order", async () => {
    const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/status/ivxp-nonexistent-order`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("should return 404 for download of unknown order", async () => {
    const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/download/ivxp-nonexistent-order`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("should return error for download before delivery", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const downloadRes = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/download/${orderId}`);
    expect(downloadRes.status).toBeGreaterThanOrEqual(400);
    expect(downloadRes.body.error).toBeDefined();
  });

  it("should return error for delivery with wrong network", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const res = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId, { network: "ethereum-mainnet" }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Network mismatch");
  });

  it("should return error for request with unknown service type", async () => {
    const res = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("nonexistent_service"),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeDefined();
  });

  it("should return error for duplicate delivery on same order", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    // First delivery should succeed
    const firstDeliver = await httpPost<DeliveryAcceptedResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(firstDeliver.status).toBe(200);

    // Second delivery on same order should fail (order no longer in "quoted" status)
    const secondDeliver = await httpPost<ErrorResponse>(
      `${baseUrl}/ivxp/deliver`,
      buildDeliveryRequestBody(orderId),
    );
    expect(secondDeliver.status).toBe(400);
    expect(secondDeliver.body.error).toBeDefined();
  });

  it("should return error for payment verification failure", async () => {
    const mockPayment = new MockPaymentService({ verifyResult: false });
    const failProvider = await startProviderFixture({
      providerOverrides: { paymentService: mockPayment },
    });

    try {
      const quoteRes = await httpPost<QuoteResponse>(
        `${failProvider.baseUrl}/ivxp/request`,
        buildServiceRequestBody("text_echo"),
      );
      const orderId = quoteRes.body.order_id;

      const deliverRes = await httpPost<ErrorResponse>(
        `${failProvider.baseUrl}/ivxp/deliver`,
        buildDeliveryRequestBody(orderId),
      );
      expect(deliverRes.status).toBe(400);
      expect(deliverRes.body.error).toContain("Payment verification failed");
    } finally {
      await failProvider.stop();
    }
  });
});

// ===========================================================================
// Input validation tests
// ===========================================================================

describe("Input validation", () => {
  let provider: ProviderFixture;
  let baseUrl: string;

  beforeAll(async () => {
    provider = await startProviderFixture();
    baseUrl = provider.baseUrl;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await provider.stop();
  });

  it("should reject malformed JSON body on POST /ivxp/request", async () => {
    const response = await fetch(`${baseUrl}/ivxp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    expect(response.status).toBe(400);
  });

  it("should reject malformed JSON body on POST /ivxp/deliver", async () => {
    const response = await fetch(`${baseUrl}/ivxp/deliver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    expect(response.status).toBe(400);
  });

  it("should reject delivery request missing required fields", async () => {
    const res = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/deliver`, {
      order_id: "ivxp-test",
      // Missing: payment_proof, signature, signed_message
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should reject delivery with signed_message not containing order_id", async () => {
    const quoteRes = await httpPost<QuoteResponse>(
      `${baseUrl}/ivxp/request`,
      buildServiceRequestBody("text_echo"),
    );
    const orderId = quoteRes.body.order_id;

    const res = await httpPost<ErrorResponse>(`${baseUrl}/ivxp/deliver`, {
      protocol: "IVXP/1.0",
      message_type: "delivery_request",
      timestamp: new Date().toISOString(),
      order_id: orderId,
      payment_proof: {
        tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        from_address: TEST_ACCOUNTS.client.address,
        network: "base-sepolia",
      },
      signature:
        "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab01",
      signed_message: "This message does not contain the order ID",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("signed message");
  });

  it("should handle empty order_id in status URL gracefully", async () => {
    const res = await httpGet<ErrorResponse>(`${baseUrl}/ivxp/status/`);
    // Should return 400 or 404, not crash
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
