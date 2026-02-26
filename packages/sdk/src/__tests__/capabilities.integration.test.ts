/**
 * Capability detection integration tests.
 *
 * Tests hasCapability() with various catalog configurations and verifies
 * that requestService() correctly gates SSE on capability presence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hasCapability, CAPABILITY_SSE } from "../core/capabilities.js";
import type { ServiceCatalogOutput } from "@ivxp/protocol";
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
import { IVXPClient, type IVXPClientConfig } from "../core/client.js";
import type { RequestServiceParams } from "../core/types.js";

// ---------------------------------------------------------------------------
// hasCapability — unit-level integration
// ---------------------------------------------------------------------------

const baseCatalog = {
  protocol: "IVXP/1.0" as const,
  provider: "Test Provider",
  walletAddress: "0xabc" as `0x${string}`,
  services: [],
} satisfies Partial<ServiceCatalogOutput>;

describe("hasCapability — integration", () => {
  it("returns true when capabilities includes 'sse'", () => {
    const catalog = { ...baseCatalog, capabilities: ["sse"] } as ServiceCatalogOutput;
    expect(hasCapability(catalog, CAPABILITY_SSE)).toBe(true);
  });

  it("returns false when capabilities is absent", () => {
    expect(hasCapability(baseCatalog as ServiceCatalogOutput, CAPABILITY_SSE)).toBe(false);
  });

  it("returns false when capabilities is an empty array", () => {
    const catalog = { ...baseCatalog, capabilities: [] } as ServiceCatalogOutput;
    expect(hasCapability(catalog, CAPABILITY_SSE)).toBe(false);
  });

  it("silently ignores unknown capability strings", () => {
    const catalog = {
      ...baseCatalog,
      capabilities: ["sse", "unknown_future_feature"],
    } as ServiceCatalogOutput;

    // Known capability recognized
    expect(hasCapability(catalog, CAPABILITY_SSE)).toBe(true);
    // Unknown capability not in list: returns false
    expect(hasCapability(catalog, "not_in_list")).toBe(false);
    // Unknown capability that IS in the list: returns true (forward compat)
    expect(hasCapability(catalog, "unknown_future_feature")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// requestService() — capability-gated SSE flow
// ---------------------------------------------------------------------------

const PROVIDER_URL = "http://provider.test";
const DEFAULT_ORDER_ID = "ivxp-00000001-0000-0000-000000000000";

const DEFAULT_CONFIRM_RESPONSE = {
  status: "confirmed",
  confirmed_at: "2026-02-16T13:00:00Z",
};

const DEFAULT_PARAMS: RequestServiceParams = {
  providerUrl: PROVIDER_URL,
  serviceType: "code_review",
  description: "Review my TypeScript code",
  budgetUsdc: 50,
};

function createMockedClient(mockHttp: MockHttpClient): IVXPClient {
  const config: IVXPClientConfig = {
    privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
    cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.client.address }),
    paymentService: new MockPaymentService(),
    httpClient: mockHttp,
  };
  return new IVXPClient(config);
}

function makeSseStream(events: string[], keepOpen = false): Response {
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of events) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      if (!keepOpen) {
        controller.close();
      }
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function buildMockHttp(overrides?: {
  readonly catalog?: Record<string, unknown>;
  readonly paymentResponse?: Record<string, unknown>;
}): MockHttpClient {
  const orderId = DEFAULT_ORDER_ID;
  const quote = createMockQuote({ order_id: orderId });
  const deliveryResponse = createMockDeliveryResponse({ order_id: orderId });
  const orderStatus = createMockOrderStatusResponse("delivered", { order_id: orderId });
  const catalog = overrides?.catalog ?? {
    protocol: "IVXP/1.0",
    provider: "TestProvider",
    wallet_address: TEST_ACCOUNTS.provider.address,
    services: [{ type: "code_review", base_price_usdc: 10, estimated_delivery_hours: 1 }],
    capabilities: ["sse"],
  };
  const paymentResponse = overrides?.paymentResponse ?? {
    status: "accepted",
    order_id: orderId,
    message: "processing",
  };

  const mockHttp = new MockHttpClient();
  mockHttp.onGet(`${PROVIDER_URL}/ivxp/catalog`, () => catalog);
  mockHttp.onPost(`${PROVIDER_URL}/ivxp/request`, () => quote);
  mockHttp.onPost(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/payment`, () => ({
    ...paymentResponse,
  }));
  mockHttp.onGet(
    `${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/deliverable`,
    () => deliveryResponse,
  );
  mockHttp.onGet(`${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}`, () => orderStatus);
  mockHttp.onPost(
    `${PROVIDER_URL}/ivxp/orders/${encodeURIComponent(orderId)}/confirm`,
    () => DEFAULT_CONFIRM_RESPONSE,
  );
  return mockHttp;
}

describe("requestService() — capability-gated SSE flow", () => {
  beforeEach(() => {
    resetOrderCounter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes full flow when provider declares capabilities: ['sse']", async () => {
    const streamUrl = "http://provider.test/ivxp/stream/ivxp-1";
    const mockHttp = buildMockHttp({
      catalog: {
        protocol: "IVXP/1.0",
        provider: "TestProvider",
        wallet_address: TEST_ACCOUNTS.provider.address,
        services: [{ type: "code_review", base_price_usdc: 10, estimated_delivery_hours: 1 }],
        capabilities: ["sse"],
      },
      paymentResponse: {
        status: "accepted",
        order_id: DEFAULT_ORDER_ID,
        message: "processing",
        stream_url: streamUrl,
      },
    });

    const fetchSpy = vi.fn(async () =>
      makeSseStream(['event: completed\ndata: {"orderId":"ivxp-1"}\n\n'], true),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = createMockedClient(mockHttp);
    const result = await client.requestService(DEFAULT_PARAMS);

    expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    expect(result.status).toBe("confirmed");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(streamUrl);
  });

  it("completes full flow when provider has no capabilities (polling fallback)", async () => {
    const mockHttp = buildMockHttp({
      catalog: {
        protocol: "IVXP/1.0",
        provider: "TestProvider",
        wallet_address: TEST_ACCOUNTS.provider.address,
        services: [{ type: "code_review", base_price_usdc: 10, estimated_delivery_hours: 1 }],
        // No capabilities field — polling path
      },
      paymentResponse: {
        status: "accepted",
        order_id: DEFAULT_ORDER_ID,
        message: "processing",
        stream_url: "http://provider.test/ivxp/stream/should-not-be-used",
      },
    });

    const fetchSpy = vi.fn(async () => {
      throw new Error("SSE should not be attempted when capability is absent");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = createMockedClient(mockHttp);
    const result = await client.requestService(DEFAULT_PARAMS);

    expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    expect(result.status).toBe("confirmed");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("completes full flow when provider declares unknown capabilities", async () => {
    const streamUrl = "http://provider.test/ivxp/stream/ivxp-1";
    const mockHttp = buildMockHttp({
      catalog: {
        protocol: "IVXP/1.0",
        provider: "TestProvider",
        wallet_address: TEST_ACCOUNTS.provider.address,
        services: [{ type: "code_review", base_price_usdc: 10, estimated_delivery_hours: 1 }],
        capabilities: ["sse", "unknown_future_feature"],
      },
      paymentResponse: {
        status: "accepted",
        order_id: DEFAULT_ORDER_ID,
        message: "processing",
        stream_url: streamUrl,
      },
    });

    const fetchSpy = vi.fn(async () =>
      makeSseStream(['event: completed\ndata: {"orderId":"ivxp-1"}\n\n'], true),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = createMockedClient(mockHttp);
    const result = await client.requestService(DEFAULT_PARAMS);

    expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    expect(result.status).toBe("confirmed");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(streamUrl);
  });
});
