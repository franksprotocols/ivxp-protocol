/**
 * IVXP/1.0 Order Zod Schemas
 *
 * Validates OrderStatusResponse, ServiceQuote, and DeliveryRequest messages.
 * Wire format uses snake_case; transforms produce camelCase output.
 *
 * Transform logic is extracted into reusable helper functions to avoid
 * duplication between standalone sub-schemas and parent message schemas.
 */

import { z } from "zod";

import {
  HexAddressLenientSchema,
  HexAddressSchema,
  HexHashSchema,
  HexSignatureSchema,
  ISOTimestampSchema,
  NetworkIdSchema,
  OrderStatusSchema,
  ProtocolVersionSchema,
} from "./common.js";

// ---------------------------------------------------------------------------
// ProviderAgent (nested within ServiceQuote)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for provider agent identification.
 */
const ProviderAgentWireSchema = z.object({
  name: z.string().min(1),
  wallet_address: HexAddressSchema,
  public_key: HexAddressLenientSchema.optional(),
});

/** Transform wire-format provider agent to camelCase. */
function transformProviderAgent(
  data: z.output<typeof ProviderAgentWireSchema>,
) {
  return {
    name: data.name,
    walletAddress: data.wallet_address,
    publicKey: data.public_key,
  };
}

/**
 * Schema for provider agent with snake_case -> camelCase transform.
 */
export const ProviderAgentSchema =
  ProviderAgentWireSchema.transform(transformProviderAgent);

// ---------------------------------------------------------------------------
// QuoteDetails (nested within ServiceQuote)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for quote pricing and payment details.
 */
const QuoteDetailsWireSchema = z.object({
  price_usdc: z.number().positive(),
  estimated_delivery: ISOTimestampSchema,
  payment_address: HexAddressSchema,
  network: NetworkIdSchema,
  token_contract: HexAddressSchema.optional(),
});

/** Transform wire-format quote details to camelCase. */
function transformQuoteDetails(
  data: z.output<typeof QuoteDetailsWireSchema>,
) {
  return {
    priceUsdc: data.price_usdc,
    estimatedDelivery: data.estimated_delivery,
    paymentAddress: data.payment_address,
    network: data.network,
    tokenContract: data.token_contract,
  };
}

/**
 * Schema for quote details with snake_case -> camelCase transform.
 */
export const QuoteDetailsSchema =
  QuoteDetailsWireSchema.transform(transformQuoteDetails);

// ---------------------------------------------------------------------------
// QuoteTerms (optional within ServiceQuote)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for optional payment and service terms.
 */
const QuoteTermsWireSchema = z.object({
  payment_timeout: z.number().int().positive().optional(),
  revision_policy: z.string().optional(),
  refund_policy: z.string().optional(),
});

/** Transform wire-format quote terms to camelCase. */
function transformQuoteTerms(data: z.output<typeof QuoteTermsWireSchema>) {
  return {
    paymentTimeout: data.payment_timeout,
    revisionPolicy: data.revision_policy,
    refundPolicy: data.refund_policy,
  };
}

/**
 * Schema for quote terms with snake_case -> camelCase transform.
 */
export const QuoteTermsSchema =
  QuoteTermsWireSchema.transform(transformQuoteTerms);

// ---------------------------------------------------------------------------
// ServiceQuote - Response from POST /ivxp/request
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for ServiceQuote messages.
 */
const ServiceQuoteWireSchema = z.object({
  protocol: ProtocolVersionSchema,
  message_type: z.literal("service_quote"),
  timestamp: ISOTimestampSchema,
  order_id: z.string().min(1),
  provider_agent: ProviderAgentWireSchema,
  quote: QuoteDetailsWireSchema,
  terms: QuoteTermsWireSchema.optional(),
});

/**
 * Schema for ServiceQuote with snake_case -> camelCase transform.
 *
 * Input: Wire-format JSON with snake_case fields.
 * Output: camelCase TypeScript object.
 *
 * Reuses transformProviderAgent, transformQuoteDetails, and
 * transformQuoteTerms to avoid duplicating transform logic.
 */
