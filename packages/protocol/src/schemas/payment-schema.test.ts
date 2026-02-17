/**
 * Unit tests for payment Zod schemas.
 */

import { describe, expect, it } from "vitest";

import {
  IVXPErrorResponseSchema,
  PaymentInfoSchema,
  PaymentVerificationResultSchema,
  TransactionRefSchema,
} from "./payment-schema.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const VALID_ADDRESS_2 = "0xabcdef1234567890abcdef1234567890abcdef12";
const VALID_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const VALID_TIMESTAMP = "2026-02-05T12:00:00Z";

// ============================================================================
// PaymentInfoSchema
// ============================================================================

describe("PaymentInfoSchema", () => {
  it("should parse valid payment info with camelCase transform", () => {
    const result = PaymentInfoSchema.parse({
      payment_address: VALID_ADDRESS,
      amount_usdc: 30,
      network: "base-sepolia",
    });

    expect(result.paymentAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.amountUsdc).toBe(30);
    expect(result.network).toBe("base-sepolia");
    expect(result.tokenContract).toBeUndefined();
  });

  it("should include optional token_contract", () => {
    const result = PaymentInfoSchema.parse({
      payment_address: VALID_ADDRESS,
      amount_usdc: 50,
      network: "base-mainnet",
      token_contract: VALID_ADDRESS_2,
    });

    expect(result.tokenContract).toBe(VALID_ADDRESS_2);
  });

  it("should reject non-positive amount", () => {
    expect(() =>
      PaymentInfoSchema.parse({
        payment_address: VALID_ADDRESS,
        amount_usdc: 0,
        network: "base-sepolia",
      }),
    ).toThrow();
  });

  it("should reject negative amount", () => {
    expect(() =>
      PaymentInfoSchema.parse({
        payment_address: VALID_ADDRESS,
        amount_usdc: -10,
        network: "base-sepolia",
      }),
    ).toThrow();
  });

  it("should reject invalid network", () => {
    expect(() =>
      PaymentInfoSchema.parse({
        payment_address: VALID_ADDRESS,
        amount_usdc: 30,
        network: "ethereum",
      }),
    ).toThrow();
  });

  it("should reject invalid payment_address", () => {
    expect(() =>
      PaymentInfoSchema.parse({
        payment_address: "invalid",
        amount_usdc: 30,
        network: "base-sepolia",
      }),
    ).toThrow();
  });

  it("should reject missing fields", () => {
    expect(() => PaymentInfoSchema.parse({})).toThrow();
  });
});

// ============================================================================
// TransactionRefSchema
// ============================================================================

describe("TransactionRefSchema", () => {
  const validTxRef = {
    tx_hash: VALID_TX_HASH,
    from_address: VALID_ADDRESS,
    to_address: VALID_ADDRESS_2,
    amount_usdc: 50,
    network: "base-mainnet",
  };

  it("should parse valid transaction ref with camelCase transform", () => {
    const result = TransactionRefSchema.parse(validTxRef);

    expect(result.txHash).toBe(VALID_TX_HASH);
    expect(result.fromAddress).toBe(VALID_ADDRESS.toLowerCase());
    expect(result.toAddress).toBe(VALID_ADDRESS_2);
    expect(result.amountUsdc).toBe(50);
    expect(result.network).toBe("base-mainnet");
    expect(result.blockNumber).toBeUndefined();
    expect(result.blockTimestamp).toBeUndefined();
  });

  it("should include optional fields", () => {
    const result = TransactionRefSchema.parse({
      ...validTxRef,
      block_number: 1000000,
      block_timestamp: VALID_TIMESTAMP,
    });

    expect(result.blockNumber).toBe(1000000);
    expect(result.blockTimestamp).toBe(VALID_TIMESTAMP);
  });

  it("should reject missing tx_hash", () => {
    const { tx_hash: _, ...withoutHash } = validTxRef;
    expect(() => TransactionRefSchema.parse(withoutHash)).toThrow();
  });

  it("should reject missing from_address", () => {
    const { from_address: _, ...withoutFrom } = validTxRef;
    expect(() => TransactionRefSchema.parse(withoutFrom)).toThrow();
  });

  it("should reject missing to_address", () => {
    const { to_address: _, ...withoutTo } = validTxRef;
    expect(() => TransactionRefSchema.parse(withoutTo)).toThrow();
  });

  it("should reject negative amount", () => {
    expect(() => TransactionRefSchema.parse({ ...validTxRef, amount_usdc: -1 })).toThrow();
  });

  it("should accept zero amount", () => {
    const result = TransactionRefSchema.parse({
      ...validTxRef,
      amount_usdc: 0,
    });
    expect(result.amountUsdc).toBe(0);
  });
});

