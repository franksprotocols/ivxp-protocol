/**
 * MockProviderServer -- A minimal IVXP/1.0 provider for integration testing.
 *
 * Implements the IVXP provider HTTP endpoints using MockHttpClient route
 * handlers. Simulates the full provider workflow: catalog, quote, payment
 * notification, order status, deliverable download, and delivery confirmation.
 *
 * State management: order data is stored inside the closure returned by
 * `createMockProvider`. Each state transition creates a NEW Map instance
 * (immutable replacement via `let` reassignment) rather than mutating the
 * existing Map in-place. This is a pragmatic immutability approach for test
 * infrastructure -- the outer reference is reassigned, but no Map is ever
 * mutated after creation.
 *
 * This is NOT a real HTTP server -- it uses @ivxp/test-utils MockHttpClient
 * to intercept SDK HTTP calls. This is the correct approach because
 * IVXPClient accepts an injectable IHttpClient, and integration tests should
 * test the full flow through real CryptoService and PaymentService against
 * Anvil, with only the provider HTTP layer mocked.
 */

import { MockHttpClient } from "@ivxp/test-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An order tracked by the mock provider.
 * Immutable -- new objects are created on state transitions.
 */
export interface MockOrder {
  readonly orderId: string;
  readonly status: "quoted" | "paid" | "delivered" | "delivery_failed" | "confirmed";
  readonly priceUsdc: number;
  readonly serviceType: string;
  readonly createdAt: string;
  readonly deliverable?: {
    readonly type: string;
    readonly format: string;
    readonly content: unknown;
  };
}

/**
 * Configuration for the mock provider.
 */
export interface MockProviderConfig {
  /** Provider wallet address (0x-prefixed). */
  readonly providerAddress: `0x${string}`;
  /** Provider name. Defaults to "Mock Provider". */
  readonly providerName?: string;
  /** Base price for the test service in USDC. Defaults to 10. */
  readonly basePriceUsdc?: number;
  /** Delay in ms before an order transitions to "delivered" after payment. Defaults to 0 (immediate). */
  readonly deliveryDelayMs?: number;
  /** If true, orders go to "delivery_failed" instead of "delivered". */
  readonly failDelivery?: boolean;
  /** If true, POST /ivxp/request returns an error. */
  readonly rejectRequests?: boolean;
}

/**
 * Return type from createMockProvider.
 */
