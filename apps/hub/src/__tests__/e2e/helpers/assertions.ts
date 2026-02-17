/**
 * Custom assertion helpers for E2E purchase flow tests.
 *
 * Provides domain-specific assertions for order state, payment steps,
 * signature steps, and protocol event sequences.
 */

import { expect } from "vitest";
import type { Order, OrderStatus } from "@/stores/order-store";
import type { PaymentStep } from "@/hooks/use-payment";
import type { SignatureStep } from "@/hooks/use-identity-signature";
import type { HashStatus } from "@/hooks/use-deliverable";

// ---------------------------------------------------------------------------
// Order assertions
// ---------------------------------------------------------------------------

export function assertOrderInStatus(order: Order | null, status: OrderStatus): void {
  expect(order).not.toBeNull();
  expect(order!.status).toBe(status);
}

export function assertOrderHasTxHash(order: Order | null): void {
  expect(order).not.toBeNull();
  expect(order!.txHash).toBeDefined();
  expect(order!.txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
}

export function assertOrderHasBlockNumber(order: Order | null): void {
  expect(order).not.toBeNull();
  expect(order!.blockNumber).toBeDefined();
  expect(typeof order!.blockNumber).toBe("bigint");
}

// ---------------------------------------------------------------------------
// Payment step assertions
// ---------------------------------------------------------------------------

export function assertPaymentCompleted(step: PaymentStep, txHash: `0x${string}` | null): void {
  expect(step).toBe("confirmed");
  expect(txHash).not.toBeNull();
  expect(txHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
}

export function assertPaymentError(
  step: PaymentStep,
  error: { message: string; code: string; recoverable: boolean } | null,
  expectedCode: string,
): void {
  expect(step).toBe("error");
  expect(error).not.toBeNull();
  expect(error!.code).toBe(expectedCode);
}

export function assertPartialSuccess(
  step: PaymentStep,
  txHash: `0x${string}` | null,
  error: { message: string; code: string; recoverable: boolean } | null,
): void {
  expect(step).toBe("partial-success");
  expect(txHash).not.toBeNull();
  expect(error).not.toBeNull();
  expect(error!.code).toBe("PARTIAL_SUCCESS");
  expect(error!.recoverable).toBe(true);
}

// ---------------------------------------------------------------------------
// Signature step assertions
// ---------------------------------------------------------------------------

export function assertSignatureCompleted(
  step: SignatureStep,
  signature: `0x${string}` | null,
): void {
  expect(step).toBe("submitted");
  expect(signature).not.toBeNull();
}

export function assertSignatureError(
  step: SignatureStep,
  errorCode: string | null,
  expectedCode: string,
): void {
  expect(step).toBe("error");
  expect(errorCode).toBe(expectedCode);
}

// ---------------------------------------------------------------------------
// Event sequence assertions
// ---------------------------------------------------------------------------

export function assertEventOrder(
  events: readonly { readonly type: string }[],
  expectedOrder: readonly string[],
): void {
  const eventTypes = events.map((e) => e.type);
  let lastIndex = -1;

  for (const expected of expectedOrder) {
    const index = eventTypes.indexOf(expected, lastIndex + 1);
    expect(
      index,
      `Expected event "${expected}" after index ${lastIndex} in [${eventTypes.join(", ")}]`,
    ).toBeGreaterThan(lastIndex);
    lastIndex = index;
  }

  // Verify no unexpected duplicates: each matched event should be unique
  const matchedIndices = new Set<number>();
  let searchFrom = 0;
  for (const expected of expectedOrder) {
    const index = eventTypes.indexOf(expected, searchFrom);
    expect(
      matchedIndices.has(index),
      `Duplicate event match at index ${index} for "${expected}"`,
    ).toBe(false);
    matchedIndices.add(index);
    searchFrom = index + 1;
  }
}

export function assertContainsEvents(
  events: readonly { readonly type: string }[],
  expectedTypes: readonly string[],
): void {
  const eventTypes = events.map((e) => e.type);
  for (const expected of expectedTypes) {
    expect(eventTypes).toContain(expected);
  }
}

// ---------------------------------------------------------------------------
// Download / deliverable assertions
// ---------------------------------------------------------------------------

export function assertDownloadSuccess(
  hashStatus: HashStatus,
  content: ArrayBuffer | null,
  error: string | null,
): void {
  expect(hashStatus).toBe("verified");
  expect(content).not.toBeNull();
  expect(error).toBeNull();
}

export function assertDownloadHashMismatch(
  hashStatus: HashStatus,
  content: ArrayBuffer | null,
  error: string | null,
): void {
  expect(hashStatus).toBe("failed");
  expect(content).toBeNull();
  expect(error).toBe("Content hash verification failed");
}

export function assertDownloadError(error: string | null, expectedMessage: string): void {
  expect(error).not.toBeNull();
  expect(error).toContain(expectedMessage);
}