export const ServiceQuoteSchema = ServiceQuoteWireSchema.transform(
  (data) => ({
    protocol: data.protocol,
    messageType: data.message_type,
    timestamp: data.timestamp,
    orderId: data.order_id,
    providerAgent: transformProviderAgent(data.provider_agent),
    quote: transformQuoteDetails(data.quote),
    terms: data.terms ? transformQuoteTerms(data.terms) : undefined,
  }),
);

// ---------------------------------------------------------------------------
// PaymentProof (nested within DeliveryRequest)
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for payment proof.
 */
const PaymentProofWireSchema = z.object({
  tx_hash: HexHashSchema,
  from_address: HexAddressSchema,
  network: NetworkIdSchema,
  to_address: HexAddressSchema.optional(),
  amount_usdc: z.string().optional(),
  block_number: z.number().int().nonnegative().optional(),
});

/** Transform wire-format payment proof to camelCase. */
function transformPaymentProof(
  data: z.output<typeof PaymentProofWireSchema>,
) {
  return {
    txHash: data.tx_hash,
    fromAddress: data.from_address,
    network: data.network,
    toAddress: data.to_address,
    amountUsdc: data.amount_usdc,
    blockNumber: data.block_number,
  };
}

/**
 * Schema for payment proof with snake_case -> camelCase transform.
 */
export const PaymentProofSchema =
  PaymentProofWireSchema.transform(transformPaymentProof);

// ---------------------------------------------------------------------------
// DeliveryRequest - POST /ivxp/deliver body
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for DeliveryRequest messages.
 */
const DeliveryRequestWireSchema = z.object({
  protocol: ProtocolVersionSchema,
  message_type: z.literal("delivery_request"),
  timestamp: ISOTimestampSchema,
  order_id: z.string().min(1),
  payment_proof: PaymentProofWireSchema,
  delivery_endpoint: z.string().url().optional(),
  signature: HexSignatureSchema,
  signed_message: z.string().min(1),
});

/**
 * Schema for DeliveryRequest with snake_case -> camelCase transform.
 *
 * Input: Wire-format JSON with snake_case fields.
 * Output: camelCase TypeScript object.
 *
 * Reuses transformPaymentProof to avoid duplicating transform logic.
 */
export const DeliveryRequestSchema = DeliveryRequestWireSchema.transform(
  (data) => ({
    protocol: data.protocol,
    messageType: data.message_type,
    timestamp: data.timestamp,
    orderId: data.order_id,
    paymentProof: transformPaymentProof(data.payment_proof),
    deliveryEndpoint: data.delivery_endpoint,
    signature: data.signature,
    signedMessage: data.signed_message,
  }),
);

// ---------------------------------------------------------------------------
// OrderStatusResponse - GET /ivxp/status/{order_id} response
// ---------------------------------------------------------------------------

/**
 * Wire-format schema for OrderStatusResponse messages.
 */
const OrderStatusResponseWireSchema = z.object({
  order_id: z.string().min(1),
  status: z.enum(["quoted", "paid", "delivered", "delivery_failed"]),
  created_at: ISOTimestampSchema,
  service_type: z.string().min(1),
  price_usdc: z.number().nonnegative(),
});

/**
 * Schema for OrderStatusResponse with snake_case -> camelCase transform.
 */
export const OrderStatusResponseSchema =
  OrderStatusResponseWireSchema.transform((data) => ({
    orderId: data.order_id,
    status: data.status,
    createdAt: data.created_at,
    serviceType: data.service_type,
    priceUsdc: data.price_usdc,
  }));

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Inferred type from ServiceQuoteSchema output. */
export type ServiceQuoteOutput = z.infer<typeof ServiceQuoteSchema>;

/** Inferred type from DeliveryRequestSchema output. */
export type DeliveryRequestOutput = z.infer<typeof DeliveryRequestSchema>;

/** Inferred type from OrderStatusResponseSchema output. */
export type OrderStatusResponseOutput = z.infer<
  typeof OrderStatusResponseSchema
>;

/** Inferred type from PaymentProofSchema output. */
export type PaymentProofOutput = z.infer<typeof PaymentProofSchema>;

/** Re-export OrderStatusSchema for convenience. */
export { OrderStatusSchema };
