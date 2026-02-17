/**
 * Provider test fixture for TS-TS interop tests.
 *
 * Starts a real IVXPProvider HTTP server with mock crypto/payment
 * services and configurable service handlers.
 */

import { MockCryptoService, MockPaymentService, TEST_ACCOUNTS } from "@ivxp/test-utils";
import type { ServiceDefinition } from "@ivxp/protocol";
import {
  IVXPProvider,
  type IVXPProviderConfig,
  type ServiceHandler,
} from "../../../core/provider.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_KEY = TEST_ACCOUNTS.provider.privateKey as `0x${string}`;
const PROVIDER_ADDRESS = TEST_ACCOUNTS.provider.address;

/** Default test services offered by the fixture provider. */
const DEFAULT_SERVICES: readonly ServiceDefinition[] = [
  { type: "text_echo", base_price_usdc: 1, estimated_delivery_hours: 0.01 },
  { type: "json_transform", base_price_usdc: 5, estimated_delivery_hours: 0.1 },
];

// ---------------------------------------------------------------------------
// Service handlers
// ---------------------------------------------------------------------------

/** Echo handler: returns the input text back as JSON. */
const textEchoHandler: ServiceHandler = async (order) => ({
  content: JSON.stringify({
    original_text: order.serviceType,
    echoed_text: order.serviceType,
    order_id: order.orderId,
  }),
  content_type: "application/json",
});

/** JSON transform handler: returns a structured analysis. */
const jsonTransformHandler: ServiceHandler = async (order) => ({
  content: JSON.stringify({
    transformed: true,
    service: order.serviceType,
    order_id: order.orderId,
  }),
  content_type: "application/json",
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderFixture {
  readonly provider: IVXPProvider;
  readonly port: number;
  readonly baseUrl: string;
  readonly mockCrypto: MockCryptoService;
  readonly mockPayment: MockPaymentService;
  readonly stop: () => Promise<void>;
}

export interface ProviderFixtureConfig {
  readonly services?: readonly ServiceDefinition[];
  readonly handlers?: ReadonlyMap<string, ServiceHandler>;
  readonly providerOverrides?: Partial<IVXPProviderConfig>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Start a real IVXPProvider HTTP server for interop testing.
 *
 * Uses port 0 for OS-assigned ephemeral port to avoid conflicts.
 * Mock crypto/payment services isolate from blockchain.
 */
export async function startProviderFixture(
  config: ProviderFixtureConfig = {},
): Promise<ProviderFixture> {
  const mockCrypto = new MockCryptoService({ address: PROVIDER_ADDRESS });
  const mockPayment = new MockPaymentService();

  const services = config.services ?? [...DEFAULT_SERVICES];
  const handlers =
    config.handlers ??
    new Map<string, ServiceHandler>([
      ["text_echo", textEchoHandler],
      ["json_transform", jsonTransformHandler],
    ]);

  const provider = new IVXPProvider({
    privateKey: PROVIDER_KEY,
    services: [...services],
    port: 0,
    host: "127.0.0.1",
    cryptoService: mockCrypto,
    paymentService: mockPayment,
    serviceHandlers: handlers,
    allowPrivateDeliveryUrls: true,
    ...config.providerOverrides,
  });

  const { port } = await provider.start();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    provider,
    port,
    baseUrl,
    mockCrypto,
    mockPayment,
    stop: () => provider.stop(),
  };
}
