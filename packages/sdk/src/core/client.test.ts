/**
 * IVXPClient unit tests.
 *
 * Tests the IVXPClient constructor, configuration, dependency injection,
 * factory function validation, getter methods, and getCatalog().
 *
 * Uses mocks from @ivxp/test-utils to avoid real blockchain calls.
 */

import { describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
  createMockServiceCatalog,
} from "@ivxp/test-utils";
import { IVXPClient, createIVXPClient, type IVXPClientConfig } from "./client.js";
import { ServiceUnavailableError } from "../errors/specific.js";
import { IVXPError } from "../errors/base.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid config for constructing an IVXPClient. */
const MINIMAL_CONFIG: IVXPClientConfig = {
  privateKey: TEST_ACCOUNTS.client.privateKey as `0x${string}`,
};

// ---------------------------------------------------------------------------
// Constructor tests
// ---------------------------------------------------------------------------

describe("IVXPClient", () => {
  describe("constructor", () => {
    it("should create a client with minimal config (privateKey only)", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client).toBeInstanceOf(IVXPClient);
    });

    it("should default network to 'base-sepolia'", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.getNetwork()).toBe("base-sepolia");
    });

    it("should accept a custom network", () => {
      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        network: "base-mainnet",
      });

      expect(client.getNetwork()).toBe("base-mainnet");
    });

    it("should initialize internal crypto service when not injected", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      // crypto accessor should return a valid ICryptoService
      expect(client.crypto).toBeDefined();
      expect(typeof client.crypto.sign).toBe("function");
      expect(typeof client.crypto.verify).toBe("function");
      expect(typeof client.crypto.getAddress).toBe("function");
    });

    it("should initialize internal payment service when not injected", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.payment).toBeDefined();
      expect(typeof client.payment.send).toBe("function");
      expect(typeof client.payment.verify).toBe("function");
      expect(typeof client.payment.getBalance).toBe("function");
    });

    it("should initialize internal http client when not injected", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.http).toBeDefined();
      expect(typeof client.http.get).toBe("function");
      expect(typeof client.http.post).toBe("function");
    });

    it("should reject an invalid private key", () => {
      expect(() => new IVXPClient({ privateKey: "0xbad" as `0x${string}` })).toThrow(
        "Invalid private key",
      );
    });

    it("should propagate PaymentService error for invalid network", () => {
      expect(
        () =>
          new IVXPClient({
            ...MINIMAL_CONFIG,
            network: "invalid-network" as "base-sepolia",
          }),
      ).toThrow("Unsupported network");
    });
  });

  // -------------------------------------------------------------------------
  // Dependency injection tests
  // -------------------------------------------------------------------------

  describe("dependency injection", () => {
    it("should use injected crypto service instead of creating one", () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        cryptoService: mockCrypto,
      });

      expect(client.crypto).toBe(mockCrypto);
    });

    it("should use injected payment service instead of creating one", () => {
      const mockPayment = new MockPaymentService();

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        paymentService: mockPayment,
      });

      expect(client.payment).toBe(mockPayment);
    });

    it("should use injected http client instead of creating one", () => {
      const mockHttp = new MockHttpClient();

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        httpClient: mockHttp,
      });

      expect(client.http).toBe(mockHttp);
    });

    it("should accept all three service overrides simultaneously", () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.provider.address,
      });
      const mockPayment = new MockPaymentService();
      const mockHttp = new MockHttpClient();

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        cryptoService: mockCrypto,
        paymentService: mockPayment,
        httpClient: mockHttp,
      });

      expect(client.crypto).toBe(mockCrypto);
      expect(client.payment).toBe(mockPayment);
      expect(client.http).toBe(mockHttp);
    });
  });

  // -------------------------------------------------------------------------
  // Getter tests
  // -------------------------------------------------------------------------

  describe("getAddress()", () => {
    it("should return the wallet address from crypto service (async)", async () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        cryptoService: mockCrypto,
      });

      const address = await client.getAddress();
      expect(address).toBe(TEST_ACCOUNTS.client.address);
    });

    it("should return the correct address when using real crypto service", async () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      const address = await client.getAddress();
      expect(address).toBe(TEST_ACCOUNTS.client.address);
    });
  });

  describe("getNetwork()", () => {
    it("should return 'base-sepolia' when no network specified", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.getNetwork()).toBe("base-sepolia");
    });

    it("should return 'base-mainnet' when configured", () => {
      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        network: "base-mainnet",
      });

      expect(client.getNetwork()).toBe("base-mainnet");
    });
  });

  describe("getBalance()", () => {
    it("should delegate to payment service with the client address", async () => {
      const mockCrypto = new MockCryptoService({
        address: TEST_ACCOUNTS.client.address,
      });
      const mockPayment = new MockPaymentService({
        defaultBalance: "500.000000",
      });

      const client = new IVXPClient({
        ...MINIMAL_CONFIG,
        cryptoService: mockCrypto,
        paymentService: mockPayment,
      });

      const balance = await client.getBalance();

      expect(balance).toBe("500.000000");

      // Verify the payment service was called with the correct address
      const calls = mockPayment.getGetBalanceCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].address).toBe(TEST_ACCOUNTS.client.address);
    });
  });

  // -------------------------------------------------------------------------
  // Service accessor tests
  // -------------------------------------------------------------------------

  describe("service accessors", () => {
    it("should expose crypto service via 'crypto' getter", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.crypto).toBeDefined();
    });

    it("should expose payment service via 'payment' getter", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.payment).toBeDefined();
    });

    it("should expose http client via 'http' getter", () => {
      const client = new IVXPClient(MINIMAL_CONFIG);

      expect(client.http).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // getCatalog() tests
  // -------------------------------------------------------------------------

  describe("getCatalog()", () => {
    /** Create a client with mock HTTP client for catalog tests. */
    function createClientWithMockHttp(mockHttp: MockHttpClient): IVXPClient {
      return new IVXPClient({
        ...MINIMAL_CONFIG,
        httpClient: mockHttp,
      });
    }

    it("should fetch and validate a catalog from the provider URL", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const catalog = await client.getCatalog("http://provider.test");

      // Verify the response is transformed to camelCase
      expect(catalog.protocol).toBe("IVXP/1.0");
      expect(catalog.provider).toBe("TestProvider");
      // HexAddressSchema normalizes to lowercase
      expect(catalog.walletAddress).toBe(TEST_ACCOUNTS.provider.address.toLowerCase());
      expect(catalog.services).toHaveLength(3);
      expect(catalog.services[0].type).toBe("code_review");
      expect(catalog.services[0].basePriceUsdc).toBe(10);
      expect(catalog.services[0].estimatedDeliveryHours).toBe(1);
    });

    it("should call GET {providerUrl}/ivxp/catalog", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      await client.getCatalog("http://provider.test");

      const calls = mockHttp.getGetCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("http://provider.test/ivxp/catalog");
    });

    it("should strip trailing slash from provider URL", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      await client.getCatalog("http://provider.test/");

      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe("http://provider.test/ivxp/catalog");
    });

    it("should return a properly typed ServiceCatalogOutput object", async () => {
      const wireCatalog = createMockServiceCatalog({
        services: [{ type: "translation", base_price_usdc: 25, estimated_delivery_hours: 2 }],
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const catalog = await client.getCatalog("http://provider.test");

      // Should have camelCase fields (Zod transform output)
      expect(catalog).toHaveProperty("walletAddress");
      expect(catalog).toHaveProperty("services");
      expect(catalog.services[0]).toHaveProperty("basePriceUsdc");
      expect(catalog.services[0]).toHaveProperty("estimatedDeliveryHours");

      // Should NOT have snake_case fields (wire format)
      expect(catalog).not.toHaveProperty("wallet_address");
      expect(catalog.services[0]).not.toHaveProperty("base_price_usdc");
    });

    it("should throw IVXPError with INVALID_CATALOG_FORMAT for invalid response", async () => {
      const mockHttp = new MockHttpClient({ defaultGetResponse: { invalid: true } });
      const client = createClientWithMockHttp(mockHttp);

      await expect(client.getCatalog("http://provider.test")).rejects.toThrow(IVXPError);
      await expect(client.getCatalog("http://provider.test")).rejects.toThrow(
        /Invalid catalog format.*validation issue/,
      );
    });

    it("should set INVALID_CATALOG_FORMAT error code on validation failure", async () => {
      const mockHttp = new MockHttpClient({ defaultGetResponse: { invalid: true } });
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("http://provider.test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_CATALOG_FORMAT");
        // Should include issue count, not raw response data
        expect((error as IVXPError).details).toHaveProperty("issueCount");
        expect(typeof (error as IVXPError).details?.issueCount).toBe("number");
      }
    });

    it("should throw ServiceUnavailableError on network failure", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Network error"),
      });
      const client = createClientWithMockHttp(mockHttp);

      await expect(client.getCatalog("http://provider.test")).rejects.toThrow(
        ServiceUnavailableError,
      );
    });

    it("should re-throw IVXPError subclasses from HTTP client without wrapping", async () => {
      const mockHttp = new MockHttpClient({
        getError: new ServiceUnavailableError("Provider is down"),
      });
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("http://provider.test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toBe("Provider is down");
      }
    });

    it("should include provider URL in ServiceUnavailableError message", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Connection refused"),
      });
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("http://provider.test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableError);
        expect((error as ServiceUnavailableError).message).toContain("http://provider.test");
      }
    });

    it("should validate missing required fields", async () => {
      // Missing 'services' field
      const incompleteCatalog = {
        protocol: "IVXP/1.0",
        provider: "TestProvider",
        wallet_address: TEST_ACCOUNTS.provider.address,
        // services missing
      };
      const mockHttp = new MockHttpClient({ defaultGetResponse: incompleteCatalog });
      const client = createClientWithMockHttp(mockHttp);

      await expect(client.getCatalog("http://provider.test")).rejects.toThrow(
        /Invalid catalog format/,
      );
    });

    it("should validate invalid service definition within catalog", async () => {
      const catalogWithBadService = {
        protocol: "IVXP/1.0",
        provider: "TestProvider",
        wallet_address: TEST_ACCOUNTS.provider.address,
        services: [{ type: "code_review", base_price_usdc: -5, estimated_delivery_hours: 1 }],
      };
      const mockHttp = new MockHttpClient({ defaultGetResponse: catalogWithBadService });
      const client = createClientWithMockHttp(mockHttp);

      await expect(client.getCatalog("http://provider.test")).rejects.toThrow(
        /Invalid catalog format/,
      );
    });

    it("should handle catalog with optional fields missing", async () => {
      // Catalog without message_type and timestamp (optional fields)
      const minimalCatalog = {
        protocol: "IVXP/1.0",
        provider: "MinimalProvider",
        wallet_address: TEST_ACCOUNTS.provider.address,
        services: [{ type: "code_review", base_price_usdc: 5, estimated_delivery_hours: 1 }],
      };
      const mockHttp = new MockHttpClient({ defaultGetResponse: minimalCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const catalog = await client.getCatalog("http://provider.test");

      expect(catalog.provider).toBe("MinimalProvider");
      expect(catalog.messageType).toBeUndefined();
      expect(catalog.timestamp).toBeUndefined();
    });

    it("should emit 'catalog.received' event on successful fetch", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const receivedEvents: Array<{ provider: string; servicesCount: number }> = [];
      client.on("catalog.received", (payload) => {
        receivedEvents.push(payload);
      });

      await client.getCatalog("http://provider.test");

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].provider).toBe("TestProvider");
      expect(receivedEvents[0].servicesCount).toBe(3);
    });

    it("should not emit event on fetch failure", async () => {
      const mockHttp = new MockHttpClient({
        getError: new Error("Network error"),
      });
      const client = createClientWithMockHttp(mockHttp);

      const receivedEvents: unknown[] = [];
      client.on("catalog.received", (payload) => {
        receivedEvents.push(payload);
      });

      await expect(client.getCatalog("http://provider.test")).rejects.toThrow();

      expect(receivedEvents).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // URL validation (Issue #4)
    // -----------------------------------------------------------------------

    it("should reject empty provider URL", async () => {
      const mockHttp = new MockHttpClient();
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject non-HTTP protocol URLs", async () => {
      const mockHttp = new MockHttpClient();
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("javascript:alert(1)");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
        expect((error as IVXPError).message).toContain("http or https");
      }
    });

    it("should reject unparseable URLs", async () => {
      const mockHttp = new MockHttpClient();
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("not-a-url");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should reject ftp:// protocol URLs", async () => {
      const mockHttp = new MockHttpClient();
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("ftp://provider.test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_PROVIDER_URL");
      }
    });

    it("should accept https:// provider URLs", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const catalog = await client.getCatalog("https://provider.test");

      expect(catalog.provider).toBe("TestProvider");
      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe("https://provider.test/ivxp/catalog");
    });

    // -----------------------------------------------------------------------
    // Multiple trailing slashes (Issue #5)
    // -----------------------------------------------------------------------

    it("should strip multiple trailing slashes from provider URL", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      await client.getCatalog("http://provider.test///");

      const calls = mockHttp.getGetCalls();
      expect(calls[0].url).toBe("http://provider.test/ivxp/catalog");
    });

    // -----------------------------------------------------------------------
    // Address normalization (Issue #10)
    // -----------------------------------------------------------------------

    it("should normalize wallet address to lowercase via Zod transform", async () => {
      const wireCatalog = createMockServiceCatalog({
        wallet_address: "0xABCDef1234567890ABCDEF1234567890AbCdEf12",
      });
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const catalog = await client.getCatalog("http://provider.test");

      expect(catalog.walletAddress).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    // -----------------------------------------------------------------------
    // Event handler error isolation (Issue #2)
    // -----------------------------------------------------------------------

    it("should not propagate event handler errors to getCatalog caller", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      client.on("catalog.received", () => {
        throw new Error("Handler error that should be swallowed");
      });

      // getCatalog should succeed despite the throwing handler
      const catalog = await client.getCatalog("http://provider.test");
      expect(catalog.provider).toBe("TestProvider");
    });

    it("should invoke all handlers even if an earlier one throws", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const callOrder: number[] = [];

      client.on("catalog.received", () => {
        callOrder.push(1);
        throw new Error("First handler throws");
      });

      client.on("catalog.received", () => {
        callOrder.push(2);
      });

      client.on("catalog.received", () => {
        callOrder.push(3);
      });

      await client.getCatalog("http://provider.test");

      expect(callOrder).toEqual([1, 2, 3]);
    });

    // -----------------------------------------------------------------------
    // off() memory cleanup (Issue #1)
    // -----------------------------------------------------------------------

    it("should remove Map entry after last handler is unsubscribed", async () => {
      const wireCatalog = createMockServiceCatalog();
      const mockHttp = new MockHttpClient({ defaultGetResponse: wireCatalog });
      const client = createClientWithMockHttp(mockHttp);

      const receivedEvents: unknown[] = [];
      const handler = (payload: { provider: string; servicesCount: number }) => {
        receivedEvents.push(payload);
      };

      client.on("catalog.received", handler);
      client.off("catalog.received", handler);

      // After unsubscribe, fetching catalog should not invoke handler
      await client.getCatalog("http://provider.test");
      expect(receivedEvents).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // ZodError sanitization (Issue #6)
    // -----------------------------------------------------------------------

    it("should not expose raw response data in validation error message", async () => {
      const mockHttp = new MockHttpClient({
        defaultGetResponse: { secret_key: "super-secret-value", invalid: true },
      });
      const client = createClientWithMockHttp(mockHttp);

      try {
        await client.getCatalog("http://provider.test");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        const ivxpError = error as IVXPError;
        // Message should use generic format, not raw Zod output
        expect(ivxpError.message).toMatch(/validation issue/);
        // Details should contain issue count, not raw issues array
        expect(ivxpError.details).toHaveProperty("issueCount");
        expect(ivxpError.details).not.toHaveProperty("issues");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Factory function tests
// ---------------------------------------------------------------------------

describe("createIVXPClient", () => {
  it("should create a valid IVXPClient instance", () => {
    const client = createIVXPClient(MINIMAL_CONFIG);

    expect(client).toBeInstanceOf(IVXPClient);
  });

  it("should pass config through to IVXPClient constructor", () => {
    const client = createIVXPClient({
      ...MINIMAL_CONFIG,
      network: "base-mainnet",
    });

    expect(client.getNetwork()).toBe("base-mainnet");
  });

  describe("private key validation", () => {
    it("should reject a non-0x-prefixed key", () => {
      expect(() =>
        createIVXPClient({
          privateKey:
            "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`,
        }),
      ).toThrow("Invalid private key");
    });

    it("should reject a key that is too short", () => {
      expect(() =>
        createIVXPClient({
          privateKey: "0xac0974" as `0x${string}`,
        }),
      ).toThrow("Invalid private key");
    });

    it("should reject a key that is too long", () => {
      expect(() =>
        createIVXPClient({
          privateKey:
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80ff" as `0x${string}`,
        }),
      ).toThrow("Invalid private key");
    });

    it("should reject a key with non-hex characters", () => {
      expect(() =>
        createIVXPClient({
          privateKey:
            "0xgg0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`,
        }),
      ).toThrow("Invalid private key");
    });

    it("should accept a valid private key", () => {
      expect(() => createIVXPClient(MINIMAL_CONFIG)).not.toThrow();
    });

    it("should reject an empty string private key", () => {
      expect(() =>
        createIVXPClient({
          privateKey: "" as `0x${string}`,
        }),
      ).toThrow("Missing private key");
    });

    it("should reject a bare '0x' prefix with no key data", () => {
      expect(() =>
        createIVXPClient({
          privateKey: "0x" as `0x${string}`,
        }),
      ).toThrow("Invalid private key");
    });
  });
});
