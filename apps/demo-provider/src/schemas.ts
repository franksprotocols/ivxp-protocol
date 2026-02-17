/**
 * Zod validation schemas for IVXP protocol request bodies.
 *
 * These schemas validate the wire-format (snake_case) structure
 * WITHOUT transforming to camelCase, since the SDK's IVXPProvider
 * expects wire-format input directly.
 *
 * Reuses common validators (HexAddress, HexHash, etc.) from
 * @ivxp/protocol where possible.
 */

import { z } from "zod";

/** 0x-prefixed 40-hex-char Ethereum address. */
const hexAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

/** 0x-prefixed 64-hex-char transaction hash. */
const hexHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format");

/** 0x-prefixed 130-hex-char EIP-191 signature. */
const hexSignature = z
  .string()
  .regex(/^0x[a-fA-F0-9]{130}$/, "Invalid EIP-191 signature format");

/** Supported blockchain networks. */
const networkId = z.enum(["base-mainnet", "base-sepolia"]);

// ---------------------------------------------------------------------------
// POST /ivxp/request -- ServiceRequest wire-format validation
// ---------------------------------------------------------------------------

export const ServiceRequestBodySchema = z.object({
  protocol: z.string().min(1),
  message_type: z.literal("service_request"),
  timestamp: z.string().min(1),
  client_agent: z.object({
    name: z.string().min(1),
    wallet_address: hexAddress,
    contact_endpoint: z.string().url().optional(),
  }),
  service_request: z.object({
    type: z.string().min(1),
    description: z.string().min(1),
    budget_usdc: z.number().positive(),
    delivery_format: z.string().optional(),
    deadline: z.string().optional(),
  }),
});

export type ValidatedServiceRequest = z.infer<typeof ServiceRequestBodySchema>;

// ---------------------------------------------------------------------------
// POST /ivxp/deliver -- DeliveryRequest wire-format validation
// ---------------------------------------------------------------------------

export const DeliveryRequestBodySchema = z.object({
  protocol: z.string().min(1),
  message_type: z.literal("delivery_request"),
  timestamp: z.string().min(1),
  order_id: z.string().min(1),
  payment_proof: z.object({
    tx_hash: hexHash,
    from_address: hexAddress,
    network: networkId,
    to_address: hexAddress.optional(),
    amount_usdc: z.string().optional(),
    block_number: z.number().int().nonnegative().optional(),
  }),
  delivery_endpoint: z.string().url().optional(),
  signature: hexSignature,
  signed_message: z.string().min(1),
});

export type ValidatedDeliveryRequest = z.infer<typeof DeliveryRequestBodySchema>;
