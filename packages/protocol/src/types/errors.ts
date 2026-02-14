/**
 * IVXP/1.0 Error Types
 *
 * Defines error codes and error response types.
 * Error codes use SCREAMING_SNAKE_CASE per project conventions.
 */

// ---------------------------------------------------------------------------
// Error Code Constants
// ---------------------------------------------------------------------------

/**
 * All IVXP protocol error codes.
 *
 * Uses SCREAMING_SNAKE_CASE for consistency with wire protocol conventions.
 */
export const ERROR_CODES = {
  /** Payment transaction could not be verified on-chain. */
  PAYMENT_NOT_VERIFIED: "PAYMENT_NOT_VERIFIED",

  /** EIP-191 signature verification failed. */
  SIGNATURE_INVALID: "SIGNATURE_INVALID",

  /** The specified order was not found. */
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",

  /** The requested service is unavailable. */
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  /** Insufficient USDC balance for the transaction. */
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",

  /** The requested service type is not supported by this Provider. */
  SERVICE_TYPE_NOT_SUPPORTED: "SERVICE_TYPE_NOT_SUPPORTED",

  /** Budget is below the service price. */
  BUDGET_TOO_LOW: "BUDGET_TOO_LOW",

  /** The payment has timed out. */
  PAYMENT_TIMEOUT: "PAYMENT_TIMEOUT",

  /** The order has expired. */
  ORDER_EXPIRED: "ORDER_EXPIRED",

  /** The protocol version is not supported. */
  PROTOCOL_VERSION_UNSUPPORTED: "PROTOCOL_VERSION_UNSUPPORTED",

  /** An internal error occurred on the Provider side. */
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

// ---------------------------------------------------------------------------
// Error Code Type
// ---------------------------------------------------------------------------

/**
 * Union type of all valid IVXP error code values.
 */
export type IVXPErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ---------------------------------------------------------------------------
// Error Response
// ---------------------------------------------------------------------------

/**
 * Standard error response format for IVXP protocol errors.
 */
export interface IVXPErrorResponse {
  /** The error code (SCREAMING_SNAKE_CASE). */
  readonly error: IVXPErrorCode;

  /** Human-readable error message. */
  readonly message: string;

  /** Optional additional error context. */
  readonly details?: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Message Type Discriminators
// ---------------------------------------------------------------------------

/**
 * All valid IVXP/1.0 message type discriminators.
 */
export type IVXPMessageType =
  | "service_catalog"
  | "service_request"
  | "service_quote"
  | "delivery_request"
  | "service_delivery"
  | "delivery_confirmation";

/**
 * All valid message types as a readonly tuple for runtime checks.
 */
export const MESSAGE_TYPES = [
  "service_catalog",
  "service_request",
  "service_quote",
  "delivery_request",
  "service_delivery",
  "delivery_confirmation",
] as const satisfies readonly IVXPMessageType[];
