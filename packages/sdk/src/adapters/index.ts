/**
 * Adapter interfaces for framework-specific IVXP integrations.
 *
 * These interfaces define the contract for implementing IVXP client and
 * provider capabilities within different frameworks (e.g., Express, Fastify,
 * Next.js, Hono, etc.).
 *
 * @module adapters
 */

import type {
  ServiceCatalogOutput,
  ServiceQuoteOutput,
  DeliveryAcceptedOutput,
  DeliveryResponseOutput,
  OrderStatusResponseOutput,
  ServiceRequestOutput,
  DeliveryRequestOutput,
  PaymentProofOutput,
  HexSignature,
} from "@ivxp/protocol";
import type { ServiceRequestParams, DownloadOptions } from "../core/types.js";

// ---------------------------------------------------------------------------
// IVXPClientAdapter
// ---------------------------------------------------------------------------

/**
 * Contract for framework-specific IVXP client adapters.
 *
 * Implement this interface to integrate IVXP client capabilities into
 * a framework (e.g., Express middleware, Next.js API route helper).
 * Each method maps 1:1 to a step in the IVXP/1.0 client flow.
 *
 * @example
 * ```typescript
 * class MyFrameworkClientAdapter implements IVXPClientAdapter {
 *   async getCatalog(providerUrl: string) { ... }
 *   async requestQuote(providerUrl: string, params: ServiceRequestParams) { ... }
 *   async requestDelivery(providerUrl: string, orderId: string, paymentProof: PaymentProofOutput, signature: HexSignature, signedMessage: string) { ... }
 *   async getStatus(providerUrl: string, orderId: string) { ... }
 *   async download(providerUrl: string, orderId: string, options?: DownloadOptions) { ... }
 * }
 * ```
 */
export interface IVXPClientAdapter {
  /**
   * Fetch the provider's service catalog.
   * Maps to GET /ivxp/catalog.
   */
  getCatalog(providerUrl: string): Promise<ServiceCatalogOutput>;

  /**
   * Request a service quote from the provider.
   * Maps to POST /ivxp/request.
   */
  requestQuote(providerUrl: string, params: ServiceRequestParams): Promise<ServiceQuoteOutput>;

  /**
   * Notify the provider of payment and request delivery.
   * Maps to POST /ivxp/deliver.
   */
  requestDelivery(
    providerUrl: string,
    orderId: string,
    paymentProof: PaymentProofOutput,
    signature: HexSignature,
    signedMessage: string,
  ): Promise<DeliveryAcceptedOutput>;

  /**
   * Poll the current status of an order.
   * Maps to GET /ivxp/status/:orderId.
   */
  getStatus(providerUrl: string, orderId: string): Promise<OrderStatusResponseOutput>;

  /**
   * Download the completed deliverable.
   * Maps to GET /ivxp/download/:orderId.
   */
  download(
    providerUrl: string,
    orderId: string,
    options?: DownloadOptions,
  ): Promise<DeliveryResponseOutput>;
}

// ---------------------------------------------------------------------------
// IVXPProviderAdapter
// ---------------------------------------------------------------------------

/**
 * Contract for framework-specific IVXP provider adapters.
 *
 * Implement this interface to expose IVXP provider endpoints within
 * a framework (e.g., Fastify plugin, Hono middleware).
 * Each method maps 1:1 to an IVXP/1.0 provider endpoint.
 *
 * @example
 * ```typescript
 * class MyFrameworkProviderAdapter implements IVXPProviderAdapter {
 *   async handleCatalog() { ... }
 *   async handleRequest(body: ServiceRequestOutput) { ... }
 *   async handleDeliver(body: DeliveryRequestOutput) { ... }
 *   async handleStatus(orderId: string) { ... }
 *   async handleDownload(orderId: string) { ... }
 * }
 * ```
 */
export interface IVXPProviderAdapter {
  /**
   * Handle GET /ivxp/catalog — return the provider's service catalog.
   */
  handleCatalog(): Promise<ServiceCatalogOutput>;

  /**
   * Handle POST /ivxp/request — accept or reject a service request.
   */
  handleRequest(body: ServiceRequestOutput): Promise<ServiceQuoteOutput>;

  /**
   * Handle POST /ivxp/deliver — verify payment and begin delivery.
   */
  handleDeliver(body: DeliveryRequestOutput): Promise<DeliveryAcceptedOutput>;

  /**
   * Handle GET /ivxp/status/:orderId — return current order status.
   */
  handleStatus(orderId: string): Promise<OrderStatusResponseOutput>;

  /**
   * Handle GET /ivxp/download/:orderId — stream or return the deliverable.
   */
  handleDownload(orderId: string): Promise<DeliveryResponseOutput>;
}
