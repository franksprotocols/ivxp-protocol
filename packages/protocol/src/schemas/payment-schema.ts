/**
 * IVXP/1.0 Payment Zod Schemas
 *
 * Validates PaymentInfo, TransactionRef, and PaymentVerificationResult.
 * Wire format uses snake_case; transforms produce camelCase output.
 */

import { z } from "zod";

import { HexAddressSchema, HexHashSchema, ISOTimestampSchema, NetworkIdSchema } from "./common.js";

// ---------------------------------------------------------------------------
// PaymentInfo
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for payment information.
 */
const PaymentInfoWireSchema = z.object({
  payment_address: HexAddressSchema,
  amount_usdc: z.number().positive(),
  network: NetworkIdSchema,
  token_contract: HexAddressSchema.optional(),
});

/**
 * Schema for PaymentInfo with snake_case -> camelCase transform.
 */
export const PaymentInfoSchema = PaymentInfoWireSchema.transform((data) => ({
  paymentAddress: data.payment_address,
  amountUsdc: data.amount_usdc,
  network: data.network,
  tokenContract: data.token_contract,
}));

// ---------------------------------------------------------------------------
// TransactionRef
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for a completed transaction reference.
 */
const TransactionRefWireSchema = z.object({
  tx_hash: HexHashSchema,
  from_address: HexAddressSchema,
  to_address: HexAddressSchema,
  amount_usdc: z.number().nonnegative(),
  network: NetworkIdSchema,
  block_number: z.number().int().nonnegative().optional(),
  block_timestamp: ISOTimestampSchema.optional(),
});

/**
 * Schema for TransactionRef with snake_case -> camelCase transform.
 */
export const TransactionRefSchema = TransactionRefWireSchema.transform((data) => ({
  txHash: data.tx_hash,
  fromAddress: data.from_address,
  toAddress: data.to_address,
  amountUsdc: data.amount_usdc,
  network: data.network,
  blockNumber: data.block_number,
  blockTimestamp: data.block_timestamp,
}));

// ---------------------------------------------------------------------------
// PaymentVerificationResult
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for payment verification results.
 */
const PaymentVerificationResultWireSchema = z.object({
  verified: z.boolean(),
  tx_hash: HexHashSchema,
  actual_amount_usdc: z.number().nonnegative().optional(),
  expected_amount_usdc: z.number().nonnegative().optional(),
  failure_reason: z.string().optional(),
});

/**
 * Schema for PaymentVerificationResult with snake_case -> camelCase transform.
 */
export const PaymentVerificationResultSchema = PaymentVerificationResultWireSchema.transform(
  (data) => ({
    verified: data.verified,
    txHash: data.tx_hash,
    actualAmountUsdc: data.actual_amount_usdc,
    expectedAmountUsdc: data.expected_amount_usdc,
    failureReason: data.failure_reason,
  }),
);

// ---------------------------------------------------------------------------
// IVXPErrorResponse
// ---------------------------------------------------------------------------

/**
 * Schema for IVXP protocol error responses.
 * Error codes are SCREAMING_SNAKE_CASE strings.
 */
export const IVXPErrorResponseSchema = z.object({
  error: z.string().regex(/^[A-Z][A-Z0-9_]*$/, {
    error: "Error code must be SCREAMING_SNAKE_CASE",
  }),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Inferred type from PaymentInfoSchema output. */
export type PaymentInfoOutput = z.infer<typeof PaymentInfoSchema>;

/** Inferred type from TransactionRefSchema output. */
export type TransactionRefOutput = z.infer<typeof TransactionRefSchema>;

/** Inferred type from PaymentVerificationResultSchema output. */
export type PaymentVerificationResultOutput = z.infer<typeof PaymentVerificationResultSchema>;
