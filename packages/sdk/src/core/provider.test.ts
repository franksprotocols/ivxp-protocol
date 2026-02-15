/**
 * IVXPProvider unit tests.
 *
 * Tests the IVXPProvider constructor, configuration, dependency injection,
 * factory function, getCatalog(), and HTTP server lifecycle (start/stop).
 *
 * Uses mocks from @ivxp/test-utils to avoid real blockchain calls.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockOrderStorage,
  TEST_ACCOUNTS,
  DEFAULT_SERVICE_DEFINITIONS,
} from "@ivxp/test-utils";
import type { IOrderStorage, ServiceDefinition, ServiceRequest } from "@ivxp/protocol";
import { IVXPProvider, createIVXPProvider, type IVXPProviderConfig } from "./provider.js";
import { IVXPError } from "../errors/base.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Test service definitions using the wire-format protocol types. */
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

/** Minimal valid config for constructing an IVXPProvider. */
const MINIMAL_CONFIG: IVXPProviderConfig = {
  privateKey: TEST_ACCOUNTS.provider.privateKey as `0x${string}`,
  services: TEST_SERVICES,
};

/** Config with mock services injected for DI tests. */
function createConfigWithMocks(overrides?: Partial<IVXPProviderConfig>): IVXPProviderConfig {
  const mockCrypto = new MockCryptoService({
    address: TEST_ACCOUNTS.provider.address,
  });
  const mockPayment = new MockPaymentService();

  return {
    ...MINIMAL_CONFIG,
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    ...overrides,
  };
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
// Constructor tests
// ---------------------------------------------------------------------------

describe("IVXPProvider", () => {
  describe("constructor", () => {
    it("should create a provider with minimal config (privateKey + services)", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider).toBeInstanceOf(IVXPProvider);
    });

    it("should default network to 'base-sepolia'", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.getNetwork()).toBe("base-sepolia");
    });

    it("should accept a custom network", () => {
      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        network: "base-mainnet",
      });

      expect(provider.getNetwork()).toBe("base-mainnet");
    });

    it("should default port to 3001", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.getPort()).toBe(3001);
    });

    it("should accept a custom port", () => {
      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        port: 8080,
      });

      expect(provider.getPort()).toBe(8080);
    });

    it("should default host to '127.0.0.1'", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.getHost()).toBe("127.0.0.1");
    });

    it("should accept a custom host", () => {
      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        host: "127.0.0.1",
      });

      expect(provider.getHost()).toBe("127.0.0.1");
    });

    it("should initialize internal crypto service when not injected", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.crypto).toBeDefined();
      expect(typeof provider.crypto.sign).toBe("function");
      expect(typeof provider.crypto.verify).toBe("function");
      expect(typeof provider.crypto.getAddress).toBe("function");
    });

    it("should initialize internal payment service when not injected", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.payment).toBeDefined();
      expect(typeof provider.payment.send).toBe("function");
      expect(typeof provider.payment.verify).toBe("function");
      expect(typeof provider.payment.getBalance).toBe("function");
    });

    it("should reject an invalid private key with IVXPError", () => {
      try {
        new IVXPProvider({
          ...MINIMAL_CONFIG,
          privateKey: "0xbad" as `0x${string}`,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PRIVATE_KEY");
        expect((error as IVXPError).details).toEqual({ field: "privateKey" });
        expect((error as IVXPError).message).toContain("Invalid private key");
      }
    });

    it("should reject an empty services array", () => {
      expect(
        () =>
          new IVXPProvider({
            ...MINIMAL_CONFIG,
            services: [],
          }),
      ).toThrow("services");
    });

    it("should accept port 0 for OS-assigned port", () => {
      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        port: 0,
      });

      expect(provider.getPort()).toBe(0);
    });

    it("should reject a negative port number", () => {
      expect(
        () =>
          new IVXPProvider({
            ...MINIMAL_CONFIG,
            port: -1,
          }),
      ).toThrow("port");
    });

    it("should reject a port number above 65535", () => {
      expect(
        () =>
          new IVXPProvider({
            ...MINIMAL_CONFIG,
            port: 70000,
          }),
      ).toThrow("port");
    });

    it("should store service definitions immutably", async () => {
      const services: ServiceDefinition[] = [
        { type: "test", base_price_usdc: 5, estimated_delivery_hours: 1 },
      ];
      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        services,
      });

      const catalog = await provider.getCatalog();
      expect(catalog.services).toHaveLength(1);

      // Mutating the original array should not affect the provider
      services.push({
        type: "extra",
        base_price_usdc: 99,
        estimated_delivery_hours: 10,
      });
      const catalogAfterMutation = await provider.getCatalog();
      expect(catalogAfterMutation.services).toHaveLength(1);
    });

    it("should deep-copy service definitions (mutating returned catalog does not affect provider)", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      // Get catalog and mutate the returned service object
      const catalog1 = await provider.getCatalog();
      const originalPrice = catalog1.services[0].base_price_usdc;

      // Mutate the returned object -- cast to mutable for test purposes
      (catalog1.services[0] as { base_price_usdc: number }).base_price_usdc = 999;

      // Get catalog again -- internal state should be unaffected
      const catalog2 = await provider.getCatalog();
      expect(catalog2.services[0].base_price_usdc).toBe(originalPrice);
    });

    it("should deep-copy service definitions (mutating config objects does not affect provider)", async () => {
      const mutableService = {
        type: "mutable_test",
        base_price_usdc: 42,
        estimated_delivery_hours: 3,
      };
      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        services: [mutableService],
        cryptoService: new MockCryptoService({
          address: TEST_ACCOUNTS.provider.address,
        }),
        paymentService: new MockPaymentService(),
      });

      // Mutate the original service object after construction
      mutableService.base_price_usdc = 999;
      mutableService.type = "hacked";

      // Provider should still have the original values
      const catalog = await provider.getCatalog();
      expect(catalog.services[0].base_price_usdc).toBe(42);
      expect(catalog.services[0].type).toBe("mutable_test");
    });
  });

  // -------------------------------------------------------------------------
  // Dependency injection tests
  // -------------------------------------------------------------------------

  describe("dependency injection", () => {
    it("should use injected crypto service instead of creating one", () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.provider.address,
      });

      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        cryptoService: mockCrypto,
      });

      expect(provider.crypto).toBe(mockCrypto);
    });

    it("should use injected payment service instead of creating one", () => {
      const mockPayment = new MockPaymentService();

      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        paymentService: mockPayment,
      });

      expect(provider.payment).toBe(mockPayment);
    });

    it("should accept both service overrides simultaneously", () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.provider.address,
      });
      const mockPayment = new MockPaymentService();

      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        cryptoService: mockCrypto,
        paymentService: mockPayment,
      });

      expect(provider.crypto).toBe(mockCrypto);
      expect(provider.payment).toBe(mockPayment);
    });
  });

  // -------------------------------------------------------------------------
  // Getter tests
  // -------------------------------------------------------------------------

  describe("getAddress()", () => {
    it("should return the wallet address from crypto service (async)", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const address = await provider.getAddress();
      expect(address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should return the correct address when using real crypto service", async () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      const address = await provider.getAddress();
      expect(address).toBe(TEST_ACCOUNTS.provider.address);
    });
  });

  // -------------------------------------------------------------------------
  // getCatalog() tests (AC: #1, #2, #3)
  // -------------------------------------------------------------------------

  describe("getCatalog()", () => {
    it("should return a valid ServiceCatalog object", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog).toBeDefined();
      expect(catalog.protocol).toBe("IVXP/1.0");
      expect(catalog.message_type).toBe("service_catalog");
    });

    it("should include the provider wallet_address (AC #3)", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should include all registered services (AC #2)", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.services).toHaveLength(2);
      expect(catalog.services[0].type).toBe("code_review");
      expect(catalog.services[1].type).toBe("translation");
    });

    it("should include prices for all registered services (AC #2)", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.services[0].base_price_usdc).toBe(10);
      expect(catalog.services[1].base_price_usdc).toBe(25);
    });

    it("should include estimated delivery hours for all services", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.services[0].estimated_delivery_hours).toBe(1);
      expect(catalog.services[1].estimated_delivery_hours).toBe(2);
    });

    it("should include a valid ISO 8601 timestamp", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.timestamp).toBeDefined();
      expect(Date.parse(catalog.timestamp!)).not.toBeNaN();
    });

    it("should include a provider name defaulting to 'IVXP Provider'", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.provider).toBe("IVXP Provider");
    });

    it("should use custom provider name when configured", async () => {
      const config = createConfigWithMocks({ providerName: "My AI Service" });
      const provider = new IVXPProvider(config);

      const catalog = await provider.getCatalog();

      expect(catalog.provider).toBe("My AI Service");
    });

    it("should return a new catalog object each call (immutability)", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      const catalog1 = await provider.getCatalog();
      const catalog2 = await provider.getCatalog();

      // Should be equal in content but different references
      expect(catalog1).not.toBe(catalog2);
      expect(catalog1.wallet_address).toBe(catalog2.wallet_address);
      expect(catalog1.services).toEqual(catalog2.services);
    });
  });

  // -------------------------------------------------------------------------
  // Server lifecycle tests (start/stop)
  // -------------------------------------------------------------------------

  describe("start() and stop()", () => {
    it("should start an HTTP server on the configured port", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      expect(result.port).toBeGreaterThan(0);
      expect(result.host).toBe("127.0.0.1");
    });

    it("should serve GET /ivxp/catalog endpoint (AC #1)", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      // Fetch the catalog via HTTP
      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/catalog`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const catalog = await response.json();

      expect(catalog.protocol).toBe("IVXP/1.0");
      expect(catalog.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
      expect(catalog.services).toHaveLength(2);
      expect(catalog.services[0].type).toBe("code_review");
      expect(catalog.services[0].base_price_usdc).toBe(10);
    });

    it("should return 404 for unknown routes", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/unknown`);

      expect(response.status).toBe(404);
    });

    it("should return 405 for non-GET methods on /ivxp/catalog", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/catalog`, {
        method: "POST",
      });

      expect(response.status).toBe(405);
    });

    it("should stop the server gracefully", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);

      const result = await provider.start();
      const port = result.port;

      // Server should be reachable
      const beforeStop = await fetch(`http://127.0.0.1:${port}/ivxp/catalog`);
      expect(beforeStop.status).toBe(200);

      await provider.stop();

      // Server should no longer be reachable
      await expect(fetch(`http://127.0.0.1:${port}/ivxp/catalog`)).rejects.toThrow();
    });

    it("should be safe to call stop() multiple times", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);

      await provider.start();
      await provider.stop();

      // Should not throw on second stop
      await expect(provider.stop()).resolves.toBeUndefined();
    });

    it("should be safe to call stop() without start()", async () => {
      const config = createConfigWithMocks();
      const provider = new IVXPProvider(config);

      // Should not throw
      await expect(provider.stop()).resolves.toBeUndefined();
    });

    it("should throw if start() is called while already running", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      await provider.start();

      await expect(provider.start()).rejects.toThrow("already running");
    });

    it("should report isRunning() correctly", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      expect(provider.isRunning()).toBe(false);

      await provider.start();
      expect(provider.isRunning()).toBe(true);

      await provider.stop();
      expect(provider.isRunning()).toBe(false);
    });

    it("should use OS-assigned port when port is 0", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      // OS should assign a random available port
      expect(result.port).toBeGreaterThan(0);
      expect(result.port).toBeLessThanOrEqual(65535);
    });

    it("should serve catalog with trailing slash on URL", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/catalog/`);

      expect(response.status).toBe(200);
      const catalog = await response.json();
      expect(catalog.protocol).toBe("IVXP/1.0");
    });

    it("should serve catalog with query parameters on URL", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/catalog?format=json&v=2`);

      expect(response.status).toBe(200);
      const catalog = await response.json();
      expect(catalog.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should return 404 for path traversal attempts", async () => {
      const config = createConfigWithMocks({ port: 0, host: "127.0.0.1" });
      const provider = new IVXPProvider(config);
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(
        `http://127.0.0.1:${result.port}/ivxp/catalog/../../../etc/passwd`,
      );

      expect(response.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Service accessor tests
  // -------------------------------------------------------------------------

  describe("service accessors", () => {
    it("should expose crypto service via 'crypto' getter", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.crypto).toBeDefined();
    });

    it("should expose payment service via 'payment' getter", () => {
      const provider = new IVXPProvider(MINIMAL_CONFIG);

      expect(provider.payment).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Factory function tests
// ---------------------------------------------------------------------------

describe("createIVXPProvider", () => {
  it("should create a valid IVXPProvider instance", () => {
    const provider = createIVXPProvider(MINIMAL_CONFIG);

    expect(provider).toBeInstanceOf(IVXPProvider);
  });

  it("should pass config through to IVXPProvider constructor", () => {
    const provider = createIVXPProvider({
      ...MINIMAL_CONFIG,
      network: "base-mainnet",
    });

    expect(provider.getNetwork()).toBe("base-mainnet");
  });

  it("should reject an empty string private key with IVXPError", () => {
    try {
      createIVXPProvider({
        ...MINIMAL_CONFIG,
        privateKey: "" as `0x${string}`,
      });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(IVXPError);
      expect((error as IVXPError).code).toBe("INVALID_PRIVATE_KEY");
    }
  });

  it("should reject a missing services array", () => {
    expect(() =>
      createIVXPProvider({
        privateKey: TEST_ACCOUNTS.provider.privateKey as `0x${string}`,
        services: [],
      }),
    ).toThrow("services");
  });
});

// ---------------------------------------------------------------------------
// Quote endpoint tests (Story 3.15)
// ---------------------------------------------------------------------------

describe("IVXPProvider - Quote Endpoint", () => {
  /**
   * Helper to create a provider with mock services and an injectable order store.
   */
  function createQuoteTestProvider(overrides?: Partial<IVXPProviderConfig>): {
    provider: IVXPProvider;
    orderStore: MockOrderStorage;
  } {
    const orderStore = new MockOrderStorage();
    const mockCrypto = new MockCryptoService({
      address: TEST_ACCOUNTS.provider.address,
    });
    const mockPayment = new MockPaymentService();

    const provider = new IVXPProvider({
      ...MINIMAL_CONFIG,
      cryptoService: mockCrypto,
      paymentService: mockPayment,
      orderStore,
      ...overrides,
    });

    return { provider, orderStore };
  }

  /**
   * Build a minimal valid ServiceRequest wire-format body.
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

  // -------------------------------------------------------------------------
  // handleQuoteRequest unit tests
  // -------------------------------------------------------------------------

  describe("handleQuoteRequest()", () => {
    it("should generate a ServiceQuote with ivxp-uuid order ID (AC #1)", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      expect(quote.order_id).toMatch(
        /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("should return a valid ServiceQuote with correct structure (AC #2)", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      expect(quote.protocol).toBe("IVXP/1.0");
      expect(quote.message_type).toBe("service_quote");
      expect(quote.timestamp).toBeDefined();
      expect(Date.parse(quote.timestamp)).not.toBeNaN();
    });

    it("should include correct price from catalog (AC #2)", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      // code_review has base_price_usdc: 10
      expect(quote.quote.price_usdc).toBe(10);
    });

    it("should include payment address matching provider wallet (AC #2)", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      expect(quote.quote.payment_address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should include provider agent information", async () => {
      const { provider } = createQuoteTestProvider({ providerName: "My AI Service" });
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      expect(quote.provider_agent.name).toBe("My AI Service");
      expect(quote.provider_agent.wallet_address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should include network in quote details", async () => {
      const { provider } = createQuoteTestProvider({ network: "base-sepolia" });
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      expect(quote.quote.network).toBe("base-sepolia");
    });

    it("should include estimated delivery in quote details", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      // estimated_delivery should be a valid ISO timestamp
      expect(quote.quote.estimated_delivery).toBeDefined();
      expect(Date.parse(quote.quote.estimated_delivery)).not.toBeNaN();
    });

    it("should store order with 'quoted' status (AC #3)", async () => {
      const { provider, orderStore } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      const order = await orderStore.get(quote.order_id);
      expect(order).not.toBeNull();
      expect(order!.status).toBe("quoted");
    });

    it("should store order with correct service type", async () => {
      const { provider, orderStore } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      const order = await orderStore.get(quote.order_id);
      expect(order!.serviceType).toBe("code_review");
    });

    it("should store order with correct price", async () => {
      const { provider, orderStore } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      const order = await orderStore.get(quote.order_id);
      expect(order!.priceUsdc).toBe("10.000000");
    });

    it("should store order with correct client address", async () => {
      const { provider, orderStore } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      const order = await orderStore.get(quote.order_id);
      expect(order!.clientAddress).toBe(TEST_ACCOUNTS.client.address);
    });

    it("should store order with provider payment address", async () => {
      const { provider, orderStore } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      const order = await orderStore.get(quote.order_id);
      expect(order!.paymentAddress).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should generate unique order IDs for multiple quotes", async () => {
      const { provider } = createQuoteTestProvider();

      const quote1 = await provider.handleQuoteRequest(buildServiceRequest("code_review"));
      const quote2 = await provider.handleQuoteRequest(buildServiceRequest("code_review"));

      expect(quote1.order_id).not.toBe(quote2.order_id);
    });

    it("should reject unknown service with IVXPError", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("nonexistent_service");

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow(IVXPError);
    });

    it("should include 'Unknown service' in error message for unknown service", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("nonexistent_service");

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow("Unknown service");
    });

    it("should work with translation service type", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("translation");

      const quote = await provider.handleQuoteRequest(request);

      // translation has base_price_usdc: 25
      expect(quote.quote.price_usdc).toBe(25);
      expect(quote.order_id).toMatch(/^ivxp-/);
    });

    it("should allow retrieving order via getOrder()", async () => {
      const { provider } = createQuoteTestProvider();
      const request = buildServiceRequest("code_review");

      const quote = await provider.handleQuoteRequest(request);

      const order = await provider.getOrder(quote.order_id);
      expect(order).not.toBeNull();
      expect(order!.orderId).toBe(quote.order_id);
      expect(order!.status).toBe("quoted");
    });

    it("should return null from getOrder() for unknown order ID", async () => {
      const { provider } = createQuoteTestProvider();

      const order = await provider.getOrder("ivxp-nonexistent-0000-0000-000000000000");
      expect(order).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // HTTP endpoint tests (POST /ivxp/request)
  // -------------------------------------------------------------------------

  describe("POST /ivxp/request", () => {
    it("should return a ServiceQuote for a valid request", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();
      const request = buildServiceRequest("code_review");

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");

      const quote = await response.json();
      expect(quote.order_id).toMatch(/^ivxp-[0-9a-f-]{36}$/);
      expect(quote.protocol).toBe("IVXP/1.0");
      expect(quote.message_type).toBe("service_quote");
      expect(quote.quote.price_usdc).toBe(10);
      expect(quote.quote.payment_address).toBe(TEST_ACCOUNTS.provider.address);
    });

    it("should return 404 for unknown service in request", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();
      const request = buildServiceRequest("nonexistent_service");

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("Unknown service");
    });

    it("should return 400 for invalid JSON body", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing service_request field", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol: "IVXP/1.0" }),
      });

      expect(response.status).toBe(400);
    });

    it("should return 405 for GET on /ivxp/request", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "GET",
      });

      expect(response.status).toBe(405);
    });

    it("should handle request with trailing slash", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();
      const request = buildServiceRequest("code_review");

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(200);
      const quote = await response.json();
      expect(quote.order_id).toMatch(/^ivxp-/);
    });

    it("should return 400 with sanitized message for INVALID_REQUEST errors via HTTP (#3)", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();

      // Send request with empty service type
      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: "IVXP/1.0",
          message_type: "service_request",
          timestamp: new Date().toISOString(),
          client_agent: {
            name: "TestClient",
            wallet_address: TEST_ACCOUNTS.client.address,
          },
          service_request: {
            type: "",
            description: "Test",
            budget_usdc: 10,
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("service_request.type");
    });

    it("should return 400 with sanitized message for invalid wallet address via HTTP (#3)", async () => {
      const { provider } = createQuoteTestProvider({ port: 0, host: "127.0.0.1" });
      serversToCleanup.push(provider);

      const result = await provider.start();

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: "IVXP/1.0",
          message_type: "service_request",
          timestamp: new Date().toISOString(),
          client_agent: {
            name: "TestClient",
            wallet_address: "not-a-valid-address",
          },
          service_request: {
            type: "code_review",
            description: "Test",
            budget_usdc: 10,
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("wallet_address");
    });

    it("should not leak internal error details for non-SERVICE_NOT_FOUND errors (#3)", async () => {
      // Create a provider with an orderStore that throws IVXPError on create
      // simulating an internal failure with sensitive details in the error
      const failingStore = new MockOrderStorage({
        createError: new IVXPError("Internal DB error with sensitive info", "STORAGE_FAILURE", {
          connectionString: "postgres://secret:password@db:5432",
        }),
      });

      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.provider.address }),
        paymentService: new MockPaymentService(),
        orderStore: failingStore as unknown as IOrderStorage,
        port: 0,
        host: "127.0.0.1",
      });
      serversToCleanup.push(provider);

      const result = await provider.start();
      const request = buildServiceRequest("code_review");

      const response = await fetch(`http://127.0.0.1:${result.port}/ivxp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      // Should get a sanitized 400 (not a 500 with raw error details)
      // because the IVXPError is caught and mapped to a generic message
      expect(response.status).toBe(400);
      const body = await response.json();
      // Should return the sanitized "Invalid request" message
      expect(body.error).toBe("Invalid request");
      // Should NOT contain sensitive details from the original error
      expect(JSON.stringify(body)).not.toContain("postgres");
      expect(JSON.stringify(body)).not.toContain("password");
      expect(JSON.stringify(body)).not.toContain("STORAGE_FAILURE");
      expect(JSON.stringify(body)).not.toContain("connectionString");
    });
  });

  // -------------------------------------------------------------------------
  // Input validation tests (#2)
  // -------------------------------------------------------------------------

  describe("handleQuoteRequest() - input validation", () => {
    it("should reject empty service type with INVALID_REQUEST (#2)", async () => {
      const { provider } = createQuoteTestProvider();

      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: new Date().toISOString(),
        client_agent: {
          name: "TestClient",
          wallet_address: TEST_ACCOUNTS.client.address,
        },
        service_request: {
          type: "",
          description: "Test",
          budget_usdc: 10,
        },
      };

      try {
        await provider.handleQuoteRequest(request);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST");
        expect((error as IVXPError).message).toContain("service_request.type");
      }
    });

    it("should reject whitespace-only service type (#2)", async () => {
      const { provider } = createQuoteTestProvider();

      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: new Date().toISOString(),
        client_agent: {
          name: "TestClient",
          wallet_address: TEST_ACCOUNTS.client.address,
        },
        service_request: {
          type: "   ",
          description: "Test",
          budget_usdc: 10,
        },
      };

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow("service_request.type");
    });

    it("should reject invalid wallet address format (#2)", async () => {
      const { provider } = createQuoteTestProvider();

      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: new Date().toISOString(),
        client_agent: {
          name: "TestClient",
          wallet_address: "not-a-valid-address" as `0x${string}`,
        },
        service_request: {
          type: "code_review",
          description: "Test",
          budget_usdc: 10,
        },
      };

      try {
        await provider.handleQuoteRequest(request);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_REQUEST");
        expect((error as IVXPError).message).toContain("wallet_address");
      }
    });

    it("should reject wallet address without 0x prefix (#2)", async () => {
      const { provider } = createQuoteTestProvider();

      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: new Date().toISOString(),
        client_agent: {
          name: "TestClient",
          wallet_address: "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
        },
        service_request: {
          type: "code_review",
          description: "Test",
          budget_usdc: 10,
        },
      };

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow("wallet_address");
    });

    it("should reject wallet address that is too short (#2)", async () => {
      const { provider } = createQuoteTestProvider();

      const request: ServiceRequest = {
        protocol: "IVXP/1.0",
        message_type: "service_request",
        timestamp: new Date().toISOString(),
        client_agent: {
          name: "TestClient",
          wallet_address: "0xbad" as `0x${string}`,
        },
        service_request: {
          type: "code_review",
          description: "Test",
          budget_usdc: 10,
        },
      };

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow("wallet_address");
    });
  });

  // -------------------------------------------------------------------------
  // Price and delivery validation tests (#4, #5)
  // -------------------------------------------------------------------------

  describe("handleQuoteRequest() - price and delivery validation", () => {
    it("should reject service with price exceeding 1M USDC (#4)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "expensive", base_price_usdc: 1_500_000, estimated_delivery_hours: 1 }],
      });

      const request = buildServiceRequest("expensive");

      try {
        await provider.handleQuoteRequest(request);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_CONFIG");
        expect((error as IVXPError).message).toContain("price out of range");
      }
    });

    it("should reject service with negative price (#4)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "free_broken", base_price_usdc: -5, estimated_delivery_hours: 1 }],
      });

      const request = buildServiceRequest("free_broken");

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow("price out of range");
    });

    it("should accept service with price at boundary (1M USDC) (#4)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "max_price", base_price_usdc: 1_000_000, estimated_delivery_hours: 1 }],
      });

      const request = buildServiceRequest("max_price");
      const quote = await provider.handleQuoteRequest(request);

      expect(quote.quote.price_usdc).toBe(1_000_000);
    });

    it("should accept zero-priced service (#4)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "free_service", base_price_usdc: 0, estimated_delivery_hours: 1 }],
      });

      const request = buildServiceRequest("free_service");
      const quote = await provider.handleQuoteRequest(request);

      expect(quote.quote.price_usdc).toBe(0);
    });

    it("should reject service with estimated delivery hours exceeding 8760 (#5)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "very_slow", base_price_usdc: 10, estimated_delivery_hours: 10000 }],
      });

      const request = buildServiceRequest("very_slow");

      try {
        await provider.handleQuoteRequest(request);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_CONFIG");
        expect((error as IVXPError).message).toContain("delivery hours out of range");
      }
    });

    it("should reject service with zero delivery hours (#5)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "instant", base_price_usdc: 10, estimated_delivery_hours: 0 }],
      });

      const request = buildServiceRequest("instant");

      await expect(provider.handleQuoteRequest(request)).rejects.toThrow(
        "delivery hours out of range",
      );
    });

    it("should accept service with delivery hours at boundary (8760) (#5)", async () => {
      const { provider } = createQuoteTestProvider({
        services: [{ type: "yearly", base_price_usdc: 10, estimated_delivery_hours: 8760 }],
      });

      const request = buildServiceRequest("yearly");
      const quote = await provider.handleQuoteRequest(request);

      expect(quote.quote.estimated_delivery).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // OrderStore DI validation tests (#6)
  // -------------------------------------------------------------------------

  describe("constructor - orderStore DI validation", () => {
    it("should reject an orderStore missing the create method (#6)", () => {
      const incompleteStore = {
        get: async () => null,
        update: async () => ({}) as never,
        list: async () => [],
        delete: async () => {},
      } as unknown as IOrderStorage;

      expect(
        () =>
          new IVXPProvider({
            ...MINIMAL_CONFIG,
            cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.provider.address }),
            paymentService: new MockPaymentService(),
            orderStore: incompleteStore,
          }),
      ).toThrow("create");
    });

    it("should reject an orderStore missing the get method (#6)", () => {
      const incompleteStore = {
        create: async () => ({}) as never,
        update: async () => ({}) as never,
        list: async () => [],
        delete: async () => {},
      } as unknown as IOrderStorage;

      expect(
        () =>
          new IVXPProvider({
            ...MINIMAL_CONFIG,
            cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.provider.address }),
            paymentService: new MockPaymentService(),
            orderStore: incompleteStore,
          }),
      ).toThrow("get");
    });

    it("should reject an orderStore that is an empty object (#6)", () => {
      const emptyStore = {} as unknown as IOrderStorage;

      expect(
        () =>
          new IVXPProvider({
            ...MINIMAL_CONFIG,
            cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.provider.address }),
            paymentService: new MockPaymentService(),
            orderStore: emptyStore,
          }),
      ).toThrow(IVXPError);
    });

    it("should accept a valid MockOrderStorage (#6)", () => {
      const store = new MockOrderStorage();

      const provider = new IVXPProvider({
        ...MINIMAL_CONFIG,
        cryptoService: new MockCryptoService({ address: TEST_ACCOUNTS.provider.address }),
        paymentService: new MockPaymentService(),
        orderStore: store,
      });

      expect(provider).toBeInstanceOf(IVXPProvider);
    });
  });
});
