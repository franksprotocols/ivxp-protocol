/**
 * SQLite-backed order repository implementing IOrderStorage.
 *
 * Provides CRUD operations, transaction support, and automatic
 * TTL-based cleanup for expired orders.
 *
 * All operations are transaction-safe. Concurrent access is handled
 * via SQLite's WAL mode (configured in db/index.ts).
 */

import type Database from "better-sqlite3";
import type { IOrderStorage, StoredOrder, OrderUpdates, OrderFilters } from "@ivxp/protocol";

import { DEFAULT_ORDER_TTL_SECONDS } from "./index.js";

/** Regex for valid IVXP order IDs: ivxp-{uuid-v4}. */
const ORDER_ID_REGEX =
  /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Regex for valid Ethereum addresses (0x + 40 hex chars). */
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Valid network IDs. */
const VALID_NETWORKS = ["base-mainnet", "base-sepolia"] as const;

/** Default maximum results per list query. */
const DEFAULT_LIST_LIMIT = 100;

/** Maximum allowed list limit to prevent abuse. */
const MAX_LIST_LIMIT = 100;

/**
 * Raw row shape returned by better-sqlite3 SELECT queries.
 *
 * Column names use snake_case (database convention), while StoredOrder
 * uses camelCase (TypeScript convention). The rowToStoredOrder() function
 * maps between these naming conventions.
 */
interface OrderRow {
  readonly order_id: string;
  readonly status: string;
  readonly client_address: string;
  readonly service_type: string;
  readonly price_usdc: string;
  readonly payment_address: string;
  readonly network: string;
  readonly tx_hash: string | null;
  readonly delivery_endpoint: string | null;
  readonly content_hash: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly expires_at: number;
}

/** Map a database row to a StoredOrder. */
function rowToStoredOrder(row: OrderRow): StoredOrder {
  return {
    orderId: row.order_id,
    status: row.status as StoredOrder["status"],
    clientAddress: row.client_address as `0x${string}`,
    serviceType: row.service_type,
    priceUsdc: row.price_usdc,
    paymentAddress: row.payment_address as `0x${string}`,
    network: row.network,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.tx_hash != null ? { txHash: row.tx_hash as `0x${string}` } : {}),
    ...(row.delivery_endpoint != null ? { deliveryEndpoint: row.delivery_endpoint } : {}),
    ...(row.content_hash != null ? { contentHash: row.content_hash } : {}),
  };
}

/**
 * SQLite-backed implementation of IOrderStorage.
 *
 * All public methods are synchronous under the hood (better-sqlite3 is sync),
 * but return Promises to satisfy the IOrderStorage interface contract.
 */
export class OrderRepository implements IOrderStorage {
  private readonly db: Database.Database;
  private readonly ttlSeconds: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private isCleanupRunning = false;

  constructor(db: Database.Database, ttlSeconds: number = DEFAULT_ORDER_TTL_SECONDS) {
    // Validate TTL bounds (minimum 60 seconds)
    if (ttlSeconds < 60) {
      throw new Error(`TTL must be at least 60 seconds, got: ${ttlSeconds}`);
    }
    this.db = db;
    this.ttlSeconds = ttlSeconds;
  }

  // ---------------------------------------------------------------------------
  // IOrderStorage: create
  // ---------------------------------------------------------------------------

