/**
 * IVXP/1.0 Delivery Zod Schemas
 *
 * Validates DeliveryAccepted, Deliverable, DeliveryResponse,
 * and DeliveryConfirmation messages.
 * Wire format uses snake_case; transforms produce camelCase output.
 */

import { z } from "zod";

import {
  HexAddressSchema,
  HexSignatureSchema,
  ISOTimestampSchema,
  ProtocolVersionSchema,
} from "./common.js";

// ---------------------------------------------------------------------------
// DeliveryAccepted - Response from POST /ivxp/deliver
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for delivery acceptance responses.
 */
const DeliveryAcceptedWireSchema = z.object({
  status: z.literal("accepted"),
  order_id: z.string().min(1),
  message: z.string().min(1),
});

/**
 * Schema for DeliveryAccepted with snake_case -> camelCase transform.
 */
export const DeliveryAcceptedSchema = DeliveryAcceptedWireSchema.transform((data) => ({
  status: data.status,
  orderId: data.order_id,
  message: data.message,
}));

// ---------------------------------------------------------------------------
// Deliverable
// ---------------------------------------------------------------------------

/**
 * Schema for a deliverable payload.
 *
 * The `content` field intentionally uses `z.unknown()` because deliverable
 * content varies by service type -- it may be a string, object, array, or null.
 * Content validation is the responsibility of service-specific schemas or
 * application-level logic, not the wire protocol schema. Size limits are a
 * transport concern and are enforced at the HTTP layer, not here.
 */
export const DeliverableSchema = z
  .object({
    type: z.string().min(1),
    format: z.string().optional(),
    content: z.unknown(),
  })
  .transform((data) => ({
    type: data.type,
    format: data.format,
    content: data.content,
  }));

// ---------------------------------------------------------------------------
// DeliveryProviderAgent (nested within DeliveryResponse)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for provider agent info in delivery responses.
 */
const DeliveryProviderAgentWireSchema = z.object({
  name: z.string().min(1),
  wallet_address: HexAddressSchema,
});

/**
 * Schema for delivery provider agent with snake_case -> camelCase transform.
 */
export const DeliveryProviderAgentSchema = DeliveryProviderAgentWireSchema.transform((data) => ({
  name: data.name,
  walletAddress: data.wallet_address,
}));

// ---------------------------------------------------------------------------
// DeliveryResponse - GET /ivxp/download/{order_id} response
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for DeliveryResponse messages.
 */
const DeliveryResponseWireSchema = z.object({
  protocol: ProtocolVersionSchema,
  message_type: z.literal("service_delivery"),
  timestamp: ISOTimestampSchema,
  order_id: z.string().min(1),
  status: z.literal("completed"),
  provider_agent: DeliveryProviderAgentWireSchema,
  deliverable: z.object({
    type: z.string().min(1),
    format: z.string().optional(),
    content: z.unknown(),
  }),
  content_hash: z.string().optional(),
  delivered_at: ISOTimestampSchema.optional(),
  signature: HexSignatureSchema.optional(),
  signed_message: z.string().optional(),
});

/**
 * Schema for DeliveryResponse with snake_case -> camelCase transform.
 *
 * Input: Wire-format JSON with snake_case fields.
 * Output: camelCase TypeScript object.
 */
export const DeliveryResponseSchema = DeliveryResponseWireSchema.transform((data) => ({
  protocol: data.protocol,
  messageType: data.message_type,
  timestamp: data.timestamp,
  orderId: data.order_id,
  status: data.status,
  providerAgent: {
    name: data.provider_agent.name,
    walletAddress: data.provider_agent.wallet_address,
  },
  deliverable: {
    type: data.deliverable.type,
    format: data.deliverable.format,
    content: data.deliverable.content,
  },
  contentHash: data.content_hash,
  deliveredAt: data.delivered_at,
  signature: data.signature,
  signedMessage: data.signed_message,
}));

// ---------------------------------------------------------------------------
// ConfirmationClientAgent (nested within DeliveryConfirmation)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for client agent info in delivery confirmations.
 */
const ConfirmationClientAgentWireSchema = z.object({
  name: z.string().min(1),
  wallet_address: HexAddressSchema,
});

// ---------------------------------------------------------------------------
// ConfirmationDetails (nested within DeliveryConfirmation)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for confirmation details.
 */
const ConfirmationDetailsWireSchema = z.object({
  received: z.boolean(),
  content_hash: z.string().min(1),
  received_at: ISOTimestampSchema,
  satisfaction_rating: z.number().int().min(1).max(5).optional(),
});

// ---------------------------------------------------------------------------
// DeliveryConfirmation
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for DeliveryConfirmation messages.
 */
const DeliveryConfirmationWireSchema = z.object({
  protocol: ProtocolVersionSchema,
  message_type: z.literal("delivery_confirmation"),
  timestamp: ISOTimestampSchema,
  order_id: z.string().min(1),
  client_agent: ConfirmationClientAgentWireSchema,
  confirmation: ConfirmationDetailsWireSchema,
  signature: HexSignatureSchema,
  signed_message: z.string().min(1),
});

/**
 * Schema for DeliveryConfirmation with snake_case -> camelCase transform.
 */
export const DeliveryConfirmationSchema = DeliveryConfirmationWireSchema.transform((data) => ({
  protocol: data.protocol,
  messageType: data.message_type,
  timestamp: data.timestamp,
  orderId: data.order_id,
  clientAgent: {
    name: data.client_agent.name,
    walletAddress: data.client_agent.wallet_address,
  },
  confirmation: {
    received: data.confirmation.received,
    contentHash: data.confirmation.content_hash,
    receivedAt: data.confirmation.received_at,
    satisfactionRating: data.confirmation.satisfaction_rating,
  },
  signature: data.signature,
  signedMessage: data.signed_message,
}));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Inferred type from DeliveryAcceptedSchema output. */
export type DeliveryAcceptedOutput = z.infer<typeof DeliveryAcceptedSchema>;

/** Inferred type from DeliverableSchema output. */
export type DeliverableOutput = z.infer<typeof DeliverableSchema>;

/** Inferred type from DeliveryResponseSchema output. */
export type DeliveryResponseOutput = z.infer<typeof DeliveryResponseSchema>;

/** Inferred type from DeliveryConfirmationSchema output. */
export type DeliveryConfirmationOutput = z.infer<typeof DeliveryConfirmationSchema>;
