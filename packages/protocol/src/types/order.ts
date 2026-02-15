/**
 * IVXP/1.0 Order Types
 *
 * Defines OrderStatus, ServiceQuote, DeliveryRequest, and related types.
 * All wire protocol fields use snake_case for Python compatibility.
 */

import type {
  HexAddress,
  HexHash,
  HexSignature,
  ISOTimestamp,
  NetworkId,
  ProtocolVersion,
} from "./common.js";

// ---------------------------------------------------------------------------
// OrderStatus
// ---------------------------------------------------------------------------

/**
 * Order lifecycle states as defined by the IVXP/1.0 state machine.
 *
 * - `quoted`          : Quote issued, awaiting payment.
 * - `paid`            : Payment verified, awaiting processing.
 * - `processing`      : Service handler is actively processing the order.
 * - `delivered`       : P2P push delivery succeeded.
 * - `delivery_failed` : P2P push failed; deliverable is still downloadable.
 * - `confirmed`       : (Optional) Client signed confirmation of receipt.
 */
export type OrderStatus =
  | "quoted"
  | "paid"
  | "processing"
  | "delivered"
  | "delivery_failed"
  | "confirmed";

/**
 * All valid order status values as a readonly tuple for runtime checks.
 */
export const ORDER_STATUSES = [
  "quoted",
  "paid",
  "processing",
  "delivered",
  "delivery_failed",
  "confirmed",
] as const satisfies readonly OrderStatus[];

// ---------------------------------------------------------------------------
// ServiceQuote - Response from POST /ivxp/request
// ---------------------------------------------------------------------------

/**
 * Provider agent identification within a ServiceQuote.
 */
export interface ProviderAgent {
  /** Provider name. */
  readonly name: string;

  /** Provider's wallet address. */
  readonly wallet_address: HexAddress;

  /** Optional provider public key. */
  readonly public_key?: HexAddress;
}

/**
 * Quote details including pricing and payment information.
 */
export interface QuoteDetails {
  /** Quoted price in USDC. */
  readonly price_usdc: number;

  /** Estimated delivery time (ISO 8601). */
  readonly estimated_delivery: ISOTimestamp;

  /** Payment destination address. */
  readonly payment_address: HexAddress;

  /** Blockchain network for payment. */
  readonly network: NetworkId;

  /** USDC token contract address (optional). */
  readonly token_contract?: HexAddress;
}

/**
 * Payment and service terms (optional).
 */
export interface QuoteTerms {
  /** Payment timeout in seconds. */
  readonly payment_timeout?: number;

  /** Revision policy description. */
  readonly revision_policy?: string;

  /** Refund policy description. */
  readonly refund_policy?: string;
}

/**
 * Service quote returned by the Provider in response to a ServiceRequest.
 *
 * Response from `POST /ivxp/request`.
 */
export interface ServiceQuote {
  /** Protocol version identifier. */
  readonly protocol: ProtocolVersion;

  /** Message type discriminator. */
  readonly message_type: "service_quote";

  /** Timestamp of the quote (ISO 8601). */
  readonly timestamp: ISOTimestamp;

  /** Unique order identifier. Format: ivxp-{uuid-v4}. */
  readonly order_id: string;

  /** Provider agent identification. */
  readonly provider_agent: ProviderAgent;

  /** Quote details with pricing and payment info. */
  readonly quote: QuoteDetails;

  /** Optional payment and service terms. */
  readonly terms?: QuoteTerms;
}

// ---------------------------------------------------------------------------
// DeliveryRequest - POST /ivxp/deliver body
// ---------------------------------------------------------------------------

/**
 * Payment proof included in a delivery request.
 */
export interface PaymentProof {
  /** On-chain transaction hash. */
  readonly tx_hash: HexHash;

  /** Sender wallet address. */
  readonly from_address: HexAddress;

  /** Blockchain network where payment was made. */
  readonly network: NetworkId;

  // -- Extension fields (optional, backward-compatible) --

  /** Recipient wallet address. */
  readonly to_address?: HexAddress;

  /** Raw USDC amount (6 decimals string representation). */
  readonly amount_usdc?: string;

  /** Block number where the transaction was included. */
  readonly block_number?: number;
}

/**
 * Delivery request sent by a Client after payment, via `POST /ivxp/deliver`.
 *
 * Includes payment proof and client signature for identity verification.
 */
export interface DeliveryRequest {
  /** Protocol version identifier. */
  readonly protocol: ProtocolVersion;

  /** Message type discriminator. */
  readonly message_type: "delivery_request";

  /** Timestamp of the delivery request (ISO 8601). */
  readonly timestamp: ISOTimestamp;

  /** Order identifier from the quote. */
  readonly order_id: string;

  /** Payment proof with transaction details. */
  readonly payment_proof: PaymentProof;

  /**
   * Optional client endpoint for P2P push delivery.
   * If omitted, Provider uses Store & Forward; Client must poll and download.
   */
  readonly delivery_endpoint?: string;

  /** EIP-191 signature. */
  readonly signature: HexSignature;

  /**
   * The message that was signed.
   * Format: "Order: {order_id} | Payment: {tx_hash} | Timestamp: {timestamp}"
   */
  readonly signed_message: string;
}

// ---------------------------------------------------------------------------
// OrderStatusResponse - GET /ivxp/status/{order_id} response
// ---------------------------------------------------------------------------

/**
 * Order status response from `GET /ivxp/status/{order_id}`.
 */
export interface OrderStatusResponse {
  /** Order identifier. */
  readonly order_id: string;

  /**
   * Current order status.
   * Note: `confirmed` is excluded from status query per IVXP/1.0 reference.
   */
  readonly status: "quoted" | "paid" | "processing" | "delivered" | "delivery_failed";

  /** Order creation timestamp (ISO 8601). */
  readonly created_at: ISOTimestamp;

  /** Service type requested. */
  readonly service_type: string;

  /** Quoted price in USDC. */
  readonly price_usdc: number;
}
