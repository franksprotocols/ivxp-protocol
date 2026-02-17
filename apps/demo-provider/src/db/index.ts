/**
 * SQLite database initialization and connection management.
 *
 * Provides a factory function to create and configure a better-sqlite3
 * database instance with WAL mode, proper pragmas, and schema initialization.
 */

import Database from "better-sqlite3";

/** Default TTL for orders: 7 days in seconds. */
export const DEFAULT_ORDER_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Default cleanup interval: 1 hour in milliseconds.
 *
 * Rationale: Hourly cleanup balances resource usage with timely removal.
 * More frequent cleanup (e.g., every minute) wastes CPU on mostly-empty
 * scans. Less frequent cleanup (e.g., daily) delays disk space reclamation.
 */
export const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Embedded schema SQL for the orders table.
 *
 * Uses IF NOT EXISTS guards for idempotent initialization.
 * Kept inline to avoid file-system dependency issues with bundlers.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS orders (
  order_id         TEXT PRIMARY KEY,
  status           TEXT NOT NULL CHECK(status IN ('quoted','paid','processing','delivered','delivery_failed','confirmed')),
  client_address   TEXT NOT NULL,
  service_type     TEXT NOT NULL,
  price_usdc       TEXT NOT NULL,
  payment_address  TEXT NOT NULL,
  network          TEXT NOT NULL,
  tx_hash          TEXT,
  delivery_endpoint TEXT,
  content_hash     TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  expires_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_address);
CREATE INDEX IF NOT EXISTS idx_orders_expires ON orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_tx_hash ON orders(tx_hash);
`;

export interface DatabaseOptions {
  /** Path to the SQLite database file. Use ":memory:" for in-memory. */
  readonly dbPath: string;
  /** Enable verbose logging (development only). */
  readonly verbose?: boolean;
}

export interface DatabaseInstance {
  /** The underlying better-sqlite3 database. */
  readonly db: Database.Database;
  /** Close the database connection gracefully. */
  readonly close: () => void;
}

/**
 * Initialize a SQLite database with the orders schema.
 *
 * Enables WAL mode for better concurrency and applies the schema
 * using IF NOT EXISTS guards for idempotent initialization.
 */
export function initializeDatabase(options: DatabaseOptions): DatabaseInstance {
  const { dbPath, verbose = false } = options;

  const db = new Database(dbPath, {
    verbose: verbose ? console.log : undefined,
  });

  // Enable WAL mode for better concurrent read/write performance
  db.pragma("journal_mode = WAL");
  // Balance safety and performance
  db.pragma("synchronous = NORMAL");
  // Enable foreign keys (good practice even if not used yet)
  db.pragma("foreign_keys = ON");

  // Apply schema
  db.exec(SCHEMA_SQL);

  const close = (): void => {
    db.close();
  };

  return { db, close };
}
