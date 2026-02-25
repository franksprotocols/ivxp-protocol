/**
 * IVXP/1.0 Delivery Types
 *
 * Defines delivery-related message types for the IVXP protocol.
 * All wire protocol fields use snake_case for Python compatibility.
 */

import type { HexAddress, HexSignature, ISOTimestamp, ProtocolVersion } from "./common.js";

// ---------------------------------------------------------------------------
// DeliveryAccepted - Response from POST /ivxp/deliver
// ---------------------------------------------------------------------------

/**
 * Acceptance response returned by the Provider after a delivery request.
 *
 * Response from `POST /ivxp/deliver`.
 */
export interface DeliveryAccepted {
  /** Status indicator. Always "accepted" on success. */
  readonly status: "accepted";

  /** Order identifier. */
  readonly order_id: string;

  /** Human-readable message. */
  readonly message: string;

  /** Optional SSE stream URL for real-time progress updates. */
  readonly stream_url?: string;
}

// ---------------------------------------------------------------------------
// Deliverable
// ---------------------------------------------------------------------------

/**
 * The deliverable payload within a DeliveryResponse.
 *
 * Generic parameter `T` allows consumers to narrow the content type
 * for specific service types. Defaults to `unknown` for general use.
 *
 * @typeParam T - The type of the deliverable content.
 *
 * @example
 * ```typescript
 * // General use (content is unknown)
 * const deliverable: Deliverable = { type: "report", content: "..." };
 *
 * // Narrowed use (content is typed)
 * interface CodeReviewResult { issues: string[]; score: number; }
 * const typed: Deliverable<CodeReviewResult> = {
 *   type: "code_review_result",
 *   content: { issues: [], score: 9.5 },
 * };
 * ```
 */
export interface Deliverable<T = unknown> {
  /** Deliverable content type (e.g. "code_review_result", "research_report"). */
  readonly type: string;

  /** Content format (e.g. "markdown", "json"). */
  readonly format?: string;

  /** Deliverable content. Structure depends on the service type. */
  readonly content: T;
}

// ---------------------------------------------------------------------------
// DeliveryResponse - GET /ivxp/download/{order_id} response
// ---------------------------------------------------------------------------

/**
 * Provider agent info within a delivery response (minimal).
 */
export interface DeliveryProviderAgent {
  /** Provider name. */
  readonly name: string;

  /** Provider's wallet address. */
  readonly wallet_address: HexAddress;
}

/**
 * Delivery response returned when downloading a completed deliverable.
 *
 * Response from `GET /ivxp/download/{order_id}`.
 *
 * @typeParam T - The type of the deliverable content. Defaults to `unknown`.
 */
export interface DeliveryResponse<T = unknown> {
  /** Protocol version identifier. */
  readonly protocol: ProtocolVersion;

  /** Message type discriminator. */
  readonly message_type: "service_delivery";

  /** Timestamp of the delivery (ISO 8601). */
  readonly timestamp: ISOTimestamp;

  /** Order identifier. */
  readonly order_id: string;

  /** Delivery status. Always "completed" for download responses. */
  readonly status: "completed";

  /** Provider agent identification. */
  readonly provider_agent: DeliveryProviderAgent;

  /** The deliverable payload. */
  readonly deliverable: Deliverable<T>;

  /** SHA-256 hash of the deliverable content for integrity verification. */
  readonly content_hash?: string;

  /** Timestamp when the deliverable was produced (ISO 8601). */
  readonly delivered_at?: ISOTimestamp;

  // -- Extension fields (optional, backward-compatible) --

  /** Provider's signature on the delivery. */
  readonly signature?: HexSignature;

  /** The message that was signed by the provider. */
  readonly signed_message?: string;
}

// ---------------------------------------------------------------------------
// DeliveryConfirmation - Optional, IVXP/1.1
// ---------------------------------------------------------------------------

/**
 * Client agent info within a delivery confirmation.
 */
export interface ConfirmationClientAgent {
  /** Client agent name. */
  readonly name: string;

  /** Client's wallet address. */
  readonly wallet_address: HexAddress;
}

/**
 * Confirmation details within a DeliveryConfirmation message.
 */
export interface ConfirmationDetails {
  /** Whether the deliverable was received. */
  readonly received: boolean;

  /** Content hash computed by the client for consistency verification. */
  readonly content_hash: string;

  /** Timestamp when the deliverable was received (ISO 8601). */
  readonly received_at: ISOTimestamp;

  /** Optional satisfaction rating (1-5). */
  readonly satisfaction_rating?: number;
}

/**
 * Delivery confirmation sent by the Client to the Provider.
 *
 * Optional in IVXP/1.0, planned for IVXP/1.1.
 */
export interface DeliveryConfirmation {
  /** Protocol version identifier. */
  readonly protocol: ProtocolVersion;

  /** Message type discriminator. */
  readonly message_type: "delivery_confirmation";

  /** Timestamp of the confirmation (ISO 8601). */
  readonly timestamp: ISOTimestamp;

  /** Order identifier. */
  readonly order_id: string;

  /** Client agent identification. */
  readonly client_agent: ConfirmationClientAgent;

  /** Confirmation details. */
  readonly confirmation: ConfirmationDetails;

  /** Client's EIP-191 signature. */
  readonly signature: HexSignature;

  /** The message that was signed. */
  readonly signed_message: string;
}
