/**
 * IEventEmitter — Interface for type-safe SDK event handling.
 *
 * Provides a typed event system for SDK lifecycle events such as
 * order state changes and payment confirmations. Uses discriminated
 * union types for compile-time event payload safety.
 *
 * Designed for dependency injection: SDK consumers can provide their own
 * implementation or use the built-in one.
 */

/**
 * Discriminated union of all SDK events.
 *
 * Each event has a `type` discriminator and a typed `payload`.
 */
export type SDKEvent =
  | {
      readonly type: "catalog.received";
      readonly payload: { readonly provider: string; readonly servicesCount: number };
    }
  | {
      readonly type: "order.quoted";
      readonly payload: { readonly orderId: string; readonly priceUsdc: string };
    }
  | {
      readonly type: "order.paid";
      readonly payload: { readonly orderId: string; readonly txHash: string };
    }
  | {
      readonly type: "order.delivered";
      readonly payload: {
        readonly orderId: string;
        readonly format: string;
      };
    }
  | {
      readonly type: "payment.sent";
      readonly payload: { readonly txHash: string };
    }
  | {
      /**
       * Reserved for future use. Will be emitted when the SDK implements
       * on-chain payment confirmation watching (transaction receipt polling).
       * Not currently emitted by any IVXPClient method.
       */
      readonly type: "payment.confirmed";
      readonly payload: {
        readonly txHash: string;
        readonly blockNumber?: bigint;
      };
    }
  | {
      readonly type: "order.status_changed";
      readonly payload: {
        readonly orderId: string;
        readonly previousStatus: string | null;
        readonly newStatus: string;
      };
    }
  | {
      readonly type: "order.confirmed";
      readonly payload: {
        readonly orderId: string;
        readonly confirmedAt: string;
      };
    }
  | {
      readonly type: "delivery.received";
      readonly payload: {
        readonly orderId: string;
        readonly contentHash: string;
        readonly format: string;
      };
    }
  | {
      readonly type: "delivery.rejected";
      readonly payload: {
        readonly orderId: string;
        readonly reason: string;
        readonly expectedHash: string;
        readonly computedHash: string;
      };
    }
  | {
      readonly type: "sse_fallback";
      readonly payload: {
        readonly orderId: string;
        readonly reason: string;
      };
    };

/**
 * Maps event type strings to their corresponding payload types.
 *
 * This utility type enables type-safe event handler registration
 * by extracting the payload type from the SDKEvent discriminated union.
 */
export type SDKEventMap = {
  readonly [E in SDKEvent as E["type"]]: E["payload"];
};

/**
 * Type-safe event emitter interface for SDK events.
 *
 * Responsibilities:
 * - Subscribe to typed SDK events
 * - Unsubscribe from events
 * - Emit events with type-checked payloads
 */
export interface IEventEmitter {
  /**
   * Subscribe to an SDK event.
   *
   * @typeParam T - Event type string literal
   * @param event - The event type to listen for
   * @param handler - Callback invoked with the event's typed payload
   */
  on<T extends SDKEvent["type"]>(event: T, handler: (payload: SDKEventMap[T]) => void): void;

  /**
   * Unsubscribe from an SDK event.
   *
   * @typeParam T - Event type string literal
   * @param event - The event type to stop listening for
   * @param handler - The previously registered handler to remove
   */
  off<T extends SDKEvent["type"]>(event: T, handler: (payload: SDKEventMap[T]) => void): void;

  /**
   * Emit an SDK event with a typed payload.
   *
   * @typeParam T - Event type string literal
   * @param event - The event type to emit
   * @param payload - The event payload (must match the event type)
   */
  emit<T extends SDKEvent["type"]>(event: T, payload: SDKEventMap[T]): void;
}
