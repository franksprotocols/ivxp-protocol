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
  TEST_ACCOUNTS,
  DEFAULT_SERVICE_DEFINITIONS,
} from "@ivxp/test-utils";
import type { ServiceDefinition } from "@ivxp/protocol";
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
