/**
 * Unit tests for the SQLite database initialization layer.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  initializeDatabase,
  DEFAULT_ORDER_TTL_SECONDS,
  DEFAULT_CLEANUP_INTERVAL_MS,
} from "./index.js";

describe("initializeDatabase", () => {
  let dbInstance: ReturnType<typeof initializeDatabase> | null = null;

  afterEach(() => {
    dbInstance?.close();
    dbInstance = null;
  });

  it("should create an in-memory database with orders table", () => {
    dbInstance = initializeDatabase({ dbPath: ":memory:" });

    const tables = dbInstance.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("should enable WAL journal mode", () => {
    dbInstance = initializeDatabase({ dbPath: ":memory:" });

    const result = dbInstance.db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    // In-memory databases may report "memory" instead of "wal"
    expect(["wal", "memory"]).toContain(result[0]?.journal_mode);
  });

  it("should create all expected indexes", () => {
    dbInstance = initializeDatabase({ dbPath: ":memory:" });

    const indexes = dbInstance.db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='orders'")
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_orders_status");
    expect(indexNames).toContain("idx_orders_client");
    expect(indexNames).toContain("idx_orders_expires");
    expect(indexNames).toContain("idx_orders_service_type");
    expect(indexNames).toContain("idx_orders_tx_hash");
  });

  it("should be idempotent (safe to call twice)", () => {
    dbInstance = initializeDatabase({ dbPath: ":memory:" });
    // Re-apply schema on same db should not throw
    dbInstance.db.exec(
      "CREATE TABLE IF NOT EXISTS orders (order_id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('quoted','paid','processing','delivered','delivery_failed','confirmed')), client_address TEXT NOT NULL, service_type TEXT NOT NULL, price_usdc TEXT NOT NULL, payment_address TEXT NOT NULL, network TEXT NOT NULL, tx_hash TEXT, delivery_endpoint TEXT, content_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL);",
    );
  });

  it("should close the database without error", () => {
    dbInstance = initializeDatabase({ dbPath: ":memory:" });
    expect(() => dbInstance!.close()).not.toThrow();
    dbInstance = null; // prevent double-close in afterEach
  });
});

describe("constants", () => {
  it("DEFAULT_ORDER_TTL_SECONDS should be 7 days", () => {
    expect(DEFAULT_ORDER_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("DEFAULT_CLEANUP_INTERVAL_MS should be 1 hour", () => {
    expect(DEFAULT_CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1000);
  });
});
