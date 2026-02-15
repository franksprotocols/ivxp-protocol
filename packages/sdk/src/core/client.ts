/**
 * IVXPClient -- Main client class for the IVXP SDK.
 *
 * Provides a unified entry point for interacting with the IVXP protocol.
 * Internally initializes CryptoService, PaymentService, and HttpClient,
 * with dependency injection support for testing.
 *
 * Features:
 * - One-line construction with just a private key
 * - Default network: Base Sepolia
 * - Internal service initialization (crypto, payment, HTTP)
 * - Dependency injection for all services
 * - Factory function with input validation
 */

import type { ICryptoService, IPaymentService, IHttpClient } from "@ivxp/protocol";
import { createCryptoService } from "../crypto/index.js";
import { PaymentService, type NetworkType } from "../payment/index.js";
import { createHttpClient } from "../http/index.js";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for creating an IVXPClient instance.
 */
export interface IVXPClientConfig {
  /** The 0x-prefixed hex private key for signing and payments (32 bytes). */
  readonly privateKey: `0x${string}`;

  /** The network to use. Defaults to "base-sepolia". */
  readonly network?: NetworkType;

  /** Optional: Custom HTTP client for testing or custom transport. */
  readonly httpClient?: IHttpClient;

  /** Optional: Custom crypto service for testing. */
  readonly cryptoService?: ICryptoService;

  /** Optional: Custom payment service for testing. */
  readonly paymentService?: IPaymentService;
}

// ---------------------------------------------------------------------------
// IVXPClient
// ---------------------------------------------------------------------------

/**
 * Main client for the IVXP protocol.
 *
 * Provides access to cryptographic signing, USDC payments, and HTTP
 * communication. Services are created internally by default but can
 * be overridden via dependency injection for testing.
 *
 * @example
 * ```typescript
 * import { createIVXPClient } from "@ivxp/sdk";
 *
 * const client = createIVXPClient({
 *   privateKey: "0x...",
 * });
 *
 * const address = await client.getAddress();
 * const balance = await client.getBalance();
 * ```
 */
export class IVXPClient {
  private readonly cryptoService: ICryptoService;
  private readonly paymentService: IPaymentService;
  private readonly httpClient: IHttpClient;
  private readonly network: NetworkType;

  /**
   * Create a new IVXPClient instance.
   *
   * Validates the private key format. Prefer using the `createIVXPClient`
   * factory function which provides more specific error messages.
   *
   * @param config - Client configuration with privateKey and optional overrides
   * @throws If the private key format is invalid
   */
  constructor(config: IVXPClientConfig) {
    const { privateKey, network = "base-sepolia" } = config;

    if (!privateKey || !PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new Error(
        "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
      );
    }

    this.network = network;

    // Initialize services with DI support: use injected service if provided,
    // otherwise create a default implementation.
    this.cryptoService = config.cryptoService ?? createCryptoService(privateKey);

    this.paymentService = config.paymentService ?? new PaymentService({ privateKey, network });

    this.httpClient = config.httpClient ?? createHttpClient();
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  /**
   * Get the wallet address for this client.
   *
   * Delegates to the crypto service. Async because ICryptoService.getAddress()
   * is async to support wallet-switching scenarios.
   *
   * @returns The hex-encoded wallet address (0x-prefixed, checksummed)
   */
  async getAddress(): Promise<`0x${string}`> {
    return this.cryptoService.getAddress();
  }

  /**
   * Get the network this client is configured for.
   *
   * @returns The network type ("base-mainnet" or "base-sepolia")
   */
  getNetwork(): NetworkType {
    return this.network;
  }

  /**
   * Get the USDC balance for this client's wallet.
   *
   * Delegates to the payment service, passing the client's own address.
   *
   * @returns USDC balance as a human-readable decimal string (e.g. "100.500000")
   */
  async getBalance(): Promise<string> {
    const address = await this.getAddress();
    return this.paymentService.getBalance(address);
  }

  // -------------------------------------------------------------------------
  // Service accessors (for advanced usage)
  // -------------------------------------------------------------------------

  /** Access the underlying crypto service. */
  get crypto(): ICryptoService {
    return this.cryptoService;
  }

  /** Access the underlying payment service. */
  get payment(): IPaymentService {
    return this.paymentService;
  }

  /** Access the underlying HTTP client. */
  get http(): IHttpClient {
    return this.httpClient;
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new IVXPClient instance with input validation.
 *
 * Validates the private key format before constructing the client.
 * Prefer this over `new IVXPClient()` for safer construction.
 *
 * @param config - Client configuration
 * @returns A configured IVXPClient instance
 * @throws If the private key format is invalid
 *
 * @example
 * ```typescript
 * import { createIVXPClient } from "@ivxp/sdk";
 *
 * // Minimal usage
 * const client = createIVXPClient({
 *   privateKey: "0x...",
 * });
 *
 * // With custom network
 * const mainnetClient = createIVXPClient({
 *   privateKey: "0x...",
 *   network: "base-mainnet",
 * });
 *
 * // With dependency injection for testing
 * const testClient = createIVXPClient({
 *   privateKey: "0x...",
 *   cryptoService: mockCrypto,
 *   paymentService: mockPayment,
 * });
 * ```
 */
export function createIVXPClient(config: IVXPClientConfig): IVXPClient {
  if (!config.privateKey) {
    throw new Error("Missing private key: config.privateKey is required");
  }

  if (!PRIVATE_KEY_REGEX.test(config.privateKey)) {
    throw new Error(
      "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
    );
  }

  return new IVXPClient(config);
}
