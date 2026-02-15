/**
 * Tests for MockOrderStorage.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { MockOrderStorage } from "./order-storage.js";
import { createMockOrder, resetOrderCounter } from "../fixtures/orders.js";
import { TEST_ACCOUNTS } from "../fixtures/wallets.js";
import type { StoredOrder } from "@ivxp/protocol";

describe("MockOrderStorage", () => {
  let storage: MockOrderStorage;

  beforeEach(() => {
    storage = new MockOrderStorage();
    resetOrderCounter();
  });

  describe("create", () => {
    it("should create and store an order", async () => {
      const input = createMockOrder("quoted");
      const { createdAt: _c, updatedAt: _u, ...orderWithoutTimestamps } = input;
      const result = await storage.create(orderWithoutTimestamps);
      expect(result.orderId).toBe(input.orderId);
      expect(result.status).toBe("quoted");
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(storage.size()).toBe(1);
    });

    it("should reject duplicate order IDs", async () => {
      const input = createMockOrder("quoted");
      const { createdAt: _c, updatedAt: _u, ...orderWithoutTimestamps } = input;
      await storage.create(orderWithoutTimestamps);
      await expect(storage.create(orderWithoutTimestamps)).rejects.toThrow("already exists");
    });

    it("should reject invalid order ID format", async () => {
      const order = createMockOrder("quoted", {
        orderId: "invalid-format",
      });
      const { createdAt: _c, updatedAt: _u, ...orderWithoutTimestamps } = order;
      await expect(storage.create(orderWithoutTimestamps)).rejects.toThrow(
        "Invalid order ID format",
      );
    });

    it("should throw when createError is configured", async () => {
      storage = new MockOrderStorage({
        createError: new Error("db error"),
      });
      const input = createMockOrder("quoted");
      const { createdAt: _c, updatedAt: _u, ...orderWithoutTimestamps } = input;
      await expect(storage.create(orderWithoutTimestamps)).rejects.toThrow("db error");
    });

    it("should record create calls", async () => {
      const input = createMockOrder("quoted");
      const { createdAt: _c, updatedAt: _u, ...orderWithoutTimestamps } = input;
      await storage.create(orderWithoutTimestamps);
      expect(storage.getCreateCalls()).toHaveLength(1);
    });
  });

  describe("get", () => {
    it("should return stored order by ID", async () => {
      const order = createMockOrder("quoted");
      storage.seed([order]);
      const result = await storage.get(order.orderId);
      expect(result).not.toBeNull();
      expect(result?.orderId).toBe(order.orderId);
    });

    it("should return null for unknown ID", async () => {
      const result = await storage.get("ivxp-nonexistent");
      expect(result).toBeNull();
    });

    it("should throw when getError is configured", async () => {
      storage = new MockOrderStorage({
        getError: new Error("read error"),
      });
      await expect(storage.get("ivxp-123")).rejects.toThrow("read error");
    });
  });

  describe("update", () => {
    it("should update mutable fields", async () => {
      const order = createMockOrder("quoted", {
        updatedAt: "2020-01-01T00:00:00.000Z",
      });
      storage.seed([order]);
      const result = await storage.update(order.orderId, {
        status: "paid",
        txHash:
          "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`,
      });
      expect(result.status).toBe("paid");
      expect(result.txHash).toContain("0xdeadbeef");
      expect(result.updatedAt).not.toBe(order.updatedAt);
    });

    it("should throw for unknown order", async () => {
      await expect(storage.update("ivxp-nonexistent", { status: "paid" })).rejects.toThrow(
        "not found",
      );
    });

    it("should preserve immutable fields", async () => {
      const order = createMockOrder("quoted");
      storage.seed([order]);
      const result = await storage.update(order.orderId, {
        status: "paid",
      });
      expect(result.clientAddress).toBe(order.clientAddress);
      expect(result.serviceType).toBe(order.serviceType);
      expect(result.priceUsdc).toBe(order.priceUsdc);
    });
  });

  describe("list", () => {
    let orders: readonly StoredOrder[];

    beforeEach(() => {
      orders = [
        createMockOrder("quoted", {
          orderId: "ivxp-00000001-0000-0000-0000-000000000000",
          serviceType: "code_review",
        }),
        createMockOrder("paid", {
          orderId: "ivxp-00000002-0000-0000-0000-000000000000",
          serviceType: "translation",
        }),
        createMockOrder("delivered", {
          orderId: "ivxp-00000003-0000-0000-0000-000000000000",
          serviceType: "code_review",
          clientAddress: TEST_ACCOUNTS.thirdParty.address,
        }),
      ];
      storage.seed(orders);
    });

    it("should list all orders without filters", async () => {
      const result = await storage.list();
      expect(result).toHaveLength(3);
    });

    it("should filter by status", async () => {
      const result = await storage.list({ status: "paid" });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("paid");
    });

    it("should filter by serviceType", async () => {
      const result = await storage.list({ serviceType: "code_review" });
      expect(result).toHaveLength(2);
    });

    it("should filter by clientAddress", async () => {
      const result = await storage.list({
        clientAddress: TEST_ACCOUNTS.thirdParty.address,
      });
      expect(result).toHaveLength(1);
    });

    it("should support limit and offset", async () => {
      const result = await storage.list({ limit: 2, offset: 1 });
      expect(result).toHaveLength(2);
    });
  });

  describe("delete", () => {
    it("should remove order from store", async () => {
      const order = createMockOrder("quoted");
      storage.seed([order]);
      await storage.delete(order.orderId);
      const result = await storage.get(order.orderId);
      expect(result).toBeNull();
      expect(storage.size()).toBe(0);
    });
  });

  describe("test helpers", () => {
    it("should seed storage with orders", () => {
      const order = createMockOrder("quoted");
      storage.seed([order]);
      expect(storage.size()).toBe(1);
    });

    it("should clear store", () => {
      storage.seed([createMockOrder("quoted")]);
      storage.clearStore();
      expect(storage.size()).toBe(0);
    });

    it("should reset calls and store", async () => {
      const order = createMockOrder("quoted");
      storage.seed([order]);
      await storage.get(order.orderId);
      storage.reset();
      expect(storage.size()).toBe(0);
      expect(storage.getGetCalls()).toHaveLength(0);
    });
  });
});
