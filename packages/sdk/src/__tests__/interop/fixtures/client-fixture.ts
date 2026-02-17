/**
 * Client test fixture for TS-TS interop tests.
 *
 * Creates a real IVXPClient configured to talk to a real IVXPProvider
 * HTTP server. Uses mock crypto/payment services by default, with an
 * option to use real services connected to Anvil.
 */

import { MockCryptoService, MockPaymentService, TEST_ACCOUNTS } from "@ivxp/test-utils";
import { IVXPClient, type IVXPClientConfig } from "../../../core/client.js";
import { createHttpClient } from "../../../http/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_KEY = TEST_ACCOUNTS.client.privateKey as `0x${string}`;
const CLIENT_ADDRESS = TEST_ACCOUNTS.client.address;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientFixture {
  readonly client: IVXPClient;
  readonly address: string;
  readonly mockCrypto: MockCryptoService;
  readonly mockPayment: MockPaymentService;
}

export interface ClientFixtureConfig {
  readonly clientOverrides?: Partial<IVXPClientConfig>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an IVXPClient for interop testing.
 *
 * Uses a real HTTP client (fetch-based) to make actual HTTP requests
 * to the provider server. Mock crypto/payment services isolate from
 * blockchain interactions.
 */
export function createClientFixture(config: ClientFixtureConfig = {}): ClientFixture {
  const mockCrypto = new MockCryptoService({ address: CLIENT_ADDRESS });
  const mockPayment = new MockPaymentService();

  const client = new IVXPClient({
    privateKey: CLIENT_KEY,
    network: "base-sepolia",
    httpClient: createHttpClient(),
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    ...config.clientOverrides,
  });

  return {
    client,
    address: CLIENT_ADDRESS,
    mockCrypto,
    mockPayment,
  };
}
