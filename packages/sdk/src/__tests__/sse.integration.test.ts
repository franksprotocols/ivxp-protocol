/**
 * SSE integration tests with real local servers and full requestService flow.
 *
 * Validates:
 * - SSEClient can consume all 4 protocol event types end-to-end.
 * - requestService() degrades to polling after 3 failed connection attempts.
 * - requestService() degrades to polling after mid-stream disconnect + reconnect exhaustion.
 * - requestService() does not attempt SSE when stream_url is absent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as http from "node:http";
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
import { SSEClient, SSEExhaustedError } from "../sse/sse-client.js";
import { IVXPClient, type IVXPClientConfig } from "../core/client.js";
import type { RequestServiceParams } from "../core/types.js";

// ---------------------------------------------------------------------------
// Shared helpers
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

/**
 * Spin up a local SSE server that emits the given event chunks then closes.
 * Returns { url, server } — caller must call server.close() in afterEach.
 */
function createLocalSSEServer(
  events: string[],
  opts: { closeAfterEvents?: number } = {},
): Promise<{ url: string; server: http.Server }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      let sent = 0;
      for (const event of events) {
        res.write(event);
        sent++;
        if (opts.closeAfterEvents !== undefined && sent >= opts.closeAfterEvents) {
          res.destroy(); // Simulate mid-stream disconnect
          return;
        }
      }
      res.end();
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${addr.port}/stream/order-1`, server });
    });
  });
}

function createMockedClient(mockHttp: MockHttpClient): IVXPClient {
  const config: IVXPClientConfig = {
    privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
    cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.client.address }),
    paymentService: new MockPaymentService(),
    httpClient: mockHttp,
  };
  return new IVXPClient(config);
}

function createRequestServiceMockHttp(overrides?: {
  readonly catalog?: Record<string, unknown>;
  readonly paymentResponse?: Record<string, unknown>;
  readonly orderStatus?: ReturnType<typeof createMockOrderStatusResponse>;
}): MockHttpClient {
  const orderId = DEFAULT_ORDER_ID;
  const quote = createMockQuote({ order_id: orderId });
  const deliveryResponse = createMockDeliveryResponse({ order_id: orderId });
  const orderStatus =
    overrides?.orderStatus ?? createMockOrderStatusResponse("delivered", { order_id: orderId });
  const catalog = overrides?.catalog ?? {
    protocol: "IVXP/1.0",
    provider: "TestProvider",
    wallet_address: TEST_ACCOUNTS.provider.address,
    services: [{ type: "code_review", base_price_usdc: 10, estimated_delivery_hours: 1 }],
    capabilities: ["sse"],
  };
  const paymentResponse = overrides?.paymentResponse ?? { status: "paid" };

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

// ---------------------------------------------------------------------------
// SSEClient low-level integration
// ---------------------------------------------------------------------------

describe("SSEClient — integration with local HTTP server", () => {
  let server: http.Server | null = null;

  afterEach(() => {
    server?.close();
    server = null;
  });

  it("receives all 4 event types from a local SSE server", async () => {
    const chunks = [
      'event: status_update\ndata: {"status":"processing"}\n\n',
      'event: progress\ndata: {"percent":50}\n\n',
      'event: completed\ndata: {"orderId":"order-1"}\n\n',
      'event: failed\ndata: {"reason":"test"}\n\n',
    ];

    const { url, server: s } = await createLocalSSEServer(chunks);
    server = s;

    const handlers = {
      onStatusUpdate: vi.fn(),
      onProgress: vi.fn(),
      onCompleted: vi.fn(),
      onFailed: vi.fn(),
    };

    const client = new SSEClient({ maxRetries: 1, retryBaseMs: 0 });
    const unsub = await client.connect(url, handlers);
    await new Promise((r) => setTimeout(r, 100));
    unsub();

    expect(handlers.onStatusUpdate).toHaveBeenCalledWith({ status: "processing" });
    expect(handlers.onProgress).toHaveBeenCalledWith({ percent: 50 });
    expect(handlers.onCompleted).toHaveBeenCalledWith({ orderId: "order-1" });
    expect(handlers.onFailed).toHaveBeenCalledWith({ reason: "test" });
  });

  it("throws SSEExhaustedError after 3 failed connection attempts", async () => {
    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    await expect(
      client.connect("http://127.0.0.1:1/stream/order-1", {}),
    ).rejects.toBeInstanceOf(SSEExhaustedError);
  });

  it("handles mid-stream disconnect and exhausts retries", async () => {
    const chunks = [
      'event: status_update\ndata: {"status":"processing"}\n\n',
      'event: progress\ndata: {"percent":25}\n\n',
    ];

    const { url, server: s } = await createLocalSSEServer(chunks, {
      closeAfterEvents: 1,
    });
    server = s;

    const client = new SSEClient({ maxRetries: 3, retryBaseMs: 0 });
    const onStatusUpdate = vi.fn();

    await expect(
      client.connect(url, { onStatusUpdate }),
    ).rejects.toBeInstanceOf(SSEExhaustedError);
  });
});

// ---------------------------------------------------------------------------
// requestService SSE degradation integration
// ---------------------------------------------------------------------------

describe("IVXPClient.requestService() — SSE degradation integration", () => {
  let server: http.Server | null = null;

  beforeEach(() => {
    resetOrderCounter();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    server?.close();
    server = null;
    vi.restoreAllMocks();
  });

  it("emits sse_fallback and completes via polling when SSE connection is refused", async () => {
    const mockHttp = createRequestServiceMockHttp({
      paymentResponse: {
        status: "accepted",
        order_id: DEFAULT_ORDER_ID,
        message: "processing",
        stream_url: "http://127.0.0.1:1/stream/order-1",
      },
    });
    const client = createMockedClient(mockHttp);
    const subscribeSpy = vi
      .spyOn(client, "subscribeToStream")
      .mockImplementation((streamUrl, handlers, options) =>
        new SSEClient({ maxRetries: 3, retryBaseMs: 0 }).connect(streamUrl, handlers, options),
      );
    const onFallback = vi.fn();
    client.on("sse_fallback", onFallback);

    const result = await client.requestService(DEFAULT_PARAMS);

    expect(result.status).toBe("confirmed");
    expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0]?.[0]?.orderId).toBe(DEFAULT_ORDER_ID);
  });

  it("reconnects after mid-stream disconnect, then falls back to polling and completes", async () => {
    const chunks = [
      'event: status_update\ndata: {"status":"processing"}\n\n',
      'event: progress\ndata: {"percent":25}\n\n',
    ];
    const local = await createLocalSSEServer(chunks, { closeAfterEvents: 1 });
    server = local.server;

    const mockHttp = createRequestServiceMockHttp({
      paymentResponse: {
        status: "accepted",
        order_id: DEFAULT_ORDER_ID,
        message: "processing",
        stream_url: local.url,
      },
    });
    const client = createMockedClient(mockHttp);
    const subscribeSpy = vi
      .spyOn(client, "subscribeToStream")
      .mockImplementation((streamUrl, handlers, options) =>
        new SSEClient({ maxRetries: 3, retryBaseMs: 0 }).connect(streamUrl, handlers, options),
      );

    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((...args) =>
      realFetch(...(args as [RequestInfo | URL, RequestInit | undefined])),
    );

    const onFallback = vi.fn();
    client.on("sse_fallback", onFallback);

    const result = await client.requestService(DEFAULT_PARAMS);

    expect(result.status).toBe("confirmed");
    expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback.mock.calls[0]?.[0]?.reason).toContain("SSE failed");
  });

  it("uses polling when payment response has no stream_url (no SSE attempt)", async () => {
    const mockHttp = createRequestServiceMockHttp({
      paymentResponse: {
        status: "accepted",
        order_id: DEFAULT_ORDER_ID,
        message: "processing",
      },
    });
    const client = createMockedClient(mockHttp);
    const subscribeSpy = vi.spyOn(client, "subscribeToStream");

    const result = await client.requestService(DEFAULT_PARAMS);

    expect(result.status).toBe("confirmed");
    expect(result.orderId).toBe(DEFAULT_ORDER_ID);
    expect(subscribeSpy).not.toHaveBeenCalled();

    const statusCalls = mockHttp
      .getGetCalls()
      .filter((call) => call.url.includes(`/ivxp/orders/${encodeURIComponent(DEFAULT_ORDER_ID)}`));
    expect(statusCalls.length).toBeGreaterThanOrEqual(1);
  });
});
