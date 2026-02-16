/**
 * EventEmitter -- Lightweight, type-safe event emitter for the IVXP SDK.
 *
 * Provides a generic `EventEmitter<Events>` class that supports:
 * - Type-safe event subscription via `on()`
 * - Type-safe event unsubscription via `off()`
 * - Type-safe event emission via `emit()`
 * - Bulk listener removal via `removeAllListeners()`
 *
 * Handler errors are caught and logged via `console.error` to prevent
 * one misbehaving observer from disrupting the emitting code path or
 * other registered handlers.
 *
 * All operations use immutable array patterns (filter, spread) to
 * avoid in-place mutation of the handler list.
 *
 * Also re-exports SDK event types from `@ivxp/protocol` for convenience,
 * so consumers can import both `EventEmitter` and event types from
 * a single module.
 *
 * No external dependencies beyond `@ivxp/protocol` types.
 */

// Re-export SDK event types from the protocol package.
// This allows SDK consumers to import event types alongside EventEmitter.
export type { SDKEvent, SDKEventMap } from "@ivxp/protocol";

/**
 * Union of all SDK event name strings.
 *
 * Derived from `SDKEventMap` so it stays in sync automatically.
 *
 * @example
 * ```typescript
 * const eventName: SDKEventName = "order.paid";
 * ```
 */
export type SDKEventName = keyof import("@ivxp/protocol").SDKEventMap;

/**
 * Extract the payload type for a specific SDK event.
 *
 * @typeParam E - The event name string literal
 *
 * @example
 * ```typescript
 * type Payload = SDKEventPayload<"order.paid">;
 * // => { readonly orderId: string; readonly txHash: string }
 * ```
 */
export type SDKEventPayload<E extends SDKEventName> = import("@ivxp/protocol").SDKEventMap[E];

/**
 * Type alias for event handler functions stored internally.
 *
 * Uses `unknown` as the payload type for the internal handler storage.
 * Type safety is enforced at the public API boundary: `on<T>()` accepts
 * a handler with the correctly-typed payload, and `emit<T>()` passes
 * the correctly-typed payload to each handler.
 *
 * The cast from `(payload: Events[T]) => void` to `EventHandler`
 * is safe because `emit()` only invokes handlers registered for
 * the matching event type key.
 */
type EventHandler = (payload: unknown) => void;

/**
 * Lightweight, type-safe event emitter.
 *
 * @typeParam Events - A record mapping event names to their payload types.
 *
 * @example
 * ```typescript
 * type MyEvents = {
 *   'user.created': { id: string; name: string };
 *   'user.deleted': { id: string };
 * };
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('user.created', ({ id, name }) => console.log(id, name));
 * emitter.emit('user.created', { id: '1', name: 'Alice' });
 * ```
 */
export class EventEmitter<Events extends Record<string, unknown>> {
  /**
   * Event handler registry. Maps event name strings to arrays of handlers.
   * Uses Map for O(1) lookup by event type.
   *
   * Arrays are replaced (not mutated) on every on/off operation to
   * maintain immutability.
   */
  private readonly handlers = new Map<string, Array<EventHandler>>();

  /**
   * Subscribe to an event.
   *
   * Handlers are invoked synchronously in registration order when the
   * corresponding event is emitted.
   *
   * @typeParam T - Event type string literal
   * @param event - The event name to listen for
   * @param handler - Callback invoked with the event's typed payload
   */
  on<T extends keyof Events & string>(event: T, handler: (payload: Events[T]) => void): void {
    const existing = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...existing, handler as EventHandler]);
  }

  /**
   * Unsubscribe from an event.
   *
   * Removes the first occurrence of the handler reference from the
   * listener list for the given event. If the handler was not registered,
   * this is a no-op.
   *
   * When the last handler for an event is removed, the Map entry is
   * deleted to prevent memory leaks.
   *
   * @typeParam T - Event type string literal
   * @param event - The event name to stop listening for
   * @param handler - The previously registered handler to remove
   */
  off<T extends keyof Events & string>(event: T, handler: (payload: Events[T]) => void): void {
    const existing = this.handlers.get(event);
    if (!existing) {
      return;
    }

    const remaining = existing.filter((h) => h !== (handler as EventHandler));

    if (remaining.length === 0) {
      this.handlers.delete(event);
    } else {
      this.handlers.set(event, remaining);
    }
  }

  /**
   * Emit an event with a typed payload.
   *
   * Invokes all registered handlers for the given event type.
   * Handlers are called synchronously in registration order.
   * Each handler is wrapped in try-catch to ensure that a throwing
   * handler does not prevent subsequent handlers from executing
   * and does not propagate to the caller.
   *
   * **Async handlers**: If a handler returns a Promise (i.e. is an
   * async function), the Promise is fire-and-forget. The emitter
   * does NOT await it. Rejections from async handlers will surface
   * as unhandled promise rejections, not through the try-catch
   * below. Callers who need async event handling should manage
   * their own error boundaries inside the handler.
   *
   * @typeParam T - Event type string literal
   * @param event - The event name to emit
   * @param payload - The event payload (must match the event type)
   */
  emit<T extends keyof Events & string>(event: T, payload: Events[T]): void {
    const existing = this.handlers.get(event);
    if (!existing) {
      return;
    }

    for (const handler of existing) {
      try {
        handler(payload);
      } catch (error: unknown) {
        // Log handler errors to aid debugging, but do not propagate
        // them to the emitting code path or other handlers.
        console.error(`Error in event handler for "${event}":`, error);
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events.
   *
   * @param event - Optional event name. If omitted, removes all listeners
   *                for all events.
   */
  removeAllListeners(event?: keyof Events & string): void {
    if (event !== undefined) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}
