/**
 * Integration tests for the IVXP Demo Provider.
 *
 * Tests the Express server with a real IVXPProvider instance
 * using mock crypto/payment services from @ivxp/test-utils.
 *
 * Validates all acceptance criteria:
 * - AC #1: Serves all IVXP/1.0 protocol endpoints (/ivxp/*)
 * - AC #2: Exposes demo services in the catalog
 * - AC #3: Handles complete order lifecycle (quote -> pay -> deliver)
 * - AC #4: Runs as a standalone Node.js application
 *
 * Also validates review fixes:
 * - Zod schema validation on POST routes
 * - CORS preflight with credentials
 * - Rate limiting headers
 * - Malformed JSON rejection
 * - Body size limit enforcement
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ServerInstance } from "./server.js";
import { IVXPProvider } from "@ivxp/sdk";
import { MockCryptoService, MockPaymentService, TEST_ACCOUNTS } from "@ivxp/test-utils";
import { DEMO_SERVICES } from "./catalog.js";
import { createServiceHandlers } from "./handlers.js";
import type { Server } from "node:http";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let serverInstance: ServerInstance;
let httpServer: Server;
let baseUrl: string;

const mockCrypto = new MockCryptoService({
  address: TEST_ACCOUNTS.provider.address,
});
const mockPayment = new MockPaymentService();

beforeAll(async () => {
  const provider = new IVXPProvider({
    privateKey: TEST_ACCOUNTS.provider.privateKey as `0x${string}`,
    services: [...DEMO_SERVICES],
    network: "base-sepolia",
    port: 0,
    host: "127.0.0.1",
    providerName: "IVXP Demo Provider",
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    serviceHandlers: createServiceHandlers(),
    allowPrivateDeliveryUrls: true,
  });

  serverInstance = createServer({
    config: {
      port: 0,
      privateKey: TEST_ACCOUNTS.provider.privateKey as `0x${string}`,
      corsAllowedOrigins: ["http://localhost:3000"],
      logLevel: "silent",
      network: "base-sepolia",
      providerName: "IVXP Demo Provider",
      rateLimitWindowMs: 60_000,
      rateLimitMax: 100,
    },
    provider,
  });

  // Start on random port
  httpServer = await new Promise<Server>((resolve) => {
    const s = serverInstance.app.listen(0, "127.0.0.1", () => resolve(s));
  });

  const addr = httpServer.address();
  const port = typeof addr === "object" && addr !== null ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function fetchJson(
  path: string,
  options?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body, headers: res.headers };
}

/** Build a valid service request body for reuse across tests. */
function validServiceRequestBody(overrides?: Record<string, unknown>) {
  return {
    protocol: "IVXP/1.0",
    message_type: "service_request",
    timestamp: new Date().toISOString(),
    client_agent: {
      name: "Test Client",
      wallet_address: TEST_ACCOUNTS.client.address,
    },
    service_request: {
      type: "text_echo",
      description: "Test echo",
      budget_usdc: 1,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC #4: Runs as a standalone Node.js application
// ---------------------------------------------------------------------------

describe("health check (AC #4)", () => {
  it("should return ok status", async () => {
    const { status, body } = await fetchJson("/health");
    expect(status).toBe(200);
    expect(body["status"]).toBe("ok");
    expect(body["timestamp"]).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// AC #1: Serves all IVXP/1.0 protocol endpoints
// AC #2: Exposes demo services in the catalog
// ---------------------------------------------------------------------------

describe("GET /ivxp/catalog (AC #1, #2)", () => {
  it("should return the service catalog with demo services", async () => {
    const { status, body } = await fetchJson("/ivxp/catalog");

    expect(status).toBe(200);
    expect(body["protocol"]).toBe("IVXP/1.0");
    expect(body["provider"]).toBe("IVXP Demo Provider");
    expect(body["wallet_address"]).toBe(TEST_ACCOUNTS.provider.address);
    expect(body["message_type"]).toBe("service_catalog");

    const services = body["services"] as Array<Record<string, unknown>>;
    expect(services).toHaveLength(2);

    const textEcho = services.find((s) => s["type"] === "text_echo");
    expect(textEcho).toBeDefined();
    expect(textEcho!["base_price_usdc"]).toBe(0.1);

    const imageGen = services.find((s) => s["type"] === "image_gen");
    expect(imageGen).toBeDefined();
    expect(imageGen!["base_price_usdc"]).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// AC #1: POST /ivxp/request (quote generation)
// ---------------------------------------------------------------------------

describe("POST /ivxp/request (AC #1)", () => {
  it("should generate a quote for a valid service request", async () => {
    const { status, body } = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(validServiceRequestBody()),
    });

    expect(status).toBe(200);
    expect(body["protocol"]).toBe("IVXP/1.0");
    expect(body["message_type"]).toBe("service_quote");
    expect(body["order_id"]).toBeTypeOf("string");
    expect((body["order_id"] as string).startsWith("ivxp-")).toBe(true);

    const quote = body["quote"] as Record<string, unknown>;
    expect(quote["price_usdc"]).toBe(0.1);
    expect(quote["payment_address"]).toBe(TEST_ACCOUNTS.provider.address);
    expect(quote["network"]).toBe("base-sepolia");
  });

  it("should return 400 for missing fields", async () => {
    const { status, body } = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify({ foo: "bar" }),
    });

    expect(status).toBe(400);
    expect(body["error"]).toBeTypeOf("string");
  });

  it("should return 404 for unknown service type", async () => {
    const { status, body } = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: {
            type: "nonexistent_service",
            description: "Test",
            budget_usdc: 1,
          },
        }),
      ),
    });

    expect(status).toBe(404);
    expect(body["error"]).toContain("Unknown service");
  });

  it("should return 400 for invalid wallet address format", async () => {
    const { status, body } = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          client_agent: {
            name: "Bad Client",
            wallet_address: "not-an-address",
          },
        }),
      ),
    });

    expect(status).toBe(400);
    expect(body["error"]).toContain("Invalid");
  });

  it("should return 400 for negative budget", async () => {
    const { status, body } = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: {
            type: "text_echo",
            description: "Test",
            budget_usdc: -5,
          },
        }),
      ),
    });

    expect(status).toBe(400);
    expect(body["error"]).toBeTypeOf("string");
  });
});

