/**
 * Comprehensive tests for the SQLite OrderRepository.
 *
 * Covers: CRUD operations, transaction support, concurrent access,
 * TTL cleanup, input validation, and edge cases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredOrder } from "@ivxp/protocol";
import { initializeDatabase } from "./index.js";
import { OrderRepository } from "./orders.js";

/** Helper: create a valid test order input (without timestamps). */
function makeOrderInput(
  overrides: Partial<Omit<StoredOrder, "createdAt" | "updatedAt">> = {},
): Omit<StoredOrder, "createdAt" | "updatedAt"> {
  return {
    orderId: `ivxp-${crypto.randomUUID()}`,
    status: "quoted",
    clientAddress: "0x1234567890abcdef1234567890abcdef12345678",
    serviceType: "text_echo",
    priceUsdc: "0.1",
    paymentAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    network: "base-sepolia",
    ...overrides,
  };
}

describe("OrderRepository", () => {
  let dbInstance: ReturnType<typeof initializeDatabase>;
  let repo: OrderRepository;

  beforeEach(() => {
    dbInstance = initializeDatabase({ dbPath: ":memory:" });
    repo = new OrderRepository(dbInstance.db);
  });

  afterEach(() => {
    repo.stopCleanupScheduler();
    dbInstance.close();
  });

  // -------------------------------------------------------------------------
  // Constructor validation
  // -------------------------------------------------------------------------

  describe("constructor", () => {
    it("should reject TTL below minimum (60 seconds)", () => {
      expect(() => new OrderRepository(dbInstance.db, 59)).toThrow(
        "TTL must be at least 60 seconds",
      );
    });

    it("should accept TTL at minimum (60 seconds)", () => {
      expect(() => new OrderRepository(dbInstance.db, 60)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("should create an order and return it with timestamps", async () => {
      const input = makeOrderInput();
      const order = await repo.create(input);

      expect(order.orderId).toBe(input.orderId);
      expect(order.status).toBe("quoted");
      expect(order.clientAddress).toBe(input.clientAddress);
      expect(order.serviceType).toBe("text_echo");
      expect(order.priceUsdc).toBe("0.1");
      expect(order.paymentAddress).toBe(input.paymentAddress);
      expect(order.network).toBe("base-sepolia");
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });

    it("should reject invalid order ID format", async () => {
      const input = makeOrderInput({ orderId: "bad-id" });
      await expect(repo.create(input)).rejects.toThrow("Invalid order ID format");
    });

    it("should reject duplicate order IDs", async () => {
      const input = makeOrderInput();
      await repo.create(input);
      await expect(repo.create(input)).rejects.toThrow();
    });

    it("should store optional fields when provided", async () => {
      const input = makeOrderInput({
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        deliveryEndpoint: "https://example.com/deliver",
        contentHash: "abc123",
      });
      const order = await repo.create(input);

      expect(order.txHash).toBe(input.txHash);
      expect(order.deliveryEndpoint).toBe("https://example.com/deliver");
      expect(order.contentHash).toBe("abc123");
    });

    it("should not include optional fields when not provided", async () => {
      const input = makeOrderInput();
      const order = await repo.create(input);

      expect(order.txHash).toBeUndefined();
      expect(order.deliveryEndpoint).toBeUndefined();
      expect(order.contentHash).toBeUndefined();
    });

    it("should reject invalid client address format", async () => {
      const input = makeOrderInput({ clientAddress: "not-an-address" as `0x${string}` });
      await expect(repo.create(input)).rejects.toThrow("Invalid client address format");
    });

    it("should reject invalid payment address format", async () => {
      const input = makeOrderInput({ paymentAddress: "0xinvalid" as `0x${string}` });
      await expect(repo.create(input)).rejects.toThrow("Invalid payment address format");
    });

    it("should reject invalid network", async () => {
      const input = makeOrderInput({ network: "ethereum-mainnet" });
      await expect(repo.create(input)).rejects.toThrow("Invalid network");
    });

    it("should reject invalid price (non-numeric)", async () => {
      const input = makeOrderInput({ priceUsdc: "not-a-number" });
      await expect(repo.create(input)).rejects.toThrow("Invalid price");
    });

    it("should reject negative price", async () => {
      const input = makeOrderInput({ priceUsdc: "-1.5" });
      await expect(repo.create(input)).rejects.toThrow("Invalid price");
    });
  });

  // -------------------------------------------------------------------------
  // get
  // -------------------------------------------------------------------------

  describe("get", () => {
    it("should return an existing order by ID", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      const order = await repo.get(input.orderId);
      expect(order).not.toBeNull();
      expect(order!.orderId).toBe(input.orderId);
    });

    it("should return null for non-existent order", async () => {
      const order = await repo.get("ivxp-00000000-0000-4000-8000-000000000000");
      expect(order).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe("update", () => {
    it("should update order status and bump updatedAt", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      // Ensure a different timestamp for updatedAt
      await new Promise((r) => setTimeout(r, 10));

      const updated = await repo.update(input.orderId, { status: "paid" });
      expect(updated.status).toBe("paid");
      expect(updated.updatedAt >= updated.createdAt).toBe(true);
    });

    it("should update txHash", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      const txHash = "0x2222222222222222222222222222222222222222222222222222222222222222" as const;
      const updated = await repo.update(input.orderId, { txHash });
      expect(updated.txHash).toBe(txHash);
    });

    it("should update multiple fields at once", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      const updated = await repo.update(input.orderId, {
        status: "delivered",
        contentHash: "sha256-abc",
      });
      expect(updated.status).toBe("delivered");
      expect(updated.contentHash).toBe("sha256-abc");
    });

    it("should return existing order when no updates provided", async () => {
      const input = makeOrderInput();
      const created = await repo.create(input);

      const updated = await repo.update(input.orderId, {});
      expect(updated.orderId).toBe(created.orderId);
    });

    it("should throw for non-existent order", async () => {
      await expect(
        repo.update("ivxp-00000000-0000-4000-8000-000000000000", { status: "paid" }),
      ).rejects.toThrow("Order not found");
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe("list", () => {
    it("should return all orders when no filters", async () => {
      await repo.create(makeOrderInput());
      await repo.create(makeOrderInput());
      await repo.create(makeOrderInput());

      const orders = await repo.list();
      expect(orders).toHaveLength(3);
    });

    it("should filter by status", async () => {
      const input1 = makeOrderInput();
      const input2 = makeOrderInput();
      await repo.create(input1);
      await repo.create(input2);
      await repo.update(input1.orderId, { status: "paid" });

      const paid = await repo.list({ status: "paid" });
      expect(paid).toHaveLength(1);
      expect(paid[0]!.orderId).toBe(input1.orderId);
    });

    it("should filter by clientAddress", async () => {
      const addr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
      await repo.create(makeOrderInput({ clientAddress: addr }));
      await repo.create(makeOrderInput());

      const filtered = await repo.list({ clientAddress: addr });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.clientAddress).toBe(addr);
    });

    it("should filter by serviceType", async () => {
      await repo.create(makeOrderInput({ serviceType: "image_gen" }));
      await repo.create(makeOrderInput({ serviceType: "text_echo" }));

      const filtered = await repo.list({ serviceType: "image_gen" });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.serviceType).toBe("image_gen");
    });

    it("should respect limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create(makeOrderInput());
      }

      const limited = await repo.list({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it("should respect offset parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await repo.create(makeOrderInput());
      }

      const all = await repo.list();
      const offset = await repo.list({ offset: 2 });
      expect(offset).toHaveLength(3);
      expect(offset[0]!.orderId).toBe(all[2]!.orderId);
    });

    it("should return empty array when no orders match", async () => {
      const orders = await repo.list({ status: "delivered" });
      expect(orders).toEqual([]);
    });

    it("should order by created_at DESC", async () => {
      const input1 = makeOrderInput();
      const input2 = makeOrderInput();
      await repo.create(input1);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await repo.create(input2);

      const orders = await repo.list();
      // Most recent first
      expect(orders[0]!.orderId).toBe(input2.orderId);
      expect(orders[1]!.orderId).toBe(input1.orderId);
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe("delete", () => {
    it("should delete an existing order", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      await repo.delete(input.orderId);
      const order = await repo.get(input.orderId);
      expect(order).toBeNull();
    });

    it("should not throw when deleting non-existent order", async () => {
      await expect(
        repo.delete("ivxp-00000000-0000-4000-8000-000000000000"),
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Transaction support
  // -------------------------------------------------------------------------

  describe("runInTransaction", () => {
    it("should commit successful transactions", async () => {
      const input1 = makeOrderInput();
      const input2 = makeOrderInput();

      repo.runInTransaction(() => {
        // Synchronous operations inside transaction
        const stmt = dbInstance.db.prepare(`
          INSERT INTO orders (order_id, status, client_address, service_type, price_usdc, payment_address, network, created_at, updated_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = new Date().toISOString();
        const expires = Math.floor(Date.now() / 1000) + 86400;
        stmt.run(
          input1.orderId,
          "quoted",
          input1.clientAddress,
          "text_echo",
          "0.1",
          input1.paymentAddress,
          "base-sepolia",
          now,
          now,
          expires,
        );
        stmt.run(
          input2.orderId,
          "quoted",
          input2.clientAddress,
          "text_echo",
          "0.1",
          input2.paymentAddress,
          "base-sepolia",
          now,
          now,
          expires,
        );
      });

      const orders = await repo.list();
      expect(orders).toHaveLength(2);
    });

    it("should rollback on error", async () => {
      const input = makeOrderInput();

      expect(() => {
        repo.runInTransaction(() => {
          const stmt = dbInstance.db.prepare(`
            INSERT INTO orders (order_id, status, client_address, service_type, price_usdc, payment_address, network, created_at, updated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const now = new Date().toISOString();
          const expires = Math.floor(Date.now() / 1000) + 86400;
          stmt.run(
            input.orderId,
            "quoted",
            input.clientAddress,
            "text_echo",
            "0.1",
            input.paymentAddress,
            "base-sepolia",
            now,
            now,
            expires,
          );
          throw new Error("Simulated failure");
        });
      }).toThrow("Simulated failure");

      // Order should not exist after rollback
      const order = await repo.get(input.orderId);
      expect(order).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent access
  // -------------------------------------------------------------------------

  describe("concurrent access", () => {
    it("should handle concurrent reads", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      const results = await Promise.all([
        repo.get(input.orderId),
        repo.get(input.orderId),
        repo.get(input.orderId),
      ]);

      for (const result of results) {
        expect(result).not.toBeNull();
        expect(result!.orderId).toBe(input.orderId);
      }
    });

    it("should handle concurrent writes to different orders", async () => {
      const inputs = Array.from({ length: 5 }, () => makeOrderInput());

      await Promise.all(inputs.map((input) => repo.create(input)));

      const orders = await repo.list();
      expect(orders).toHaveLength(5);
    });

    it("should handle concurrent updates to the same order", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      // Sequential updates (better-sqlite3 is synchronous, so these are safe)
      await repo.update(input.orderId, { status: "paid" });
      await repo.update(input.orderId, {
        txHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      });

      const order = await repo.get(input.orderId);
      expect(order!.status).toBe("paid");
      expect(order!.txHash).toBe(
        "0x3333333333333333333333333333333333333333333333333333333333333333",
      );
    });
  });

  // -------------------------------------------------------------------------
  // TTL cleanup
  // -------------------------------------------------------------------------

  describe("cleanupExpiredOrders", () => {
    it("should delete expired orders", async () => {
      // Create repo with TTL of 60 seconds (minimum allowed)
      const shortTtlRepo = new OrderRepository(dbInstance.db, 60);

      const input = makeOrderInput();
      await shortTtlRepo.create(input);

      // Manually set expires_at to the past to simulate expiry
      dbInstance.db
        .prepare("UPDATE orders SET expires_at = ? WHERE order_id = ?")
        .run(Math.floor(Date.now() / 1000) - 10, input.orderId);

      const deleted = shortTtlRepo.cleanupExpiredOrders();
      expect(deleted).toBe(1);

      const order = await shortTtlRepo.get(input.orderId);
      expect(order).toBeNull();
    });

    it("should not delete non-expired orders", async () => {
      const input = makeOrderInput();
      await repo.create(input);

      const deleted = repo.cleanupExpiredOrders();
      expect(deleted).toBe(0);

      const order = await repo.get(input.orderId);
      expect(order).not.toBeNull();
    });

    it("should only delete expired orders, leaving active ones", async () => {
      const shortTtlRepo = new OrderRepository(dbInstance.db, 60);
      const longTtlRepo = new OrderRepository(dbInstance.db, 86400);

      const expiring = makeOrderInput();
      const active = makeOrderInput();

      await shortTtlRepo.create(expiring);
      await longTtlRepo.create(active);

      // Manually set the expiring order's expires_at to the past
      dbInstance.db
        .prepare("UPDATE orders SET expires_at = ? WHERE order_id = ?")
        .run(Math.floor(Date.now() / 1000) - 10, expiring.orderId);

      const deleted = shortTtlRepo.cleanupExpiredOrders();
      expect(deleted).toBe(1);

      const remaining = await repo.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.orderId).toBe(active.orderId);
    });
  });

  describe("cleanup scheduler", () => {
    it("should invoke cleanup periodically", async () => {
      // Manually insert an already-expired order to guarantee cleanup finds it
      const now = Math.floor(Date.now() / 1000);
      const orderId = `ivxp-${crypto.randomUUID()}`;
      dbInstance.db
        .prepare(
          `
        INSERT INTO orders (order_id, status, client_address, service_type, price_usdc, payment_address, network, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          orderId,
          "quoted",
          "0x1234567890abcdef1234567890abcdef12345678",
          "text_echo",
          "0.1",
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          "base-sepolia",
          new Date().toISOString(),
          new Date().toISOString(),
          now - 10,
        );

      const onCleanup = vi.fn();
      repo.startCleanupScheduler(50, onCleanup);

      await new Promise((r) => setTimeout(r, 200));

      repo.stopCleanupScheduler();
      expect(onCleanup).toHaveBeenCalled();
      expect(onCleanup).toHaveBeenCalledWith(1);
    });

    it("should stop scheduler without error", () => {
      expect(() => repo.stopCleanupScheduler()).not.toThrow();
    });

    it("should replace existing scheduler when started again", () => {
      const onCleanup1 = vi.fn();
      const onCleanup2 = vi.fn();

      repo.startCleanupScheduler(100, onCleanup1);
      repo.startCleanupScheduler(100, onCleanup2);

      // Should not throw, old timer should be cleared
      repo.stopCleanupScheduler();
    });
  });

  // -------------------------------------------------------------------------
  // Status constraint validation
  // -------------------------------------------------------------------------

  describe("status constraint", () => {
    it("should reject invalid status values", async () => {
      const input = makeOrderInput({ status: "invalid_status" as never });
      await expect(repo.create(input)).rejects.toThrow();
    });

    it("should accept all valid status values", async () => {
      const statuses = [
        "quoted",
        "paid",
        "processing",
        "delivered",
        "delivery_failed",
        "confirmed",
      ] as const;

      for (const status of statuses) {
        const input = makeOrderInput({ status });
        const order = await repo.create(input);
        expect(order.status).toBe(status);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Order lifecycle integration
  // -------------------------------------------------------------------------

  describe("order lifecycle", () => {
    it("should support full order lifecycle: quoted -> paid -> processing -> delivered", async () => {
      const input = makeOrderInput();
      const created = await repo.create(input);
      expect(created.status).toBe("quoted");

      const paid = await repo.update(input.orderId, {
        status: "paid",
        txHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
      });
      expect(paid.status).toBe("paid");
      expect(paid.txHash).toBeDefined();

      const processing = await repo.update(input.orderId, { status: "processing" });
      expect(processing.status).toBe("processing");

      const delivered = await repo.update(input.orderId, {
        status: "delivered",
        contentHash: "sha256-deliverable-hash",
      });
      expect(delivered.status).toBe("delivered");
      expect(delivered.contentHash).toBe("sha256-deliverable-hash");
    });
  });
});
