/**
 * @ivxp/protocol - Types Index
 *
 * Re-exports all IVXP/1.0 protocol type definitions.
 */

// Common types
export type {
  DeliveryFormat,
  HexAddress,
  HexHash,
  HexSignature,
  ISOTimestamp,
  NetworkId,
  ProtocolVersion,
} from "./common.js";
export { PROTOCOL_VERSION } from "./common.js";

// Service types
export type {
  ClientAgent,
  ServiceCatalog,
  ServiceDefinition,
  ServiceRequest,
  ServiceRequestDetails,
} from "./service.js";

// Order types
export type {
  DeliveryRequest,
  OrderStatus,
  OrderStatusResponse,
  PaymentProof,
  ProviderAgent,
  QuoteDetails,
  QuoteTerms,
  ServiceQuote,
} from "./order.js";
export { ORDER_STATUSES } from "./order.js";

// Payment types
export type { PaymentInfo, PaymentVerificationResult, TransactionRef } from "./payment.js";
export { USDC_CONTRACT_ADDRESSES, USDC_DECIMALS } from "./payment.js";

// Delivery types
export type {
  ConfirmationClientAgent,
  ConfirmationDetails,
  Deliverable,
  DeliveryAccepted,
  DeliveryConfirmation,
  DeliveryProviderAgent,
  DeliveryResponse,
} from "./delivery.js";

// Error types
export type { IVXPErrorCode, IVXPErrorResponse, IVXPMessageType } from "./errors.js";
export { ERROR_CODES, MESSAGE_TYPES } from "./errors.js";
