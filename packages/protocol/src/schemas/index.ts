/**
 * @ivxp/protocol - Schemas Index
 *
 * Re-exports all Zod validation schemas for IVXP/1.0 protocol messages.
 *
 * Schemas validate wire-format JSON (snake_case) and transform
 * to camelCase TypeScript objects via Zod `.transform()`.
 */

// Common schemas
export {
  DeliveryFormatSchema,
  HexAddressLenientSchema,
  HexAddressSchema,
  HexHashSchema,
  HexSignatureSchema,
  ISOTimestampSchema,
  IVXPMessageTypeSchema,
  NetworkIdSchema,
  OrderStatusSchema,
  ProtocolVersionSchema,
} from "./common.js";

// Order schemas
export {
  DeliveryRequestSchema,
  OrderStatusResponseSchema,
  PaymentProofSchema,
  ProviderAgentSchema,
  QuoteDetailsSchema,
  QuoteTermsSchema,
  ServiceQuoteSchema,
} from "./order-schema.js";
export type {
  DeliveryRequestOutput,
  OrderStatusResponseOutput,
  PaymentProofOutput,
  ServiceQuoteOutput,
} from "./order-schema.js";

// Service schemas
export {
  ClientAgentSchema,
  ServiceCatalogSchema,
  ServiceDefinitionSchema,
  ServiceRequestDetailsSchema,
  ServiceRequestSchema,
} from "./service-schema.js";
export type {
  ClientAgentOutput,
  ServiceCatalogOutput,
  ServiceDefinitionOutput,
  ServiceRequestOutput,
} from "./service-schema.js";

// Payment schemas
export {
  IVXPErrorResponseSchema,
  PaymentInfoSchema,
  PaymentVerificationResultSchema,
  TransactionRefSchema,
} from "./payment-schema.js";
export type {
  PaymentInfoOutput,
  PaymentVerificationResultOutput,
  TransactionRefOutput,
} from "./payment-schema.js";

// Delivery schemas
export {
  DeliverableSchema,
  DeliveryAcceptedSchema,
  DeliveryConfirmationSchema,
  DeliveryProviderAgentSchema,
  DeliveryResponseSchema,
} from "./delivery-schema.js";
export type {
  DeliverableOutput,
  DeliveryAcceptedOutput,
  DeliveryConfirmationOutput,
  DeliveryResponseOutput,
} from "./delivery-schema.js";
