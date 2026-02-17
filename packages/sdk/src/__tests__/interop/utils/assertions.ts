/**
 * Assertion helpers for IVXP interop tests.
 *
 * Provides protocol-specific validation functions for verifying
 * wire-format compliance, field naming, and message structure.
 */

import { expect } from "vitest";

// ---------------------------------------------------------------------------
// Snake case validation
// ---------------------------------------------------------------------------

/**
 * Check if all top-level keys of an object are snake_case.
 *
 * Accepts lowercase letters, digits, and underscores.
 * Ignores non-object values and null.
 */
export function hasSnakeCaseFields(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return true;
  if (Array.isArray(obj)) return obj.every(hasSnakeCaseFields);

  return Object.keys(obj).every((key) => /^[a-z][a-z0-9_]*$/.test(key));
}

/**
 * Recursively check that all keys in a nested object are snake_case.
 */
export function hasDeepSnakeCaseFields(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return true;
  if (Array.isArray(obj)) return obj.every(hasDeepSnakeCaseFields);

  return Object.entries(obj as Record<string, unknown>).every(
    ([key, value]) =>
      /^[a-z][a-z0-9_]*$/.test(key) && hasDeepSnakeCaseFields(value),
  );
}

// ---------------------------------------------------------------------------
// Protocol message assertions
// ---------------------------------------------------------------------------

/**
 * Assert that a response object has valid IVXP/1.0 protocol fields.
 */
export function assertValidProtocolMessage(
  response: Record<string, unknown>,
  expectedMessageType: string,
): void {
  expect(response.protocol).toBe("IVXP/1.0");
  expect(response.message_type).toBe(expectedMessageType);
  expect(typeof response.timestamp).toBe("string");
  expect(hasSnakeCaseFields(response)).toBe(true);
}

/**
 * Assert that a catalog response is well-formed.
 */
export function assertValidCatalog(
  catalog: Record<string, unknown>,
): void {
  assertValidProtocolMessage(catalog, "service_catalog");
  expect(typeof catalog.provider).toBe("string");
  expect(typeof catalog.wallet_address).toBe("string");
  expect((catalog.wallet_address as string).startsWith("0x")).toBe(true);
  expect(Array.isArray(catalog.services)).toBe(true);

  const services = catalog.services as Record<string, unknown>[];
  for (const svc of services) {
    expect(typeof svc.type).toBe("string");
    expect(typeof svc.base_price_usdc).toBe("number");
    expect(typeof svc.estimated_delivery_hours).toBe("number");
    expect(hasSnakeCaseFields(svc)).toBe(true);
  }
}

/**
 * Assert that a quote response is well-formed.
 */
export function assertValidQuote(
  quote: Record<string, unknown>,
): void {
  assertValidProtocolMessage(quote, "service_quote");
  expect(typeof quote.order_id).toBe("string");
  expect((quote.order_id as string).startsWith("ivxp-")).toBe(true);

  const providerAgent = quote.provider_agent as Record<string, unknown>;
  expect(typeof providerAgent.name).toBe("string");
  expect(typeof providerAgent.wallet_address).toBe("string");

  const quoteDetails = quote.quote as Record<string, unknown>;
  expect(typeof quoteDetails.price_usdc).toBe("number");
  expect(typeof quoteDetails.payment_address).toBe("string");
  expect(typeof quoteDetails.network).toBe("string");
  expect(hasSnakeCaseFields(quoteDetails)).toBe(true);
}

/**
 * Assert that a delivery accepted response is well-formed.
 */
export function assertValidDeliveryAccepted(
  response: Record<string, unknown>,
): void {
  expect(response.status).toBe("accepted");
  expect(typeof response.order_id).toBe("string");
  expect(typeof response.message).toBe("string");
}

/**
 * Assert that a status response is well-formed.
 */
export function assertValidStatusResponse(
  response: Record<string, unknown>,
  expectedOrderId: string,
): void {
  expect(response.order_id).toBe(expectedOrderId);
  expect(typeof response.status).toBe("string");
  expect(typeof response.service).toBe("string");
  expect(typeof response.created_at).toBe("string");
  expect(hasSnakeCaseFields(response)).toBe(true);
}

/**
 * Assert that a download response is well-formed.
 */
export function assertValidDownloadResponse(
  response: Record<string, unknown>,
  expectedOrderId: string,
): void {
  expect(response.order_id).toBe(expectedOrderId);
  expect(typeof response.content).toBe("string");
  expect(typeof response.content_type).toBe("string");
  expect(typeof response.content_hash).toBe("string");
  expect(hasSnakeCaseFields(response)).toBe(true);
}

/**
 * Assert that a hex string is a valid EIP-191 signature format.
 * (0x-prefixed, 130 hex chars = 65 bytes)
 */
export function assertValidSignature(sig: string): void {
  expect(sig).toMatch(/^0x[0-9a-fA-F]{130}$/);
}

/**
 * Assert that a hex string is a valid content hash (SHA-256).
 * (64 hex chars = 32 bytes, no 0x prefix)
 */
export function assertValidContentHash(hash: string): void {
  expect(hash).toMatch(/^[0-9a-fA-F]{64}$/);
}