  async create(order: Omit<StoredOrder, "createdAt" | "updatedAt">): Promise<StoredOrder> {
    // Validate order ID format
    if (!ORDER_ID_REGEX.test(order.orderId)) {
      throw new Error(`Invalid order ID format: ${order.orderId}. Expected ivxp-{uuid-v4}.`);
    }

    // Validate client address format
    if (!ETH_ADDRESS_REGEX.test(order.clientAddress)) {
      throw new Error(`Invalid client address format: ${order.clientAddress}`);
    }

    // Validate payment address format
    if (!ETH_ADDRESS_REGEX.test(order.paymentAddress)) {
      throw new Error(`Invalid payment address format: ${order.paymentAddress}`);
    }

    // Validate network
    if (!VALID_NETWORKS.includes(order.network as (typeof VALID_NETWORKS)[number])) {
      throw new Error(
        `Invalid network: ${order.network}. Must be one of: ${VALID_NETWORKS.join(", ")}`,
      );
    }

    // Validate priceUsdc is a valid number string
    const price = parseFloat(order.priceUsdc);
    if (isNaN(price) || price < 0) {
      throw new Error(`Invalid price: ${order.priceUsdc}. Must be a non-negative number.`);
    }

    const now = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + this.ttlSeconds;

    const stmt = this.db.prepare(`
      INSERT INTO orders (
        order_id, status, client_address, service_type,
        price_usdc, payment_address, network,
        tx_hash, delivery_endpoint, content_hash,
        created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.orderId,
      order.status,
      order.clientAddress,
      order.serviceType,
      order.priceUsdc,
      order.paymentAddress,
      order.network,
      order.txHash ?? null,
      order.deliveryEndpoint ?? null,
      order.contentHash ?? null,
      now,
      now,
      expiresAt,
    );

    const created = await this.get(order.orderId);
    if (created === null) {
      throw new Error(
        `Failed to retrieve order after creation: ${order.orderId}. This indicates a database consistency issue.`,
      );
    }
    return created;
  }

  // ---------------------------------------------------------------------------
  // IOrderStorage: get
  // ---------------------------------------------------------------------------

  async get(orderId: string): Promise<StoredOrder | null> {
    const stmt = this.db.prepare("SELECT * FROM orders WHERE order_id = ?");
    const row = stmt.get(orderId) as OrderRow | undefined;
    return row ? rowToStoredOrder(row) : null;
  }

  // ---------------------------------------------------------------------------
  // IOrderStorage: update
  // ---------------------------------------------------------------------------

  async update(orderId: string, updates: OrderUpdates): Promise<StoredOrder> {
    const existing = await this.get(orderId);
    if (existing === null) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Whitelist of allowed field names to prevent SQL injection
    const ALLOWED_FIELDS: Record<keyof OrderUpdates, string> = {
      status: "status",
      txHash: "tx_hash",
      deliveryEndpoint: "delivery_endpoint",
      contentHash: "content_hash",
    };

    const fieldMap: Record<string, unknown> = {};
    if (updates.status !== undefined) fieldMap[ALLOWED_FIELDS.status] = updates.status;
    if (updates.txHash !== undefined) fieldMap[ALLOWED_FIELDS.txHash] = updates.txHash;
    if (updates.deliveryEndpoint !== undefined)
      fieldMap[ALLOWED_FIELDS.deliveryEndpoint] = updates.deliveryEndpoint;
    if (updates.contentHash !== undefined)
      fieldMap[ALLOWED_FIELDS.contentHash] = updates.contentHash;

    const keys = Object.keys(fieldMap);
    if (keys.length === 0) {
      return existing;
    }

    const now = new Date().toISOString();
    const setClauses = [...keys.map((k) => `${k} = ?`), "updated_at = ?"];
    const values = [...keys.map((k) => fieldMap[k]), now, orderId];

    const sql = `UPDATE orders SET ${setClauses.join(", ")} WHERE order_id = ?`;
    this.db.prepare(sql).run(...values);

    const updated = await this.get(orderId);
    if (updated === null) {
      throw new Error(`Failed to retrieve order after update: ${orderId}`);
    }
    return updated;
  }

  // ---------------------------------------------------------------------------
  // IOrderStorage: list
  // ---------------------------------------------------------------------------

  async list(filters?: OrderFilters): Promise<readonly StoredOrder[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.status !== undefined) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters?.clientAddress !== undefined) {
      conditions.push("client_address = ?");
      params.push(filters.clientAddress);
    }
    if (filters?.serviceType !== undefined) {
      conditions.push("service_type = ?");
      params.push(filters.serviceType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const limit = Math.min(Math.max(filters?.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const offset = Math.max(filters?.offset ?? 0, 0);

    const sql = `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as OrderRow[];
    return rows.map(rowToStoredOrder);
  }

  // ---------------------------------------------------------------------------
  // IOrderStorage: delete
  // ---------------------------------------------------------------------------

  async delete(orderId: string): Promise<void> {
    this.db.prepare("DELETE FROM orders WHERE order_id = ?").run(orderId);
  }

  // ---------------------------------------------------------------------------
  // Transaction support
  // ---------------------------------------------------------------------------

  /**
   * Execute a function within a database transaction.
   *
   * If the function throws, the transaction is rolled back automatically.
   * better-sqlite3 transactions are synchronous, so the callback must be sync.
   */
  runInTransaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  // ---------------------------------------------------------------------------
  // TTL cleanup
  // ---------------------------------------------------------------------------

  /**
   * Delete all orders whose expires_at timestamp is in the past.
   *
   * @returns Number of orders deleted.
   */
  cleanupExpiredOrders(): number {
    const now = Math.floor(Date.now() / 1000);
    const result = this.db.prepare("DELETE FROM orders WHERE expires_at < ?").run(now);
    return result.changes;
  }

  /**
   * Start periodic cleanup of expired orders.
   *
   * @param intervalMs - Cleanup interval in milliseconds.
   * @param onCleanup - Optional callback invoked after each cleanup with the count of deleted orders.
   */
  startCleanupScheduler(intervalMs: number, onCleanup?: (deletedCount: number) => void): void {
    this.stopCleanupScheduler();
    this.cleanupTimer = setInterval(() => {
      // Prevent concurrent cleanup runs
      if (this.isCleanupRunning) {
        return;
      }
      this.isCleanupRunning = true;
      try {
        const deleted = this.cleanupExpiredOrders();
        if (onCleanup && deleted > 0) {
          onCleanup(deleted);
        }
      } finally {
        this.isCleanupRunning = false;
      }
    }, intervalMs);
    // Unref so the timer doesn't prevent process exit
    this.cleanupTimer.unref();
  }

  /**
   * Stop the periodic cleanup scheduler.
   * Waits for any in-progress cleanup to complete.
   */
  stopCleanupScheduler(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Wait for cleanup to finish if it's running
    // Since better-sqlite3 is synchronous, this is a simple spin-wait
    while (this.isCleanupRunning) {
      // Busy wait (acceptable since cleanup is fast and synchronous)
    }
  }
}
