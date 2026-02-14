/**
 * IOrderStorage -- Interface for order persistence operations.
 *
 * Provides CRUD operations for managing orders in the provider's storage.
 * Supports filtering, pagination, and partial updates.
 *
 * Designed for dependency injection: implementations can use SQLite,
 * PostgreSQL, in-memory storage, or any other backend.
 */

import type { OrderStatus } from "../types/order.js";

/**
 * Internal order representation for storage.
 *
 * Named `StoredOrder` to distinguish from the wire protocol order types
 * (which use snake_case). Uses camelCase per internal SDK convention.
 * Conversion between formats must happen at the API boundary.
 */
export interface StoredOrder {
  /** Unique order identifier. Must match format: `ivxp-{uuid-v4}`. */
  readonly orderId: string;

  /** Current order lifecycle status. */
  readonly status: OrderStatus;

  /** Client wallet address. */
  readonly clientAddress: `0x${string}`;

  /** Service type requested. */
  readonly serviceType: string;

  /** Quoted price in USDC (string for precision). */
  readonly priceUsdc: string;

  /** Payment destination address. */
  readonly paymentAddress: `0x${string}`;

  /** Blockchain network for payment. */
  readonly network: string;

  /** Order creation timestamp (ISO 8601). */
  readonly createdAt: string;

  /** Last update timestamp (ISO 8601). */
  readonly updatedAt: string;

  /** Payment transaction hash (set after payment). */
  readonly txHash?: `0x${string}`;

  /** Client's delivery endpoint for P2P push. */
  readonly deliveryEndpoint?: string;

  /** Content hash of the deliverable (set after delivery). */
  readonly contentHash?: string;
}

/**
 * Fields that may be modified after order creation.
 *
 * Immutable fields (`orderId`, `clientAddress`, `serviceType`, `priceUsdc`,
 * `paymentAddress`, `network`, `createdAt`) are excluded. The `updatedAt`
 * field is managed by the storage implementation and excluded here.
 */
export type OrderUpdates = Partial<
  Pick<
    StoredOrder,
    "status" | "txHash" | "deliveryEndpoint" | "contentHash"
  >
>;

/**
 * Filters for querying orders.
 */
export interface OrderFilters {
  /** Filter by order status. */
  readonly status?: OrderStatus;

  /** Filter by client wallet address. */
  readonly clientAddress?: `0x${string}`;

  /** Filter by service type. */
  readonly serviceType?: string;

  /**
   * Maximum number of results to return.
   * Must be greater than 0. Implementations should apply a sensible
   * default when omitted (recommended: 100).
   */
  readonly limit?: number;

  /**
   * Number of results to skip for pagination.
   * Must be greater than or equal to 0. Defaults to 0 when omitted.
   */
  readonly offset?: number;
}

/**
 * Storage interface for order persistence.
 *
 * Responsibilities:
 * - Create new orders
 * - Retrieve orders by ID
 * - Update order fields (partial updates of mutable fields only)
 * - List orders with optional filtering and pagination
 * - Delete orders
 */
export interface IOrderStorage {
  /**
   * Create a new order in storage.
   *
   * The `createdAt` and `updatedAt` fields are set automatically
   * by the storage implementation.
   *
   * **Validation**: Implementations must validate that `orderId` matches
   * the format `ivxp-{uuid-v4}` (e.g. `ivxp-550e8400-e29b-41d4-a716-446655440000`)
   * and reject with an error if the format is invalid.
   *
   * @param order - Order data without timestamp fields
   * @returns The created order with all fields populated
   * @throws If orderId format is invalid or order already exists
   */
  create(
    order: Omit<StoredOrder, "createdAt" | "updatedAt">,
  ): Promise<StoredOrder>;

  /**
   * Retrieve an order by its ID.
   *
   * @param orderId - The order identifier to look up
   * @returns The order if found, or null if not found
   */
  get(orderId: string): Promise<StoredOrder | null>;

  /**
   * Update an existing order with partial data.
   *
   * Only mutable fields can be updated: `status`, `txHash`,
   * `deliveryEndpoint`, and `contentHash`. The `updatedAt` field
   * is set automatically by the storage implementation.
   *
   * @param orderId - The order identifier to update
   * @param updates - Mutable order fields to update
   * @returns The updated order with all fields
   * @throws If order is not found
   */
  update(orderId: string, updates: OrderUpdates): Promise<StoredOrder>;

  /**
   * List orders with optional filtering and pagination.
   *
   * @param filters - Optional query filters
   * @returns Array of orders matching the filters
   */
  list(filters?: OrderFilters): Promise<readonly StoredOrder[]>;

  /**
   * Delete an order by its ID.
   *
   * @param orderId - The order identifier to delete
   */
  delete(orderId: string): Promise<void>;
}
