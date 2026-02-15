/**
 * IVXPClient unit tests.
 *
 * Tests the IVXPClient constructor, configuration, dependency injection,
 * factory function validation, and getter methods.
 *
 * Uses mocks from @ivxp/test-utils to avoid real blockchain calls.
 */

import { describe, expect, it } from "vitest";
import {
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  TEST_ACCOUNTS,
} from "@ivxp/test-utils";
import { IVXPClient, createIVXPClient, type IVXPClientConfig } from "./client.js";

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
