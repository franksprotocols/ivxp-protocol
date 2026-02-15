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

import type { DeliveryFormat } from "@ivxp/protocol";

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
