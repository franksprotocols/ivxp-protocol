/**
 * IVXP/1.0 Service Types
 *
 * Defines ServiceCatalog and ServiceRequest message types.
 * All wire protocol fields use snake_case for Python compatibility.
 */

import type { DeliveryFormat, HexAddress, ISOTimestamp, ProtocolVersion } from "./common.js";

// ---------------------------------------------------------------------------
// Service Definition (used within ServiceCatalog)
// ---------------------------------------------------------------------------

/**
 * A single service offered by a Provider, as listed in the catalog.
 */
export interface ServiceDefinition {
  /** Service type identifier (e.g. "code_review", "translation"). */
  readonly type: string;

  /** Base price in USDC for the service. */
  readonly base_price_usdc: number;

  /** Estimated delivery time in hours. */
  readonly estimated_delivery_hours: number;
}

// ---------------------------------------------------------------------------
// ServiceCatalog - GET /ivxp/catalog response
// ---------------------------------------------------------------------------

/**
 * Provider's service catalog, returned by `GET /ivxp/catalog`.
 *
 * Lists all services offered by the Provider with pricing.
 */
export interface ServiceCatalog {
  /** Protocol version identifier. */
  readonly protocol: ProtocolVersion;

  /** Provider name / identifier. */
  readonly provider: string;

  /** Provider's wallet address for receiving payments. */
  readonly wallet_address: HexAddress;

  /** Array of services offered by this Provider. */
  readonly services: readonly ServiceDefinition[];

  /**
   * Optional list of capability identifiers supported by this Provider.
   *
   * Known values:
   * - `"sse"` — Provider supports real-time SSE streaming via GET /ivxp/stream/:orderId
   *
   * Absence of this field (or an empty array) means IVXP/1.0 baseline only.
   * Clients MUST silently ignore any unrecognized capability strings to
   * ensure forward compatibility.
   *
   * @since IVXP/3.0
   */
  readonly capabilities?: readonly string[];

  // -- Extension fields (optional, backward-compatible) --

  /** Message type discriminator. */
  readonly message_type?: "service_catalog";

  /** Timestamp when the catalog was generated (ISO 8601). */
  readonly timestamp?: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// ServiceRequest - POST /ivxp/request body
// ---------------------------------------------------------------------------

/**
 * Client agent identification within a ServiceRequest.
 */
export interface ClientAgent {
  /** Name of the client agent. */
  readonly name: string;

  /** Client's wallet address. */
  readonly wallet_address: HexAddress;

  /** Optional endpoint for P2P push delivery. */
  readonly contact_endpoint?: string;
}

/**
 * Service request details within a ServiceRequest message.
 */
export interface ServiceRequestDetails {
  /** Service type to request (must match a catalog entry). */
  readonly type: string;

  /** Requirement description text. SDK input is serialized here. */
  readonly description: string;

  /** Maximum budget the client is willing to pay in USDC. */
  readonly budget_usdc: number;

  /** Preferred delivery content format. */
  readonly delivery_format?: DeliveryFormat;

  /** Deadline for delivery (ISO 8601). */
  readonly deadline?: ISOTimestamp;
}

/**
 * Service request message sent by a Client to a Provider via `POST /ivxp/request`.
 */
export interface ServiceRequest {
  /** Protocol version identifier. */
  readonly protocol: ProtocolVersion;

  /** Message type discriminator. */
  readonly message_type: "service_request";

  /** Timestamp of the request (ISO 8601). */
  readonly timestamp: ISOTimestamp;

  /** Client agent identification. */
  readonly client_agent: ClientAgent;

  /** Service request details. */
  readonly service_request: ServiceRequestDetails;
}
