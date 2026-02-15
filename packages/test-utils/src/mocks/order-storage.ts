/**
 * MockOrderStorage -- Test implementation of IOrderStorage.
 *
 * Provides an in-memory order storage for tests.
 * Records all calls for assertion checking.
 */

import type { IOrderStorage, OrderFilters, OrderUpdates, StoredOrder } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Call record types
// ---------------------------------------------------------------------------

/**
 * Recorded arguments from a create() call.
 */
export interface CreateOrderCall {
  readonly order: Omit<StoredOrder, "createdAt" | "updatedAt">;
}

/**
 * Recorded arguments from a get() call.
 */
export interface GetOrderCall {
  readonly orderId: string;
}

/**
 * Recorded arguments from an update() call.
 */
export interface UpdateOrderCall {
  readonly orderId: string;
  readonly updates: OrderUpdates;
}

/**
 * Recorded arguments from a list() call.
 */
export interface ListOrdersCall {
  readonly filters?: OrderFilters;
}

/**
 * Recorded arguments from a delete() call.
 */
export interface DeleteOrderCall {
  readonly orderId: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for MockOrderStorage.
 */
export interface MockOrderStorageConfig {
  /** If set, create() will reject with this error. */
  readonly createError?: Error;
  /** If set, get() will reject with this error. */
  readonly getError?: Error;
  /** If set, update() will reject with this error. */
  readonly updateError?: Error;
  /** If set, list() will reject with this error. */
  readonly listError?: Error;
  /** If set, delete() will reject with this error. */
  readonly deleteError?: Error;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Mock implementation of IOrderStorage for testing.
 *
 * Features:
 * - In-memory storage with full CRUD
 * - Configurable error injection
 * - Call recording for assertion checking
 * - Filter support for list()
 */
export class MockOrderStorage implements IOrderStorage {
  private readonly config: MockOrderStorageConfig;

  // Mutable internal state: mocks need mutable fields for in-memory storage
  // and call recording. This is intentional -- immutability applies to domain
  // objects, not test infrastructure.
  private readonly store: Map<string, StoredOrder> = new Map();
  private createCalls: CreateOrderCall[] = [];
  private getCalls: GetOrderCall[] = [];
  private updateCalls: UpdateOrderCall[] = [];
  private listCalls: ListOrdersCall[] = [];
  private deleteCalls: DeleteOrderCall[] = [];

  constructor(config: MockOrderStorageConfig = {}) {
    this.config = config;
  }

  async create(order: Omit<StoredOrder, "createdAt" | "updatedAt">): Promise<StoredOrder> {
    this.createCalls.push({ order });

    if (this.config.createError) {
      throw this.config.createError;
    }

    if (this.store.has(order.orderId)) {
      throw new Error(`Order already exists: ${order.orderId}`);
    }

    const uuidPattern = /^ivxp-[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    if (!uuidPattern.test(order.orderId)) {
      throw new Error(`Invalid order ID format: ${order.orderId}. Expected: ivxp-{uuid-v4}`);
    }

    const now = new Date().toISOString();
    const storedOrder: StoredOrder = {
      ...order,
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(order.orderId, storedOrder);
    return storedOrder;
  }

  async get(orderId: string): Promise<StoredOrder | null> {
    this.getCalls.push({ orderId });

    if (this.config.getError) {
      throw this.config.getError;
    }

    return this.store.get(orderId) ?? null;
  }

  async update(orderId: string, updates: OrderUpdates): Promise<StoredOrder> {
    this.updateCalls.push({ orderId, updates });

    if (this.config.updateError) {
      throw this.config.updateError;
    }

    const existing = this.store.get(orderId);
    if (!existing) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const updatedOrder: StoredOrder = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(orderId, updatedOrder);
    return updatedOrder;
  }

  async list(filters?: OrderFilters): Promise<readonly StoredOrder[]> {
    this.listCalls.push({ filters });

    if (this.config.listError) {
      throw this.config.listError;
    }

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
    const limit = filters?.limit ?? 100;

    return results.slice(offset, offset + limit);
  }

  async delete(orderId: string): Promise<void> {
    this.deleteCalls.push({ orderId });

    if (this.config.deleteError) {
      throw this.config.deleteError;
    }

    this.store.delete(orderId);
  }

  // -----------------------------------------------------------------------
  // Test helpers
  // -----------------------------------------------------------------------

  /** Seed storage with pre-existing orders for test setup. */
  seed(orders: readonly StoredOrder[]): void {
    for (const order of orders) {
      this.store.set(order.orderId, order);
    }
  }

  /** Get the current size of the in-memory store. */
  size(): number {
    return this.store.size;
  }

  /** Clear all stored orders (does not reset call records). */
  clearStore(): void {
    this.store.clear();
  }

  /** Get all recorded create() calls. */
  getCreateCalls(): readonly CreateOrderCall[] {
    return [...this.createCalls];
  }

  /** Get all recorded get() calls. */
  getGetCalls(): readonly GetOrderCall[] {
    return [...this.getCalls];
  }

  /** Get all recorded update() calls. */
  getUpdateCalls(): readonly UpdateOrderCall[] {
    return [...this.updateCalls];
  }

  /** Get all recorded list() calls. */
  getListCalls(): readonly ListOrdersCall[] {
    return [...this.listCalls];
  }

  /** Get all recorded delete() calls. */
  getDeleteCalls(): readonly DeleteOrderCall[] {
    return [...this.deleteCalls];
  }

  /** Reset all recorded calls (does not clear the store). */
  resetCalls(): void {
    this.createCalls = [];
    this.getCalls = [];
    this.updateCalls = [];
    this.listCalls = [];
    this.deleteCalls = [];
  }

  /** Full reset: clears store and all call records. */
  reset(): void {
    this.clearStore();
    this.resetCalls();
  }
}
