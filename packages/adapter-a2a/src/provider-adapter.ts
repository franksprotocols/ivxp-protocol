/**
 * IVXPA2AProviderAdapter -- Wraps IVXPProvider for use within the A2A framework.
 *
 * Implements the IVXPProviderAdapter interface from @ivxp/sdk, delegating
 * each method to the underlying IVXPProvider while adding A2A-specific
 * nonce uniqueness and timestamp freshness checks on delivery requests.
 *
 * Wire-format responses from IVXPProvider are parsed through Zod schemas
 * to produce the camelCase output types required by the adapter interface.
 */

import {
  IVXPProvider,
  IVXPError,
  type IVXPProviderAdapter,
  type IVXPProviderConfig,
  type ServiceCatalogOutput,
  type ServiceQuoteOutput,
  type OrderStatusResponseOutput,
  type DeliveryResponseOutput,
} from "@ivxp/sdk";
import type {
  ServiceRequestOutput,
  DeliveryRequestOutput,
  DeliveryAcceptedOutput,
  DeliveryRequest,
  ServiceRequest,
} from "@ivxp/protocol";
import { ServiceCatalogSchema, ServiceQuoteSchema, DeliveryAcceptedSchema } from "@ivxp/protocol";
import type { Artifact } from "@a2a-js/sdk";
import type { A2AAdapterConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed age for delivery request timestamps (300s per NFR6). */
const MAX_TIMESTAMP_AGE_MS = 300_000;

// ---------------------------------------------------------------------------
// Nonce helpers (immutable pattern)
// ---------------------------------------------------------------------------

/**
 * Check whether a nonce has already been seen for a given order.
 */
function isNonceSeen(
  seenNonces: ReadonlyMap<string, ReadonlySet<string>>,
  orderId: string,
  nonce: string,
): boolean {
  const orderNonces = seenNonces.get(orderId);
  return orderNonces !== undefined && orderNonces.has(nonce);
}

/**
 * Register a nonce for an order, returning a new Map (immutable update).
 */
function registerNonce(
  seenNonces: ReadonlyMap<string, ReadonlySet<string>>,
  orderId: string,
  nonce: string,
): Map<string, Set<string>> {
  const updated = new Map<string, Set<string>>();
  for (const [key, value] of seenNonces) {
    updated.set(key, new Set(value));
  }
  const existing = updated.get(orderId) ?? new Set<string>();
  existing.add(nonce);
  updated.set(orderId, existing);
  return updated;
}

// ---------------------------------------------------------------------------
// Wire-format conversion helpers
// ---------------------------------------------------------------------------

/**
 * Convert camelCase ServiceRequestOutput to wire-format ServiceRequest.
 */
function toWireServiceRequest(body: ServiceRequestOutput): ServiceRequest {
  return {
    protocol: body.protocol,
    message_type: "service_request",
    timestamp: body.timestamp,
    client_agent: {
      name: body.clientAgent.name,
      wallet_address: body.clientAgent.walletAddress,
      contact_endpoint: body.clientAgent.contactEndpoint,
    },
    service_request: {
      type: body.serviceRequest.type,
      description: body.serviceRequest.description,
      budget_usdc: body.serviceRequest.budgetUsdc,
      delivery_format: body.serviceRequest.deliveryFormat,
      deadline: body.serviceRequest.deadline,
    },
  };
}

/**
 * Convert camelCase DeliveryRequestOutput to wire-format DeliveryRequest.
 */
function toWireDeliveryRequest(body: DeliveryRequestOutput): DeliveryRequest {
  return {
    protocol: body.protocol,
    message_type: "delivery_request",
    timestamp: body.timestamp,
    order_id: body.orderId,
    payment_proof: {
      tx_hash: body.paymentProof.txHash,
      from_address: body.paymentProof.fromAddress,
      network: body.paymentProof.network,
      ...(body.paymentProof.toAddress !== undefined && {
        to_address: body.paymentProof.toAddress,
      }),
      ...(body.paymentProof.amountUsdc !== undefined && {
        amount_usdc: body.paymentProof.amountUsdc,
      }),
      ...(body.paymentProof.blockNumber !== undefined && {
        block_number: body.paymentProof.blockNumber,
      }),
    },
    delivery_endpoint: body.deliveryEndpoint,
    signature: body.signature,
    signed_message: body.signedMessage,
  };
}

/**
 * Extract nonce from a canonical IVXP-DELIVER signed message.
 * Format: "IVXP-DELIVER | Order: ... | Payment: ... | Nonce: <nonce> | Timestamp: ..."
 */
function extractNonce(signedMessage: string): string | undefined {
  const match = /Nonce:\s*(\S+)/.exec(signedMessage);
  return match?.[1];
}

/**
 * Extract timestamp from a canonical IVXP-DELIVER signed message.
 */
function extractTimestamp(signedMessage: string): string | undefined {
  const match = /Timestamp:\s*(\S+)/.exec(signedMessage);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// IVXPA2AProviderAdapter
// ---------------------------------------------------------------------------

/** IVXP Provider Adapter for the Google A2A framework. */
export class IVXPA2AProviderAdapter implements IVXPProviderAdapter {
  private readonly provider: IVXPProvider;
  private readonly providerName: string;
  /**
   * Per-order nonce tracking for replay prevention (NFR6).
   *
   * IMPORTANT: Always update via `registerNonce()` which returns a new Map.
   * Never mutate the inner Sets directly — the immutable-update pattern
   * ensures nonces are only recorded after all checks pass.
   */
  private seenNonces: ReadonlyMap<string, ReadonlySet<string>>;

  constructor(config: A2AAdapterConfig, providerConfig: IVXPProviderConfig) {
    this.provider = new IVXPProvider(providerConfig);
    this.providerName = config.providerName ?? "a2a-provider";
    this.seenNonces = new Map();
  }

  // -- handleCatalog --------------------------------------------------------

  async handleCatalog(): Promise<ServiceCatalogOutput> {
    const wireCatalog = await this.provider.getCatalog();
    return ServiceCatalogSchema.parse(wireCatalog);
  }

  // -- handleRequest --------------------------------------------------------

  async handleRequest(body: ServiceRequestOutput): Promise<ServiceQuoteOutput> {
    const wireRequest = toWireServiceRequest(body);
    const wireQuote = await this.provider.handleQuoteRequest(wireRequest);
    return ServiceQuoteSchema.parse(wireQuote);
  }

  // -- handleDeliver --------------------------------------------------------

  async handleDeliver(body: DeliveryRequestOutput): Promise<DeliveryAcceptedOutput> {
    const nonce = extractNonce(body.signedMessage);
    const timestamp = extractTimestamp(body.signedMessage);

    // NFR6: timestamp is mandatory — missing means malformed signed_message
    if (!timestamp) {
      throw new Error("Missing timestamp in signed message: cannot verify freshness");
    }

    // NFR6: timestamp freshness check (must be first)
    const requestTime = new Date(timestamp).getTime();
    if (Number.isNaN(requestTime)) {
      throw new Error(`Invalid timestamp in signed message: ${timestamp}`);
    }
    const age = Math.abs(Date.now() - requestTime);
    if (age > MAX_TIMESTAMP_AGE_MS) {
      throw new Error(`Timestamp too old or too far in future: ${timestamp}`);
    }

    // NFR6: nonce is mandatory — missing means malformed signed_message
    if (!nonce) {
      throw new Error("Missing nonce in signed message: cannot verify uniqueness");
    }

    // NFR6: nonce uniqueness check
    if (isNonceSeen(this.seenNonces, body.orderId, nonce)) {
      throw new Error(`Duplicate nonce for order ${body.orderId}: ${nonce}`);
    }

    // NFR5: all 6 on-chain checks -- delegated to IVXPProvider
    const wireRequest = toWireDeliveryRequest(body);
    const wireAccepted = await this.provider.handleDeliveryRequest(wireRequest);

    // Record nonce only after all checks pass (immutable update)
    this.seenNonces = registerNonce(this.seenNonces, body.orderId, nonce);

    return DeliveryAcceptedSchema.parse(wireAccepted);
  }

  // -- handleStatus ---------------------------------------------------------

  async handleStatus(orderId: string): Promise<OrderStatusResponseOutput> {
    const order = await this.provider.getOrder(orderId);
    if (!order) {
      throw new IVXPError(`Order not found: ${orderId}`, "ORDER_NOT_FOUND", {
        orderId,
      });
    }

    const priceUsdc = parseFloat(order.priceUsdc);
    if (Number.isNaN(priceUsdc)) {
      throw new IVXPError(
        `Invalid price for order ${orderId}: ${order.priceUsdc}`,
        "INVALID_REQUEST",
        { orderId, priceUsdc: order.priceUsdc },
      );
    }

    return {
      orderId: order.orderId,
      status: order.status as OrderStatusResponseOutput["status"],
      createdAt: order.createdAt,
      serviceType: order.serviceType,
      priceUsdc,
    };
  }

  // -- handleDownload -------------------------------------------------------

  async handleDownload(orderId: string): Promise<DeliveryResponseOutput> {
    const wireDownload = await this.provider.handleDownloadRequest(orderId);
    const walletAddress = await this.provider.getAddress();

    return {
      protocol: "IVXP/1.0",
      messageType: "service_delivery",
      timestamp: new Date().toISOString(),
      orderId: wireDownload.order_id,
      status: "completed",
      providerAgent: {
        name: this.providerName,
        walletAddress,
      },
      deliverable: {
        type: wireDownload.content_type,
        format: undefined,
        content: wireDownload.content,
      },
      contentHash: wireDownload.content_hash,
      deliveredAt: undefined,
      signature: undefined,
      signedMessage: undefined,
    };
  }

  // -- A2A Artifact helper --------------------------------------------------

  /**
   * Download a deliverable and return both the DeliveryResponseOutput
   * and a standalone A2A Artifact with content_hash in metadata (FR22).
   */
  async handleDownloadWithArtifact(orderId: string): Promise<{
    readonly response: DeliveryResponseOutput;
    readonly artifact: Artifact;
  }> {
    const response = await this.handleDownload(orderId);

    const artifact: Artifact = {
      artifactId: `ivxp-deliverable-${orderId}`,
      name: `ivxp-deliverable-${orderId}`,
      parts: [
        {
          kind: "text",
          text:
            typeof response.deliverable.content === "string"
              ? response.deliverable.content
              : String(response.deliverable.content),
        },
      ],
      metadata: { content_hash: response.contentHash },
    };

    return { response, artifact };
  }
}
