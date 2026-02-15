/**
 * Custom assertion helpers for IVXP tests.
 *
 * Provides domain-specific assertion utilities that complement
 * Vitest's built-in expect() assertions.
 */

import type { HexAddress, OrderStatus, StoredOrder } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Hex address assertions
// ---------------------------------------------------------------------------

/**
 * Assert that a string is a valid hex address (0x-prefixed, 42 chars).
 *
 * @param value - The value to check.
 * @param label - Optional label for error messages.
 * @throws If the value is not a valid hex address.
 */
export const assertHexAddress = (value: unknown, label = "value"): asserts value is HexAddress => {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string, got ${typeof value}`);
  }
  if (!value.startsWith("0x")) {
    throw new Error(`Expected ${label} to start with "0x", got "${value}"`);
  }
  if (value.length !== 42) {
    throw new Error(`Expected ${label} to be 42 characters (0x + 40 hex), got ${value.length}`);
  }
};

// ---------------------------------------------------------------------------
// Hex hash assertions
// ---------------------------------------------------------------------------

/**
 * Assert that a string is a valid hex hash (0x-prefixed, 66 chars).
 *
 * @param value - The value to check.
 * @param label - Optional label for error messages.
 * @throws If the value is not a valid hex hash.
 */
export const assertHexHash = (value: unknown, label = "value"): asserts value is `0x${string}` => {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string, got ${typeof value}`);
  }
  if (!value.startsWith("0x")) {
    throw new Error(`Expected ${label} to start with "0x", got "${value}"`);
  }
  if (value.length !== 66) {
    throw new Error(`Expected ${label} to be 66 characters (0x + 64 hex), got ${value.length}`);
  }
};

// ---------------------------------------------------------------------------
// Order assertions
// ---------------------------------------------------------------------------

/**
 * Assert that a StoredOrder has the expected status.
 *
 * @param order - The order to check.
 * @param expectedStatus - The expected order status.
 * @throws If the order status does not match.
 */
export const assertOrderStatus = (order: StoredOrder, expectedStatus: OrderStatus): void => {
  if (order.status !== expectedStatus) {
    throw new Error(
      `Expected order ${order.orderId} to have status "${expectedStatus}", ` +
        `got "${order.status}"`,
    );
  }
};

/**
 * Assert that a StoredOrder has all required fields populated.
 *
 * Checks that required fields are not undefined, null, or empty strings.
 *
 * @param order - The order to validate.
 * @throws If any required field is missing or empty.
 */
export const assertValidOrder = (order: StoredOrder): void => {
  const requiredFields: readonly (keyof StoredOrder)[] = [
    "orderId",
    "status",
    "clientAddress",
    "serviceType",
    "priceUsdc",
    "paymentAddress",
    "network",
    "createdAt",
    "updatedAt",
  ];

  for (const field of requiredFields) {
    const value = order[field];
    if (value === undefined || value === null) {
      throw new Error(`Expected order ${order.orderId} to have field "${field}" defined`);
    }
    if (typeof value === "string" && value.length === 0) {
      throw new Error(`Expected order ${order.orderId} to have field "${field}" non-empty`);
    }
  }
};

// ---------------------------------------------------------------------------
// IVXP Order ID format assertion
// ---------------------------------------------------------------------------

/**
 * Assert that a string matches the IVXP order ID format: ivxp-{uuid-v4}.
 *
 * @param value - The value to check.
 * @param label - Optional label for error messages.
 * @throws If the value does not match the expected format.
 */
export const assertOrderIdFormat = (value: unknown, label = "orderId"): void => {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string, got ${typeof value}`);
  }
  if (!value.startsWith("ivxp-")) {
    throw new Error(`Expected ${label} to start with "ivxp-", got "${value}"`);
  }
};

// ---------------------------------------------------------------------------
// Protocol version assertion
// ---------------------------------------------------------------------------

/**
 * Assert that a protocol version string is "IVXP/1.0".
 *
 * @param value - The value to check.
 * @throws If the value is not "IVXP/1.0".
 */
export const assertProtocolVersion = (value: unknown): void => {
  if (value !== "IVXP/1.0") {
    throw new Error(`Expected protocol version "IVXP/1.0", got "${String(value)}"`);
  }
};
