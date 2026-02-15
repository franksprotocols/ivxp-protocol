/**
 * SDK-specific types for the IVXP client.
 *
 * These types represent the developer-facing API (camelCase) and
 * are distinct from the wire-format protocol types (snake_case).
 *
 * Field mapping from SDK params to wire-format:
 *
 * | SDK (camelCase)    | Wire (snake_case)    |
 * |--------------------|----------------------|
 * | serviceType        | type                 |
 * | description        | description          |
 * | budgetUsdc         | budget_usdc          |
 * | deliveryFormat     | delivery_format      |
 * | deadline           | deadline             |
 * | contactEndpoint    | contact_endpoint     |
 *
 * The SDK also auto-injects these wire-format fields:
 * - `protocol` ("IVXP/1.0")
 * - `message_type` ("service_request")
 * - `timestamp` (ISO 8601)
 * - `client_agent.name` ("IVXP SDK Client")
 * - `client_agent.wallet_address` (from crypto service)
 */

import type {
  DeliveryFormat,
  OrderStatus,
  ServiceQuoteOutput,
  DeliveryResponseOutput,
} from "@ivxp/protocol";
import type { OrderPollOptions } from "./client.js";

// ---------------------------------------------------------------------------
// ConfirmationResult -- Return type for client.confirmDelivery()
// ---------------------------------------------------------------------------

/**
 * Result of a successful delivery confirmation.
 *
 * Returned when the signed confirmation is accepted by the provider
 * and the order transitions to the 'confirmed' terminal state.
 */
export interface ConfirmationResult {
  /** The order identifier. */
  readonly orderId: string;

  /** The terminal order status. Always 'confirmed'. */
  readonly status: "confirmed";

  /**
   * ISO 8601 timestamp when the order was confirmed.
   *
   * On a fresh confirmation, this is the provider's authoritative timestamp.
   * On an idempotent retry (ORDER_ALREADY_CONFIRMED), this is the local
   * timestamp of the retry call. Use `getOrderStatus()` to obtain the
   * provider's original confirmation timestamp in that case.
   */
  readonly confirmedAt: string;

  /** The EIP-191 signature of the confirmation message. */
  readonly signature: `0x${string}`;
}

// ---------------------------------------------------------------------------
// ServiceRequestParams -- Input for client.requestQuote()
// ---------------------------------------------------------------------------

/**
 * Parameters for requesting a service quote from a provider.
 *
 * These are the user-facing inputs (camelCase); the SDK auto-injects
 * client wallet address, timestamp, and protocol version before
 * transforming to wire-format (snake_case) and sending the request.
 *
 * @see {@link https://docs.ivxp.io/protocol/messages#service-request | IVXP/1.0 ServiceRequest}
 */
export interface ServiceRequestParams {
  /**
   * Service type to request (must match a catalog entry).
   * Maps to wire-format field `service_request.type`.
   */
  readonly serviceType: string;

  /**
   * Description of what you need.
   * Maps to wire-format field `service_request.description`.
   */
  readonly description: string;

  /**
   * Maximum budget in USDC. Must be a positive, finite number.
   * Maps to wire-format field `service_request.budget_usdc`.
   */
  readonly budgetUsdc: number;

  /**
   * Optional delivery format preference.
   * Valid values: "markdown", "json", "code".
   * Maps to wire-format field `service_request.delivery_format`.
   */
  readonly deliveryFormat?: DeliveryFormat;

  /**
   * Optional deadline for delivery (must be a valid future Date).
   * Serialized to ISO 8601 string in wire-format field `service_request.deadline`.
   */
  readonly deadline?: Date;

  /**
   * Optional contact endpoint for P2P push delivery callbacks.
   * Maps to wire-format field `client_agent.contact_endpoint`.
   */
  readonly contactEndpoint?: string;
}

// ---------------------------------------------------------------------------
// SubmitPaymentQuote -- Input for client.submitPayment()
// ---------------------------------------------------------------------------

/**
 * Quote details required for submitting a payment.
 *
 * Contains the minimum information needed to send USDC to a provider
 * as part of the payment flow.
 */
