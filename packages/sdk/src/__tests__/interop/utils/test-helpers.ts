/**
 * Test helper utilities for interop tests.
 *
 * Provides HTTP helpers, polling utilities, and request body builders
 * for direct HTTP interaction with the provider.
 */

import { TEST_ACCOUNTS, DEFAULT_SIGNATURE } from "@ivxp/test-utils";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

/**
 * GET JSON from a URL, returning parsed body and status.
 */
export async function httpGet<T = unknown>(url: string): Promise<{ status: number; body: T }> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => null)) as T;
  return { status: response.status, body };
}

/**
 * POST JSON to a URL, returning parsed body and status.
 */
export async function httpPost<T = unknown>(
  url: string,
  payload: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as T;
  return { status: response.status, body };
}

// ---------------------------------------------------------------------------
// Request body builders
// ---------------------------------------------------------------------------

/**
 * Build a valid IVXP/1.0 service request body.
 */
export function buildServiceRequestBody(
  serviceType: string,
  description = "Interop test request",
  budgetUsdc = 100,
) {
  return {
    protocol: "IVXP/1.0",
    message_type: "service_request",
    timestamp: new Date().toISOString(),
    client_agent: {
      name: "InteropTestClient",
      wallet_address: TEST_ACCOUNTS.client.address,
    },
    service_request: {
      type: serviceType,
      description,
      budget_usdc: budgetUsdc,
    },
  };
}

/**
 * Generate a unique 0x-prefixed 64-char hex tx hash for testing.
 *
 * Uses crypto.randomUUID() to produce unique hashes, avoiding replay
 * protection rejections when multiple orders are delivered concurrently.
 */
function generateUniqueTxHash(): `0x${string}` {
  const uuid = globalThis.crypto.randomUUID().replace(/-/g, "");
  // Pad to 64 hex chars (32 bytes)
  return `0x${uuid.padEnd(64, "0")}` as `0x${string}`;
}

/**
 * Build a valid IVXP/1.0 delivery request body.
 *
 * Each call generates a unique tx_hash by default to avoid replay
 * protection rejections. Pass `options.txHash` to override.
 */
export function buildDeliveryRequestBody(
  orderId: string,
  options?: { deliveryEndpoint?: string; network?: string; txHash?: `0x${string}` },
) {
  const timestamp = new Date().toISOString();
  const txHash = options?.txHash ?? generateUniqueTxHash();
  return {
    protocol: "IVXP/1.0",
    message_type: "delivery_request",
    timestamp,
    order_id: orderId,
    payment_proof: {
      tx_hash: txHash,
      from_address: TEST_ACCOUNTS.client.address,
      network: options?.network ?? "base-sepolia",
    },
    signature: DEFAULT_SIGNATURE,
    signed_message: `Order: ${orderId} | Payment: ${txHash} | Timestamp: ${timestamp}`,
    ...(options?.deliveryEndpoint ? { delivery_endpoint: options.deliveryEndpoint } : {}),
  };
}

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

/** Default poll options for fast test execution. */
export const FAST_POLL = {
  timeout: 10_000,
  interval: 50,
} as const;

/**
 * Wait for a condition to become true, polling at a fixed interval.
 */
export async function waitForCondition(
  predicate: () => Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {},
): Promise<void> {
  const { timeout = FAST_POLL.timeout, interval = FAST_POLL.interval, message } = options;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(message ?? `Condition not met within ${timeout}ms`);
}