// ============================================================================
// PaymentVerificationResultSchema
// ============================================================================

describe("PaymentVerificationResultSchema", () => {
  it("should parse successful verification with camelCase transform", () => {
    const result = PaymentVerificationResultSchema.parse({
      verified: true,
      tx_hash: VALID_TX_HASH,
      actual_amount_usdc: 30,
      expected_amount_usdc: 30,
    });

    expect(result.verified).toBe(true);
    expect(result.txHash).toBe(VALID_TX_HASH);
    expect(result.actualAmountUsdc).toBe(30);
    expect(result.expectedAmountUsdc).toBe(30);
    expect(result.failureReason).toBeUndefined();
  });

  it("should parse failed verification with failure_reason", () => {
    const result = PaymentVerificationResultSchema.parse({
      verified: false,
      tx_hash: VALID_TX_HASH,
      actual_amount_usdc: 20,
      expected_amount_usdc: 30,
      failure_reason: "Amount mismatch",
    });

    expect(result.verified).toBe(false);
    expect(result.actualAmountUsdc).toBe(20);
    expect(result.expectedAmountUsdc).toBe(30);
    expect(result.failureReason).toBe("Amount mismatch");
  });

  it("should accept minimal fields", () => {
    const result = PaymentVerificationResultSchema.parse({
      verified: true,
      tx_hash: VALID_TX_HASH,
    });

    expect(result.verified).toBe(true);
    expect(result.actualAmountUsdc).toBeUndefined();
  });

  it("should reject missing verified", () => {
    expect(() => PaymentVerificationResultSchema.parse({ tx_hash: VALID_TX_HASH })).toThrow();
  });

  it("should reject missing tx_hash", () => {
    expect(() => PaymentVerificationResultSchema.parse({ verified: true })).toThrow();
  });

  it("should reject non-boolean verified", () => {
    expect(() =>
      PaymentVerificationResultSchema.parse({
        verified: "yes",
        tx_hash: VALID_TX_HASH,
      }),
    ).toThrow();
  });
});

// ============================================================================
// IVXPErrorResponseSchema
// ============================================================================

describe("IVXPErrorResponseSchema", () => {
  it("should parse valid error response", () => {
    const result = IVXPErrorResponseSchema.parse({
      error: "PAYMENT_NOT_VERIFIED",
      message: "Transaction not found on chain",
    });

    expect(result.error).toBe("PAYMENT_NOT_VERIFIED");
    expect(result.message).toBe("Transaction not found on chain");
    expect(result.details).toBeUndefined();
  });

  it("should include optional details", () => {
    const result = IVXPErrorResponseSchema.parse({
      error: "ORDER_NOT_FOUND",
      message: "Order does not exist",
      details: {
        order_id: "ivxp-missing",
        searched_at: "2026-02-05T12:00:00Z",
      },
    });

    expect(result.details).toEqual({
      order_id: "ivxp-missing",
      searched_at: "2026-02-05T12:00:00Z",
    });
  });

  it("should reject lowercase error codes", () => {
    expect(() =>
      IVXPErrorResponseSchema.parse({
        error: "payment_not_verified",
        message: "test",
      }),
    ).toThrow();
  });

  it("should reject camelCase error codes", () => {
    expect(() =>
      IVXPErrorResponseSchema.parse({
        error: "PaymentNotVerified",
        message: "test",
      }),
    ).toThrow();
  });

  it("should accept all defined error codes", () => {
    const errorCodes = [
      "PAYMENT_NOT_VERIFIED",
      "SIGNATURE_INVALID",
      "ORDER_NOT_FOUND",
      "SERVICE_UNAVAILABLE",
      "INSUFFICIENT_BALANCE",
      "SERVICE_TYPE_NOT_SUPPORTED",
      "BUDGET_TOO_LOW",
      "PAYMENT_TIMEOUT",
      "ORDER_EXPIRED",
      "PROTOCOL_VERSION_UNSUPPORTED",
      "INTERNAL_ERROR",
    ];

    for (const code of errorCodes) {
      const result = IVXPErrorResponseSchema.parse({
        error: code,
        message: `Error: ${code}`,
      });
      expect(result.error).toBe(code);
    }
  });

  it("should reject empty message", () => {
    expect(() =>
      IVXPErrorResponseSchema.parse({
        error: "INTERNAL_ERROR",
        message: "",
      }),
    ).toThrow();
  });

  it("should reject missing error field", () => {
    expect(() => IVXPErrorResponseSchema.parse({ message: "test" })).toThrow();
  });
});
