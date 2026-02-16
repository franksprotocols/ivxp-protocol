/**
 * Order and quote fixture factories for testing.
 *
 * Provides factory functions that create valid protocol message objects
 * with sensible defaults. All fields can be overridden via partial objects.
 */

import type {
  DeliveryRequest,
  DeliveryResponse,
  HexAddress,
  HexHash,
  HexSignature,
  OrderStatus,
  OrderStatusResponse,
  PaymentProof,
  ProviderAgent,
  QuoteDetails,
  ServiceQuote,
  StoredOrder,
} from "@ivxp/protocol";

import { TEST_ACCOUNTS } from "./wallets.js";

// ---------------------------------------------------------------------------
// Deterministic ID generation
// ---------------------------------------------------------------------------

let autoCounter = 0;

/**
 * Generate a deterministic order ID for test reproducibility.
 *
 * When called without arguments, uses an internal auto-incrementing counter
 * to produce unique but predictable IDs. Call `resetOrderCounter()` in test
 * setup for isolation.
 *
 * When called with an explicit counter value, returns a deterministic ID
 * based on that value without modifying the internal counter.
 *
 * @param counter - Optional explicit counter value for fully deterministic IDs.
 */
export const generateOrderId = (counter?: number): string => {
  const value = counter ?? (autoCounter += 1);
  const hex = value.toString(16).padStart(8, "0");
  return `ivxp-${hex}0000-0000-0000-000000000000`;
};

/**
 * Reset the internal order counter for test isolation.
 */
export const resetOrderCounter = (): void => {
  autoCounter = 0;
};

// ---------------------------------------------------------------------------
// Mock data constants
// ---------------------------------------------------------------------------

export const DEFAULT_TX_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as HexHash;

export const DEFAULT_SIGNATURE =
  "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab01" as HexSignature;

// ---------------------------------------------------------------------------
// Quote factory
// ---------------------------------------------------------------------------

/**
 * Create a mock ServiceQuote with optional field overrides.
 */
export const createMockQuote = (overrides?: Partial<ServiceQuote>): ServiceQuote => ({
  protocol: "IVXP/1.0",
  message_type: "service_quote",
  timestamp: new Date().toISOString(),
  order_id: generateOrderId(),
  provider_agent: {
    name: "TestProvider",
    wallet_address: TEST_ACCOUNTS.provider.address,
  },
  quote: {
    price_usdc: 10,
    estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
    payment_address: TEST_ACCOUNTS.provider.address,
    network: "base-sepolia",
  },
  ...overrides,
});

/**
 * Create a mock QuoteDetails with optional field overrides.
 */
export const createMockQuoteDetails = (overrides?: Partial<QuoteDetails>): QuoteDetails => ({
  price_usdc: 10,
  estimated_delivery: new Date(Date.now() + 3_600_000).toISOString(),
  payment_address: TEST_ACCOUNTS.provider.address,
  network: "base-sepolia",
  ...overrides,
});

/**
 * Create a mock ProviderAgent with optional field overrides.
 */
export const createMockProviderAgent = (overrides?: Partial<ProviderAgent>): ProviderAgent => ({
  name: "TestProvider",
  wallet_address: TEST_ACCOUNTS.provider.address,
  ...overrides,
});

// ---------------------------------------------------------------------------
// StoredOrder factory
// ---------------------------------------------------------------------------

/**
 * Create a mock StoredOrder with optional status and field overrides.
 */
export const createMockOrder = (
  status: OrderStatus = "quoted",
  overrides?: Partial<StoredOrder>,
): StoredOrder => ({
  orderId: generateOrderId(),
  status,
  clientAddress: TEST_ACCOUNTS.client.address,
  serviceType: "code_review",
  priceUsdc: "10.000000",
  paymentAddress: TEST_ACCOUNTS.provider.address,
  network: "base-sepolia",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...(status !== "quoted" && { txHash: DEFAULT_TX_HASH }),
  ...overrides,
});

// ---------------------------------------------------------------------------
// PaymentProof factory
// ---------------------------------------------------------------------------

/**
 * Create a mock PaymentProof with optional field overrides.
 */
export const createMockPaymentProof = (overrides?: Partial<PaymentProof>): PaymentProof => ({
  tx_hash: DEFAULT_TX_HASH,
  from_address: TEST_ACCOUNTS.client.address,
  network: "base-sepolia",
  to_address: TEST_ACCOUNTS.provider.address,
  amount_usdc: "10.000000",
  ...overrides,
});

// ---------------------------------------------------------------------------
// DeliveryRequest factory
// ---------------------------------------------------------------------------

/**
 * Create a mock DeliveryRequest with optional field overrides.
 */
export const createMockDeliveryRequest = (
  overrides?: Partial<DeliveryRequest>,
): DeliveryRequest => {
  const orderId = overrides?.order_id ?? generateOrderId();
  const timestamp = overrides?.timestamp ?? new Date().toISOString();
  const txHash = overrides?.payment_proof?.tx_hash ?? DEFAULT_TX_HASH;

  return {
    protocol: "IVXP/1.0",
    message_type: "delivery_request",
    timestamp,
    order_id: orderId,
    payment_proof: createMockPaymentProof(overrides?.payment_proof),
    signature: DEFAULT_SIGNATURE,
    signed_message: `Order: ${orderId} | Payment: ${txHash} | Timestamp: ${timestamp}`,
    ...overrides,
  };
};

// ---------------------------------------------------------------------------
// OrderStatusResponse factory
// ---------------------------------------------------------------------------

/**
 * Create a mock OrderStatusResponse with optional field overrides.
 */
export const createMockOrderStatusResponse = (
  status: "quoted" | "paid" | "delivered" | "delivery_failed" = "quoted",
  overrides?: Partial<OrderStatusResponse>,
): OrderStatusResponse => ({
  order_id: generateOrderId(),
  status,
  created_at: new Date().toISOString(),
  service_type: "code_review",
  price_usdc: 10,
  ...overrides,
});

// ---------------------------------------------------------------------------
// DeliveryResponse factory
// ---------------------------------------------------------------------------

/**
 * Create a mock DeliveryResponse (wire-format) with optional overrides.
 *
 * Produces a valid wire-format response matching the DeliveryResponseSchema.
 * Content defaults to a JSON object, but can be overridden for markdown,
 * code, or other formats.
 */
export const createMockDeliveryResponse = (
  overrides?: Partial<DeliveryResponse>,
): DeliveryResponse => ({
  protocol: "IVXP/1.0",
  message_type: "service_delivery",
  timestamp: new Date().toISOString(),
  order_id: generateOrderId(),
  status: "completed",
  provider_agent: {
    name: "TestProvider",
    wallet_address: TEST_ACCOUNTS.provider.address,
  },
  deliverable: {
    type: "code_review_result",
    format: "json",
    content: { issues: [], score: 9.5, summary: "Code looks great!" },
  },
  ...overrides,
});