// ---------------------------------------------------------------------------
// AC #1: GET /ivxp/status/:orderId
// ---------------------------------------------------------------------------

describe("GET /ivxp/status/:orderId (AC #1)", () => {
  it("should return 404 for non-existent order", async () => {
    const { status, body } = await fetchJson("/ivxp/status/ivxp-nonexistent");
    expect(status).toBe(404);
    expect(body["error"]).toContain("Order not found");
  });

  it("should return status for an existing order", async () => {
    const quoteRes = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: { type: "text_echo", description: "Status test", budget_usdc: 1 },
        }),
      ),
    });

    const orderId = quoteRes.body["order_id"] as string;
    const { status, body } = await fetchJson(`/ivxp/status/${orderId}`);

    expect(status).toBe(200);
    expect(body["order_id"]).toBe(orderId);
    expect(body["status"]).toBe("quoted");
    expect(body["service"]).toBe("text_echo");
  });
});

// ---------------------------------------------------------------------------
// AC #1: GET /ivxp/download/:orderId
// ---------------------------------------------------------------------------

describe("GET /ivxp/download/:orderId (AC #1)", () => {
  it("should return 404 for non-existent order", async () => {
    const { status, body } = await fetchJson("/ivxp/download/ivxp-nonexistent");
    expect(status).toBe(404);
    expect(body["error"]).toContain("Order not found");
  });
});

