/**
 * InMemoryOrderStore -- Default in-memory implementation of IOrderStorage.
 *
 * Stores orders in a Map for the lifetime of the process.
 * Suitable for development, testing, and single-instance providers.
 *
 * For production use with persistence, inject a custom IOrderStorage
 * implementation (e.g. SQLite, PostgreSQL) via the IVXPProviderConfig.
 *
 * @see Story 3.15 - IVXPProvider Quote Endpoint
 */

import type { IOrderStorage, OrderFilters, OrderUpdates, StoredOrder } from "@ivxp/protocol";
import { IVXPError } from "../errors/base.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Regex for validating the ivxp-{uuid-v4} order ID format. */
const ORDER_ID_REGEX = /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Default maximum results per list() query. */
const DEFAULT_LIST_LIMIT = 100;

// ---------------------------------------------------------------------------
// InMemoryOrderStore
// ---------------------------------------------------------------------------

/**
 * In-memory implementation of IOrderStorage.
 *
 * Thread-safe within a single Node.js event loop. Uses optimistic
 * locking via `updatedAt` timestamps to detect concurrent modifications.
 * Not suitable for multi-process deployments without external coordination.
 */
export class InMemoryOrderStore implements IOrderStorage {
  /**
   * Mutable internal state: in-memory storage map.
   *
   * This is an intentional exception to the immutability principle --
   * storage backends are inherently stateful. Domain objects (StoredOrder)
   * remain immutable: updates produce new objects.
   */
  private readonly store: Map<string, StoredOrder> = new Map();

  async create(order: Omit<StoredOrder, "createdAt" | "updatedAt">): Promise<StoredOrder> {
    if (!ORDER_ID_REGEX.test(order.orderId)) {
      throw new IVXPError(
        `Invalid order ID format: ${order.orderId}. Expected: ivxp-{uuid-v4}`,
        "INVALID_ORDER_ID",
        { orderId: order.orderId },
      );
    }

    if (this.store.has(order.orderId)) {
      throw new IVXPError(`Order already exists: ${order.orderId}`, "ORDER_ALREADY_EXISTS", {
        orderId: order.orderId,
      });
    }

    const now = new Date().toISOString();
    const storedOrder: StoredOrder = {
      ...order,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(order.orderId, storedOrder);
    return { ...storedOrder };
  }

  async get(orderId: string): Promise<StoredOrder | null> {
    const order = this.store.get(orderId);
    // Return a shallow copy so callers cannot mutate internal state
    return order ? { ...order } : null;
  }

  /**
   * Update an existing order with partial data.
   *
   * Uses optimistic locking: if `expectedUpdatedAt` is provided in updates,
   * the update only succeeds if the stored order's `updatedAt` matches.
   * This prevents concurrent updates from silently overwriting each other.
   *
   * If `expectedUpdatedAt` is not provided (e.g. in non-concurrent code),
   * the update proceeds unconditionally for backward compatibility.
   */
  async update(
    orderId: string,
    updates: OrderUpdates,
    expectedUpdatedAt?: string,
  ): Promise<StoredOrder> {
    const existing = this.store.get(orderId);
    if (!existing) {
      throw new IVXPError(`Order not found: ${orderId}`, "ORDER_NOT_FOUND", { orderId });
    }

    // Optimistic locking: reject if the stored updatedAt does not match
    if (expectedUpdatedAt !== undefined && existing.updatedAt !== expectedUpdatedAt) {
      throw new IVXPError(
        `Concurrent modification detected for order: ${orderId}`,
        "ORDER_CONCURRENT_MODIFICATION",
        {
          orderId,
          expectedUpdatedAt,
          actualUpdatedAt: existing.updatedAt,
        },
      );
    }

    const updatedOrder: StoredOrder = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(orderId, updatedOrder);
    return { ...updatedOrder };
  }

  async list(filters?: OrderFilters): Promise<readonly StoredOrder[]> {
    let results = [...this.store.values()];

    if (filters?.status) {
      results = results.filter((o) => o.status === filters.status);
    }
    if (filters?.clientAddress) {
      results = results.filter((o) => o.clientAddress === filters.clientAddress);
    }
    if (filters?.serviceType) {
      results = results.filter((o) => o.serviceType === filters.serviceType);
    }

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? DEFAULT_LIST_LIMIT;

    // Return shallow copies so callers cannot mutate internal state
    return results.slice(offset, offset + limit).map((o) => ({ ...o }));
  }

  async delete(orderId: string): Promise<void> {
    this.store.delete(orderId);
  }
}