export interface MockProviderResult {
  /** The MockHttpClient instance to inject into IVXPClient. */
  readonly httpClient: MockHttpClient;
  /** The base URL the mock provider responds to. */
  readonly providerUrl: string;
  /** Get all orders tracked by the mock provider. */
  readonly getOrders: () => ReadonlyMap<string, MockOrder>;
  /** Get a specific order by ID. */
  readonly getOrder: (orderId: string) => MockOrder | undefined;
  /** Force an order to a specific status (for testing error scenarios). */
  readonly setOrderStatus: (orderId: string, status: MockOrder["status"]) => void;
  /** Cancel all pending delivery timeouts. Call in afterEach/afterAll for cleanup. */
  readonly cleanup: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = "IVXP/1.0";
const MOCK_PROVIDER_URL = "http://mock-provider.test";

// ---------------------------------------------------------------------------
// URL parsing helpers
// ---------------------------------------------------------------------------

/**
 * Regex to extract orderId and action from an orders URL path.
 *
 * Matches: /ivxp/orders/{orderId}/{action}
 * Groups:  [1] = orderId, [2] = action (payment, confirm, deliverable)
 *
 * The orderId group accepts URL-encoded characters (%xx) plus alphanumeric,
 * hyphens, and underscores.
 */
const ORDERS_PATH_REGEX = /\/ivxp\/orders\/([a-zA-Z0-9._~:@!$&'()*+,;=%-]+)\/(payment|confirm|deliverable)$/;

/**
 * Regex for order status endpoint (no trailing action segment).
 *
 * Matches: /ivxp/orders/{orderId}
 * Groups:  [1] = orderId
 */
const ORDER_STATUS_REGEX = /\/ivxp\/orders\/([a-zA-Z0-9._~:@!$&'()*+,;=%-]+)$/;

/**
 * Parse an orders URL and extract the orderId and action.
 *
 * Uses URL() constructor for safe parsing, then applies regex to the pathname.
 *
 * @returns Parsed result or null if the URL does not match expected format
 */
function parseOrdersUrl(rawUrl: string): { orderId: string; action: string } | null {
  let pathname: string;
  try {
    const parsed = new URL(rawUrl);
    pathname = parsed.pathname;
  } catch {
    // Fallback: treat as a relative path if URL() fails
    const pathStart = rawUrl.indexOf("/ivxp/");
    if (pathStart === -1) {
      return null;
    }
    pathname = rawUrl.slice(pathStart);
  }

  const actionMatch = ORDERS_PATH_REGEX.exec(pathname);
  if (actionMatch) {
    return {
      orderId: decodeURIComponent(actionMatch[1]),
      action: actionMatch[2],
    };
  }

  const statusMatch = ORDER_STATUS_REGEX.exec(pathname);
  if (statusMatch) {
    return {
      orderId: decodeURIComponent(statusMatch[1]),
      action: "status",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a mock IVXP provider that responds to SDK HTTP calls.
 *
 * All mutable state (order counter, order Map, timeout IDs) is scoped
 * inside the closure -- no module-level mutable state exists.
 *
 * Returns a MockHttpClient with all IVXP/1.0 endpoints registered,
 * plus helper functions to inspect and manipulate order state.
 *
 * @param config - Provider configuration
 * @returns MockProviderResult with httpClient, inspection helpers, and cleanup
 */
export function createMockProvider(config: MockProviderConfig): MockProviderResult {
  const {
    providerAddress,
    providerName = "Mock Provider",
    basePriceUsdc = 10,
    deliveryDelayMs = 0,
    failDelivery = false,
    rejectRequests = false,
  } = config;

  // ---- Closure-scoped mutable state ----

  // Order counter is scoped per provider instance (no module-level mutation).
  let orderCounter = 0;

  function nextOrderId(): string {
    orderCounter += 1;
    return `ivxp-mock-${String(orderCounter).padStart(6, "0")}`;
  }

  // Order storage: immutable replacement via `let` reassignment.
  // Each state transition creates a NEW Map from the previous one.
  let orders = new Map<string, MockOrder>();

  // Track pending delivery timeouts for cleanup.
  const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();

  const httpClient = new MockHttpClient();
  const providerUrl = MOCK_PROVIDER_URL;

  // Helper: create a new Map with an updated order (immutable replacement).
  function updateOrder(orderId: string, order: MockOrder): void {
    const newOrders = new Map(orders);
    newOrders.set(orderId, order);
    orders = newOrders;
  }

  // Helper: schedule delivery transition with timeout tracking.
  function scheduleDelivery(orderId: string, paidOrder: MockOrder): void {
    const timeoutId = setTimeout(() => {
      pendingTimeouts.delete(timeoutId);
      const currentOrder = orders.get(orderId);
      if (currentOrder && currentOrder.status === "paid") {
        const deliveredOrder: MockOrder = {
          ...currentOrder,
          status: failDelivery ? "delivery_failed" : "delivered",
          deliverable: failDelivery
            ? undefined
            : {
                type: "test_result",
                format: "json",
                content: { result: "Integration test result", orderId },
              },
        };
        updateOrder(orderId, deliveredOrder);
      }
    }, deliveryDelayMs);
    pendingTimeouts.add(timeoutId);
  }

  // -------------------------------------------------------------------------
  // GET /ivxp/catalog
  // -------------------------------------------------------------------------

  httpClient.onGet(`${providerUrl}/ivxp/catalog`, () => ({
    protocol: PROTOCOL_VERSION,
    message_type: "service_catalog",
    timestamp: new Date().toISOString(),
    provider: providerName,
    wallet_address: providerAddress,
    services: [
      {
        type: "test_service",
        base_price_usdc: basePriceUsdc,
        estimated_delivery_hours: 0.01,
      },
    ],
  }));

  // -------------------------------------------------------------------------
  // POST /ivxp/request
  // -------------------------------------------------------------------------

  httpClient.onPost(`${providerUrl}/ivxp/request`, (_url, body) => {
    if (rejectRequests) {
      throw new Error("Provider is rejecting all requests");
    }

    const orderId = nextOrderId();
    const now = new Date().toISOString();

    // Extract service type from the request body
    const requestBody = body as Record<string, unknown>;
    const serviceRequest = (requestBody.service_request ?? {}) as Record<string, unknown>;
    const serviceType = (serviceRequest.type as string) ?? "test_service";

    const order: MockOrder = {
      orderId,
      status: "quoted",
      priceUsdc: basePriceUsdc,
      serviceType,
      createdAt: now,
    };

    updateOrder(orderId, order);

    return {
      protocol: PROTOCOL_VERSION,
      message_type: "service_quote",
      timestamp: now,
      order_id: orderId,
      provider_agent: {
        name: providerName,
        wallet_address: providerAddress,
      },
      quote: {
        price_usdc: basePriceUsdc,
        estimated_delivery: new Date(Date.now() + 60_000).toISOString(),
        payment_address: providerAddress,
        network: "base-sepolia",
      },
    };
  });

  // -------------------------------------------------------------------------
  // POST /ivxp/orders/{id}/payment and POST /ivxp/orders/{id}/confirm
  // -------------------------------------------------------------------------

  httpClient.onPost(`${providerUrl}/ivxp/orders`, (url, _body) => {
    const parsed = parseOrdersUrl(url);
    if (!parsed) {
      throw new Error(`Mock provider: failed to parse orders URL: ${url}`);
    }

    const { orderId, action } = parsed;

    if (action === "payment") {
      const existingOrder = orders.get(orderId);
      if (!existingOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      // Transition to paid
      const paidOrder: MockOrder = { ...existingOrder, status: "paid" };
      updateOrder(orderId, paidOrder);

      // Schedule delivery transition
      if (deliveryDelayMs === 0) {
        const deliveredOrder: MockOrder = {
          ...paidOrder,
          status: failDelivery ? "delivery_failed" : "delivered",
          deliverable: failDelivery
            ? undefined
            : {
                type: "test_result",
                format: "json",
                content: { result: "Integration test result", orderId },
              },
        };
        updateOrder(orderId, deliveredOrder);
      } else {
        scheduleDelivery(orderId, paidOrder);
      }

      return { status: "accepted" };
    }

    if (action === "confirm") {
      const existingOrder = orders.get(orderId);
      if (!existingOrder) {
        throw new Error(`Order ${orderId} not found`);
      }

      const confirmedOrder: MockOrder = { ...existingOrder, status: "confirmed" };
      updateOrder(orderId, confirmedOrder);

      return {
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      };
    }

    throw new Error(`Mock provider: unhandled POST action "${action}" for URL: ${url}`);
  });

  // -------------------------------------------------------------------------
  // GET /ivxp/orders/{id}/deliverable and GET /ivxp/orders/{id}
  // -------------------------------------------------------------------------

  httpClient.onGet(`${providerUrl}/ivxp/orders`, (url) => {
    const parsed = parseOrdersUrl(url);
    if (!parsed) {
      throw new Error(`Mock provider: failed to parse orders URL: ${url}`);
    }

    const { orderId, action } = parsed;

    if (action === "deliverable") {
      const order = orders.get(orderId);
      if (!order || !order.deliverable) {
        throw new Error(`Deliverable not ready for order ${orderId}`);
      }

      return {
        protocol: PROTOCOL_VERSION,
        message_type: "service_delivery",
        timestamp: new Date().toISOString(),
        order_id: orderId,
        status: "completed",
        provider_agent: {
          name: providerName,
          wallet_address: providerAddress,
        },
        deliverable: order.deliverable,
      };
    }

    // action === "status"
    const order = orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    return {
      order_id: orderId,
      status: order.status,
      created_at: order.createdAt,
      service_type: order.serviceType,
      price_usdc: order.priceUsdc,
    };
  });

  // -------------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------------

  return {
    httpClient,
    providerUrl,
    getOrders: () => new Map(orders),
    getOrder: (orderId: string) => orders.get(orderId),
    setOrderStatus: (orderId: string, status: MockOrder["status"]) => {
      const existing = orders.get(orderId);
      if (!existing) {
        throw new Error(`Cannot set status: order ${orderId} not found`);
      }
      const updated: MockOrder = { ...existing, status };
      updateOrder(orderId, updated);
    },
    cleanup: () => {
      for (const id of pendingTimeouts) {
        clearTimeout(id);
      }
      pendingTimeouts.clear();
    },
  };
}