describe("canonical /ivxp/orders/* endpoints", () => {
  it("supports canonical delivery, status, and deliverable routes", async () => {
    const quoteRes = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: {
            type: "text_echo",
            description: "Canonical route flow",
            budget_usdc: 1,
          },
        }),
      ),
    });

    expect(quoteRes.status).toBe(200);
    const orderId = quoteRes.body["order_id"] as string;

    const deliveryRes = await fetchJson(`/ivxp/orders/${orderId}/delivery`, {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        payment: {
          tx_hash: "0x" + "12".repeat(32),
          network: "base-sepolia",
        },
        signature: {
          message: `IVXP payment for order ${orderId}`,
          sig: "0x" + "cd".repeat(65),
          signer: TEST_ACCOUNTS.client.address,
        },
      }),
    });

    expect(deliveryRes.status).toBe(200);
    expect(deliveryRes.body["status"]).toBe("accepted");

    await new Promise((resolve) => setTimeout(resolve, 500));

    const statusRes = await fetchJson(`/ivxp/orders/${orderId}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body["order_id"]).toBe(orderId);
    expect(statusRes.body["status"]).toBe("delivered");

    const deliverableRes = await fetchJson(`/ivxp/orders/${orderId}/deliverable`);
    expect(deliverableRes.status).toBe(200);
    expect(deliverableRes.body["order_id"]).toBe(orderId);
    expect(deliverableRes.body["content_hash"]).toBeTypeOf("string");
  });
});

// ---------------------------------------------------------------------------
// AC #3: Complete order lifecycle (quote -> pay -> deliver)
// ---------------------------------------------------------------------------

describe("complete order lifecycle (AC #3)", () => {
  it("should handle quote -> deliver -> status -> download flow", async () => {
    // Step 1: Request a quote
    const quoteRes = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: {
            type: "text_echo",
            description: "Full lifecycle test",
            budget_usdc: 1,
          },
        }),
      ),
    });

    expect(quoteRes.status).toBe(200);
    const orderId = quoteRes.body["order_id"] as string;

    // Step 2: Submit delivery request (with mock payment)
    const deliverRes = await fetchJson("/ivxp/deliver", {
      method: "POST",
      body: JSON.stringify({
        protocol: "IVXP/1.0",
        message_type: "delivery_request",
        timestamp: new Date().toISOString(),
        order_id: orderId,
        payment_proof: {
          tx_hash: "0x" + "ab".repeat(32),
          from_address: TEST_ACCOUNTS.client.address,
          network: "base-sepolia",
        },
        signature: "0x" + "cd".repeat(65),
        signed_message: `IVXP payment for order ${orderId}`,
      }),
    });

    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body["order_id"]).toBe(orderId);
    expect(deliverRes.body["status"]).toBe("accepted");

    // Step 3: Wait briefly for async processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 4: Check status (should be "delivered" after processing)
    const statusRes = await fetchJson(`/ivxp/status/${orderId}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body["status"]).toBe("delivered");

    // Step 5: Download the deliverable
    const downloadRes = await fetchJson(`/ivxp/download/${orderId}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.body["order_id"]).toBe(orderId);
    // Content is now JSON with echoed text and timestamp
    const content = downloadRes.body["content"] as string;
    expect(content).toContain("echoed_text");
    expect(content).toContain("text_echo");
    expect(downloadRes.body["content_type"]).toBe("application/json");
    expect(downloadRes.body["content_hash"]).toBeTypeOf("string");
  });

  it("should preserve request input and return transformed text echo output", async () => {
    const quoteRes = await fetchJson("/ivxp/request", {
      method: "POST",
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: {
            type: "text_echo",
            description: JSON.stringify({ text: "Hello IVXP", transform: "uppercase" }),
            budget_usdc: 1,
          },
        }),
      ),
    });

    expect(quoteRes.status).toBe(200);
    const orderId = quoteRes.body["order_id"] as string;

    const deliveryRes = await fetchJson(`/ivxp/orders/${orderId}/delivery`, {
      method: "POST",
      body: JSON.stringify({
        order_id: orderId,
        payment: {
          tx_hash: "0x" + "ef".repeat(32),
          network: "base-sepolia",
        },
        signature: {
          message: `IVXP payment for order ${orderId}`,
          sig: "0x" + "cd".repeat(65),
          signer: TEST_ACCOUNTS.client.address,
        },
      }),
    });

    expect(deliveryRes.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const downloadRes = await fetchJson(`/ivxp/orders/${orderId}/deliverable`);
    expect(downloadRes.status).toBe(200);

    const deliverablePayload = JSON.parse(downloadRes.body["content"] as string) as Record<
      string,
      unknown
    >;
    expect(deliverablePayload["service_type"]).toBe("text_echo");
    expect(deliverablePayload["original_text"]).toBe("Hello IVXP");
    expect(deliverablePayload["echoed_text"]).toBe("HELLO IVXP");
  });
});

// ---------------------------------------------------------------------------
// AC #1: POST /ivxp/deliver validation
// ---------------------------------------------------------------------------

describe("POST /ivxp/deliver validation (AC #1)", () => {
  it("should return 400 for missing fields", async () => {
    const { status, body } = await fetchJson("/ivxp/deliver", {
      method: "POST",
      body: JSON.stringify({ order_id: "ivxp-test" }),
    });

    expect(status).toBe(400);
    expect(body["error"]).toBeTypeOf("string");
  });

  it("should return 400 for invalid tx_hash format", async () => {
    const { status, body } = await fetchJson("/ivxp/deliver", {
      method: "POST",
      body: JSON.stringify({
        protocol: "IVXP/1.0",
        message_type: "delivery_request",
        timestamp: new Date().toISOString(),
        order_id: "ivxp-test",
        payment_proof: {
          tx_hash: "not-a-hash",
          from_address: TEST_ACCOUNTS.client.address,
          network: "base-sepolia",
        },
        signature: "0x" + "cd".repeat(65),
        signed_message: "test",
      }),
    });

    expect(status).toBe(400);
    expect(body["error"]).toContain("Invalid");
  });

  it("should return 400 for invalid from_address format", async () => {
    const { status, body } = await fetchJson("/ivxp/deliver", {
      method: "POST",
      body: JSON.stringify({
        protocol: "IVXP/1.0",
        message_type: "delivery_request",
        timestamp: new Date().toISOString(),
        order_id: "ivxp-test",
        payment_proof: {
          tx_hash: "0x" + "ab".repeat(32),
          from_address: "bad-address",
          network: "base-sepolia",
        },
        signature: "0x" + "cd".repeat(65),
        signed_message: "test",
      }),
    });

    expect(status).toBe(400);
    expect(body["error"]).toContain("Invalid");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });

  it("should return 404 or 405 for wrong method on catalog", async () => {
    const res = await fetch(`${baseUrl}/ivxp/catalog`, { method: "POST" });
    expect([404, 405]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// CORS preflight (MEDIUM-3 / MEDIUM-5)
// ---------------------------------------------------------------------------

describe("CORS preflight", () => {
  it("should respond to OPTIONS with correct CORS headers", async () => {
    const res = await fetch(`${baseUrl}/ivxp/catalog`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-max-age")).toBe("600");
  });

  it("should not allow disallowed origins", async () => {
    const res = await fetch(`${baseUrl}/ivxp/catalog`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://evil.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    // cors middleware either omits the header or doesn't match
    const allowOrigin = res.headers.get("access-control-allow-origin");
    expect(allowOrigin).not.toBe("http://evil.com");
  });
});

// ---------------------------------------------------------------------------
// Rate limiting headers (MEDIUM-5)
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  it("should include rate limit headers in responses", async () => {
    const { headers } = await fetchJson("/health");

    // express-rate-limit with standardHeaders: true sets RateLimit-* headers
    const rateLimitHeader = headers.get("ratelimit-limit") ?? headers.get("x-ratelimit-limit");
    expect(rateLimitHeader).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON (MEDIUM-5)
// ---------------------------------------------------------------------------

describe("malformed JSON handling", () => {
  it("should return 400 for malformed JSON body", async () => {
    const res = await fetch(`${baseUrl}/ivxp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Body size limit (MEDIUM-5)
// ---------------------------------------------------------------------------

describe("body size limit", () => {
  it("should reject bodies exceeding 64 KB", async () => {
    // Generate a body larger than 64 KB
    const largeDescription = "x".repeat(70_000);
    const res = await fetch(`${baseUrl}/ivxp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        validServiceRequestBody({
          service_request: {
            type: "text_echo",
            description: largeDescription,
            budget_usdc: 1,
          },
        }),
      ),
    });

    // Express returns 413 Payload Too Large
    expect(res.status).toBe(413);
  });
});
