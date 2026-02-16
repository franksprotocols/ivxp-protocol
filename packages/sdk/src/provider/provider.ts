/**
 * IVXPProvider push delivery integration.
 *
 * Provides the `handleOrderDelivery` function that encapsulates the
 * complete delivery flow: push delivery attempt with retry and fallback
 * to Store & Forward mode.
 *
 * Designed as a standalone module that the IVXPProvider class (Story 3.14)
 * will integrate into its post-processing pipeline.
 *
 * Events emitted:
 * - `delivery.push.started`      -- Push delivery initiated
 * - `delivery.push.success`      -- Push delivery succeeded
 * - `delivery.push.failed`       -- Push delivery failed, fallback to S&F
 * - `delivery.store_and_forward` -- No endpoint provided, using S&F directly
 *
 * @see Story 3.12 - FR-P8: Push Delivery
 */

import type { EventEmitter } from "../core/events.js";
import {
  pushDelivery,
  shouldAttemptPush,
  buildDeliveryPayload,
  type PushDeliveryOptions,
  type PushDeliveryResult,
} from "./push-delivery.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Event map for provider delivery events.
 *
 * Will be merged into the full provider event map when IVXPProvider
 * is implemented (Story 3.14).
 */
export type ProviderDeliveryEventMap = {
  readonly "delivery.push.started": {
    readonly orderId: string;
    readonly endpoint: string;
  };
  readonly "delivery.push.success": {
    readonly orderId: string;
    readonly attempts: number;
  };
  readonly "delivery.push.failed": {
    readonly orderId: string;
    readonly attempts: number;
    readonly error: string;
    readonly fallback: "store_and_forward";
  };
  readonly "delivery.store_and_forward": {
    readonly orderId: string;
    readonly reason: "no_endpoint";
  };
};

/**
 * Order data required for delivery processing.
 */
export interface DeliverableOrder {
  /** Unique order identifier. */
  readonly orderId: string;

  /** Deliverable content. */
  readonly content: string;

  /** SHA-256 hash of the content. */
  readonly contentHash: string;

  /** Content format (e.g. "markdown", "json"). */
  readonly format: string;

  /** Optional client callback URL for push delivery. */
  readonly deliveryEndpoint?: string;
}

/**
 * Configuration for order delivery handling.
 */
export interface DeliveryHandlerConfig {
  /** Maximum retry attempts for push delivery (default: 3). */
  readonly maxRetries?: number;

  /** Initial retry delay in milliseconds (default: 1000). */
  readonly initialDelayMs?: number;

  /** Per-attempt timeout in milliseconds (default: 10000). */
  readonly timeoutMs?: number;
}

/**
 * Result of order delivery handling.
 *
 * Indicates the delivery method used and the resulting order status.
 */
export interface DeliveryHandlerResult {
  /** Resulting order status after delivery attempt. */
  readonly status: "delivered" | "delivery_failed";

  /** The delivery method used. */
  readonly method: "push" | "store_and_forward";

  /** Number of push attempts (0 if Store & Forward only). */
  readonly attempts: number;

  /** Error message if delivery failed (undefined on success). */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// handleOrderDelivery
// ---------------------------------------------------------------------------

/**
 * Handle the delivery phase of an order.
 *
 * Implements the dual-path delivery strategy:
 * 1. If the client provided a `delivery_endpoint`, attempt push delivery
 *    with exponential backoff retry.
 * 2. If push delivery fails or no endpoint was provided, fall back to
 *    Store & Forward mode (deliverable remains downloadable).
 *
 * Emits delivery events via the provided event emitter for observability.
 *
 * @param order - The order with deliverable data
 * @param config - Optional delivery configuration
 * @param emitter - Optional event emitter for delivery events
 * @returns Delivery result with status and method used
 */
export async function handleOrderDelivery(
  order: DeliverableOrder,
  config?: DeliveryHandlerConfig,
  emitter?: EventEmitter<ProviderDeliveryEventMap>,
): Promise<DeliveryHandlerResult> {
  // AC4: No delivery endpoint -- skip push, use Store & Forward
  if (!shouldAttemptPush(order.deliveryEndpoint)) {
    emitter?.emit("delivery.store_and_forward", {
      orderId: order.orderId,
      reason: "no_endpoint",
    });

    return {
      status: "delivered",
      method: "store_and_forward",
      attempts: 0,
    };
  }

  const deliveryEndpoint = order.deliveryEndpoint as string;

  // Emit push started event
  emitter?.emit("delivery.push.started", {
    orderId: order.orderId,
    endpoint: deliveryEndpoint,
  });

  // Build the wire-format payload
  const payload = buildDeliveryPayload({
    orderId: order.orderId,
    content: order.content,
    contentHash: order.contentHash,
    format: order.format,
  });

  // Attempt push delivery with retry
  const pushOptions: PushDeliveryOptions = {
    deliveryEndpoint,
    maxRetries: config?.maxRetries,
    initialDelayMs: config?.initialDelayMs,
    timeoutMs: config?.timeoutMs,
  };

  const result: PushDeliveryResult = await pushDelivery(payload, pushOptions);

  if (result.success) {
    // AC1: Push delivery succeeded
    emitter?.emit("delivery.push.success", {
      orderId: order.orderId,
      attempts: result.attempts,
    });

    return {
      status: "delivered",
      method: "push",
      attempts: result.attempts,
    };
  }

  // AC3: Push delivery failed -- fallback to Store & Forward
  // The deliverable is still accessible via download endpoint.
  // Status is "delivery_failed" per protocol state machine,
  // method is "store_and_forward" since that's the active delivery path.
  const errorMessage = result.error ?? "Push delivery failed after all retries";

  emitter?.emit("delivery.push.failed", {
    orderId: order.orderId,
    attempts: result.attempts,
    error: errorMessage,
    fallback: "store_and_forward",
  });

  return {
    status: "delivery_failed",
    method: "store_and_forward",
    attempts: result.attempts,
    error: errorMessage,
  };
}