export interface SubmitPaymentQuote {
  /** The quoted price in USDC (as a number, e.g. 10 or 8.5). */
  readonly priceUsdc: number;

  /** The provider's wallet address to receive payment. */
  readonly paymentAddress: `0x${string}`;
}

// ---------------------------------------------------------------------------
// PaymentResult -- Return type for client.submitPayment()
// ---------------------------------------------------------------------------

/**
 * Result of a successful payment submission.
 *
 * Returned when both the USDC transfer and provider notification succeed.
 */
export interface PaymentResult {
  /** The order identifier. */
  readonly orderId: string;

  /** The on-chain transaction hash. */
  readonly txHash: `0x${string}`;

  /** The updated order status (typically "paid"). */
  readonly status: OrderStatus;
}

// ---------------------------------------------------------------------------
// DownloadOptions -- Input for client.downloadDeliverable()
// ---------------------------------------------------------------------------

/**
 * Options for downloading a deliverable from a provider.
 */
export interface DownloadOptions {
  /**
   * Optional path to save the deliverable to a file.
   *
   * When provided, the deliverable content will be written to this path
   * in addition to being returned. Requires a Node.js runtime with
   * `fs/promises` available. The file will be overwritten if it already
   * exists.
   */
  readonly savePath?: string;
}

// ---------------------------------------------------------------------------
// RequestServiceParams -- Input for client.requestService()
// ---------------------------------------------------------------------------

/**
 * Parameters for the one-line requestService convenience method.
 *
 * Orchestrates the complete flow: quote -> pay -> poll -> download -> confirm.
 * Supports progress callbacks for UI feedback and budget/timeout guards.
 */
export interface RequestServiceParams {
  /** Provider URL (http or https). */
  readonly providerUrl: string;

  /** Service type to request (must match a catalog entry). */
  readonly serviceType: string;

  /** Description of what you need. */
  readonly description: string;

  /**
   * Maximum budget in USDC.
   * If the quote price exceeds this, BudgetExceededError is thrown
   * before any on-chain transaction.
   */
  readonly budgetUsdc: number;

  /** Optional delivery format preference. */
  readonly deliveryFormat?: DeliveryFormat;

  /**
   * Timeout in milliseconds for the entire flow.
   * Defaults to 120_000 (2 minutes).
   */
  readonly timeoutMs?: number;

  /**
   * Whether to auto-confirm after delivery.
   * Defaults to true. Set to false for manual review before confirming.
   */
  readonly autoConfirm?: boolean;

  /** Polling options for waiting on delivery. */
  readonly pollOptions?: Omit<OrderPollOptions, "targetStatuses">;

  /** Called when a quote is received from the provider. */
  readonly onQuote?: (quote: ServiceQuoteOutput) => void;

  /** Called when on-chain payment is submitted. */
  readonly onPayment?: (result: PaymentResult) => void;

  /** Called when the order is delivered. */
  readonly onDelivered?: (delivery: DeliveryResponseOutput) => void;

  /** Called when the delivery is confirmed. */
  readonly onConfirmed?: (result: ConfirmationResult) => void;
}

// ---------------------------------------------------------------------------
// RequestServiceResult -- Return type for client.requestService()
// ---------------------------------------------------------------------------

/**
 * Result of a successful one-line requestService call.
 *
 * Contains the complete order outcome including the deliverable content,
 * payment transaction hash, and confirmation status.
 */
export interface RequestServiceResult {
  /** The order identifier. */
  readonly orderId: string;

  /**
   * Terminal status of the order.
   * 'confirmed' when autoConfirm is true, 'delivered' when false.
   */
  readonly status: "confirmed" | "delivered";

  /** The downloaded deliverable response. */
  readonly deliverable: DeliveryResponseOutput;

  /** The original service quote from the provider. */
  readonly quote: ServiceQuoteOutput;

  /** The on-chain payment transaction hash. */
  readonly paymentTxHash: `0x${string}`;

  /** ISO 8601 timestamp of confirmation (only set when autoConfirm is true). */
  readonly confirmedAt?: string;
}
