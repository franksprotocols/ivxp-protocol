/**
 * @ivxp/protocol
 *
 * IVXP Protocol types, schemas, and constants.
 *
 * Provides all IVXP/1.0 protocol message type definitions
 * for building type-safe SDK implementations.
 */

// Re-export all types and constants
export {
  // Common types
  type DeliveryFormat,
  type HexAddress,
  type HexHash,
  type HexSignature,
  type ISOTimestamp,
  type NetworkId,
  type ProtocolVersion,
  PROTOCOL_VERSION,

  // Service types
  type ClientAgent,
  type ServiceCatalog,
  type ServiceDefinition,
  type ServiceRequest,
  type ServiceRequestDetails,

  // Order types
  type DeliveryRequest,
  type OrderStatus,
  type OrderStatusResponse,
  type PaymentProof,
  type ProviderAgent,
  type QuoteDetails,
  type QuoteTerms,
  type ServiceQuote,
  ORDER_STATUSES,

  // Payment types
  type PaymentInfo,
  type PaymentVerificationResult,
  type TransactionRef,
  USDC_CONTRACT_ADDRESSES,
  USDC_DECIMALS,

  // Delivery types
  type ConfirmationClientAgent,
  type ConfirmationDetails,
  type Deliverable,
  type DeliveryAccepted,
  type DeliveryConfirmation,
  type DeliveryProviderAgent,
  type DeliveryResponse,

  // Error types
  type IVXPErrorCode,
  type IVXPErrorResponse,
  type IVXPMessageType,
  ERROR_CODES,
  MESSAGE_TYPES,
} from "./types/index.js";
