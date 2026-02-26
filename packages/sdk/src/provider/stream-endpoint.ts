/**
 * SSE stream endpoint utilities for IVXP providers.
 *
 * Provides the building blocks for implementing `GET /ivxp/stream/{order_id}`:
 * - `formatSSEEvent` — formats a single SSE event as a wire-format string
 * - `SSEOrderEmitter` — per-provider event bus for pushing order events
 * - `createSSEStream` — creates a ReadableStream of SSE-formatted chunks
 *
 * @see Story v3-1-3 — Implement Provider SSE Endpoint
 */

import { EventEmitter } from "../core/events.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** SSE event types supported by the IVXP protocol. */
export type SSEEventType = "status_update" | "progress" | "completed" | "failed";

/** A single SSE order event. */
export interface SSEOrderEvent {
  readonly type: SSEEventType;
  readonly data: Record<string, unknown>;
}

/** Internal event map for SSEOrderEmitter. */
type SSEOrderEventMap = Record<string, SSEOrderEvent>;

// ---------------------------------------------------------------------------
// formatSSEEvent
// ---------------------------------------------------------------------------

/**
 * Format a single SSE event as a wire-format string chunk.
 *
 * Output follows the SSE specification:
 * ```
 * event: <type>\n
 * data: <json>\n
 * \n
 * ```
 */
export function formatSSEEvent(type: SSEEventType, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// SSEOrderEmitter
// ---------------------------------------------------------------------------

/**
 * Per-provider emitter for pushing SSE events to active order streams.
 *
 * One instance is shared across the deliver handler and the stream route.
 * The deliver handler calls `push()` when order status transitions occur;
 * the stream route subscribes via `subscribe()` to forward events to clients.
 */
export class SSEOrderEmitter {
  private readonly emitter = new EventEmitter<SSEOrderEventMap>();
  private readonly subscriberCounts = new Map<string, number>();

  /**
   * Push an event to all subscribers for a given order.
   */
  push(orderId: string, event: SSEOrderEvent): void {
    this.emitter.emit(`order:${orderId}`, event);
  }

  /**
   * Subscribe to events for a specific order.
   *
   * @returns An unsubscribe function that removes the listener.
   */
  subscribe(orderId: string, listener: (event: SSEOrderEvent) => void): () => void {
    const channel = `order:${orderId}`;
    const previousCount = this.subscriberCounts.get(orderId) ?? 0;
    this.subscriberCounts.set(orderId, previousCount + 1);
    this.emitter.on(channel, listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.emitter.off(channel, listener);
      const currentCount = this.subscriberCounts.get(orderId) ?? 0;
      if (currentCount <= 1) {
        this.subscriberCounts.delete(orderId);
      } else {
        this.subscriberCounts.set(orderId, currentCount - 1);
      }
    };
  }

  /**
   * Get active subscriber count for a specific order stream.
   */
  getSubscriberCount(orderId: string): number {
    return this.subscriberCounts.get(orderId) ?? 0;
  }

  /**
   * Whether the order stream currently has any active subscribers.
   */
  hasSubscribers(orderId: string): boolean {
    return this.getSubscriberCount(orderId) > 0;
  }
}

// ---------------------------------------------------------------------------
// createSSEStream
// ---------------------------------------------------------------------------

/**
 * Create a ReadableStream that emits SSE-formatted chunks for an order.
 *
 * The stream stays open until the client disconnects or a terminal event
 * (`completed` / `failed`) is pushed. An initial keep-alive comment is
 * sent immediately on connect to establish the connection.
 *
 * @param orderId - The order to subscribe to
 * @param emitter - The shared SSEOrderEmitter instance
 */
export function createSSEStream(
  orderId: string,
  emitter: SSEOrderEmitter,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  return new ReadableStream({
    start(controller) {
      // Send initial keep-alive comment to establish the connection
      controller.enqueue(encoder.encode(": connected\n\n"));

      unsubscribe = emitter.subscribe(orderId, (event) => {
        const chunk = formatSSEEvent(event.type, event.data);
        controller.enqueue(encoder.encode(chunk));

        // Close stream on terminal events
        if (event.type === "completed" || event.type === "failed") {
          unsubscribe?.();
          unsubscribe = undefined;
          controller.close();
        }
      });
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = undefined;
    },
  });
}
