/**
 * Deliverable storage types and in-memory implementation.
 *
 * Defines the StoredDeliverable type for persisting service handler results
 * with SHA-256 content hashes for integrity verification.
 *
 * @see Story 3.17 - IVXPProvider Order Processing & Storage
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A stored deliverable produced by a service handler.
 *
 * Immutable after creation. Contains the content, content type,
 * and a SHA-256 hash for integrity verification by clients.
 */
export interface StoredDeliverable {
  /** The order ID this deliverable belongs to. */
  readonly orderId: string;

  /** The deliverable content (string or binary). */
  readonly content: string | Uint8Array;

  /** MIME content type (e.g. "text/plain", "application/json"). */
  readonly contentType: string;

  /** SHA-256 hex-encoded hash of the content. */
  readonly contentHash: string;

  /** ISO 8601 timestamp of when the deliverable was created. */
  readonly createdAt: string;
}

/**
 * Storage interface for deliverable persistence.
 *
 * Provides set/get operations for storing and retrieving deliverables
 * by order ID. Designed for dependency injection.
 */
export interface IDeliverableStore {
  /**
   * Store a deliverable for the given order.
   *
   * @param orderId - The order identifier
   * @param deliverable - The deliverable to store
   */
  set(orderId: string, deliverable: StoredDeliverable): void;

  /**
   * Retrieve a deliverable by order ID.
   *
   * @param orderId - The order identifier
   * @returns The stored deliverable, or undefined if not found
   */
  get(orderId: string): StoredDeliverable | undefined;

  /**
   * Check if a deliverable exists for the given order.
   *
   * @param orderId - The order identifier
   * @returns true if a deliverable exists
   */
  has(orderId: string): boolean;

  /**
   * Delete a deliverable by order ID.
   *
   * @param orderId - The order identifier
   */
  delete(orderId: string): void;
}

// ---------------------------------------------------------------------------
// InMemoryDeliverableStore
// ---------------------------------------------------------------------------

/**
 * In-memory implementation of IDeliverableStore.
 *
 * Stores deliverables in a Map for the lifetime of the process.
 * Suitable for development, testing, and single-instance providers.
 */
export class InMemoryDeliverableStore implements IDeliverableStore {
  /**
   * Mutable internal state: in-memory storage map.
   *
   * This is an intentional exception to the immutability principle --
   * storage backends are inherently stateful. Domain objects (StoredDeliverable)
   * remain immutable.
   */
  private readonly store: Map<string, StoredDeliverable> = new Map();

  set(orderId: string, deliverable: StoredDeliverable): void {
    this.store.set(orderId, deliverable);
  }

  get(orderId: string): StoredDeliverable | undefined {
    const deliverable = this.store.get(orderId);
    if (!deliverable) {
      return undefined;
    }

    // Deep-copy: spread for primitives, clone Uint8Array to avoid shared reference
    return {
      ...deliverable,
      content:
        deliverable.content instanceof Uint8Array
          ? new Uint8Array(deliverable.content)
          : deliverable.content,
    };
  }

  has(orderId: string): boolean {
    return this.store.has(orderId);
  }

  delete(orderId: string): void {
    this.store.delete(orderId);
  }

  /** Get the current size of the in-memory store. */
  size(): number {
    return this.store.size;
  }

  /** Clear all stored deliverables. */
  clear(): void {
    this.store.clear();
  }
}
