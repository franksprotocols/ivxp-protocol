/**
 * Common Zod schemas shared across all IVXP/1.0 protocol messages.
 *
 * These schemas validate wire-format fields (snake_case) and can be
 * composed into larger message schemas.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Protocol Version
// ---------------------------------------------------------------------------

/**
 * Schema for the IVXP protocol version identifier.
 * Must be exactly "IVXP/1.0".
 */
export const ProtocolVersionSchema = z.literal("IVXP/1.0");

// ---------------------------------------------------------------------------
// Ethereum Address
// ---------------------------------------------------------------------------

/**
 * Schema for an Ethereum hex address (42 chars: 0x + 40 hex).
 *
 * Validates the address format and normalizes to lowercase.
 */
export const HexAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, { error: "Invalid Ethereum address" })
  .transform((addr) => addr.toLowerCase() as `0x${string}`);

/**
 * Lenient address schema that only checks the 0x prefix.
 * Useful for optional/extension fields where addresses may not be full 40-char.
 */
export const HexAddressLenientSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, { error: "Invalid hex address format" })
  .transform((addr) => addr.toLowerCase() as `0x${string}`);

// ---------------------------------------------------------------------------
// Hex Signature
// ---------------------------------------------------------------------------

/**
 * Schema for an EIP-191 hex-encoded signature.
 * Must be exactly 132 chars: 0x prefix + 130 hex chars (65 bytes).
 */
export const HexSignatureSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{130}$/, {
    error: "Invalid EIP-191 signature (expected 0x + 130 hex chars)",
  })
  .transform((sig) => sig as `0x${string}`);

// ---------------------------------------------------------------------------
// Hex Hash (Transaction Hash)
// ---------------------------------------------------------------------------

/**
 * Schema for a hex-encoded transaction hash.
 * Must be exactly 66 chars: 0x prefix + 64 hex chars (32 bytes).
 */
export const HexHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, { error: "Invalid transaction hash (expected 0x + 64 hex chars)" })
  .transform((hash) => hash as `0x${string}`);

// ---------------------------------------------------------------------------
// Network ID
// ---------------------------------------------------------------------------

/**
 * Schema for supported blockchain networks.
 */
export const NetworkIdSchema = z.enum(["base-mainnet", "base-sepolia"]);

// ---------------------------------------------------------------------------
// Delivery Format
// ---------------------------------------------------------------------------

/**
 * Schema for supported delivery content formats.
 */
export const DeliveryFormatSchema = z.enum(["markdown", "json", "code"]);

// ---------------------------------------------------------------------------
// ISO Timestamp
// ---------------------------------------------------------------------------

/**
 * Schema for ISO 8601 timestamp strings.
 *
 * Validates the string matches an ISO 8601 format and can be parsed as a Date.
 */
export const ISOTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/, {
    error: "Invalid ISO 8601 timestamp",
  })
  .refine((str) => !isNaN(Date.parse(str)), { message: "Invalid date value" });

// ---------------------------------------------------------------------------
// Message Type Discriminators
// ---------------------------------------------------------------------------

/**
 * Schema for all valid IVXP/1.0 message type discriminators.
 */
export const IVXPMessageTypeSchema = z.enum([
  "service_catalog",
  "service_request",
  "service_quote",
  "delivery_request",
  "service_delivery",
  "delivery_confirmation",
]);

// ---------------------------------------------------------------------------
// Order Status
// ---------------------------------------------------------------------------

/**
 * Schema for order lifecycle status values.
 */
export const OrderStatusSchema = z.enum([
  "quoted",
  "paid",
  "processing",
  "delivered",
  "delivery_failed",
  "confirmed",
]);
