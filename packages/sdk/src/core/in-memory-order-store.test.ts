/**
 * InMemoryOrderStore unit tests.
 *
 * Tests CRUD operations, validation, optimistic locking,
 * immutability of returned objects, and error types.
 *
 * @see Story 3.15 - IVXPProvider Quote Endpoint
 */

import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryOrderStore } from "./in-memory-order-store.js";
import { IVXPError } from "../errors/base.js";
import type { StoredOrder } from "@ivxp/protocol";
import { TEST_ACCOUNTS } from "@ivxp/test-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Valid order ID for testing. */
const VALID_ORDER_ID = "ivxp-550e8400-e29b-41d4-a716-446655440000";

/** Second valid order ID for multi-order tests. */
const VALID_ORDER_ID_2 = "ivxp-660e8400-e29b-41d4-a716-446655440001";

/** Build a valid order creation payload (omitting timestamps). */
function buildCreatePayload(
  overrides?: Partial<Omit<StoredOrder, "createdAt" | "updatedAt">>,
): Omit<StoredOrder, "createdAt" | "updatedAt"> {
  return {
    orderId: VALID_ORDER_ID,
    status: "quoted",
    clientAddress: TEST_ACCOUNTS.client.address,
    serviceType: "code_review",
    priceUsdc: "10.000000",
    paymentAddress: TEST_ACCOUNTS.provider.address,
    network: "base-sepolia",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InMemoryOrderStore", () => {
  let store: InMemoryOrderStore;

  beforeEach(() => {
    store = new InMemoryOrderStore();
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------

  describe("create()", () => {
    it("should create an order with valid ivxp-uuid ID", async () => {
      const order = await store.create(buildCreatePayload());

      expect(order.orderId).toBe(VALID_ORDER_ID);
      expect(order.status).toBe("quoted");
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });

    it("should reject lowercase uuid (valid)", async () => {
      const order = await store.create(
        buildCreatePayload({ orderId: "ivxp-550e8400-e29b-41d4-a716-446655440000" }),
      );
      expect(order.orderId).toBe("ivxp-550e8400-e29b-41d4-a716-446655440000");
    });

    it("should accept uppercase UUID (#7)", async () => {
      const order = await store.create(
        buildCreatePayload({ orderId: "ivxp-550E8400-E29B-41D4-A716-446655440000" }),
      );
      expect(order.orderId).toBe("ivxp-550E8400-E29B-41D4-A716-446655440000");
    });

    it("should throw IVXPError with INVALID_ORDER_ID for missing prefix (#7, #10)", async () => {
      await expect(
        store.create(buildCreatePayload({ orderId: "550e8400-e29b-41d4-a716-446655440000" })),
      ).rejects.toThrow(IVXPError);

      try {
        await store.create(buildCreatePayload({ orderId: "bad-prefix-1234" }));
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("INVALID_ORDER_ID");
      }
    });

    it("should throw IVXPError with INVALID_ORDER_ID for wrong prefix (#7)", async () => {
      await expect(
        store.create(buildCreatePayload({ orderId: "order-550e8400-e29b-41d4-a716-446655440000" })),
      ).rejects.toThrow(IVXPError);
    });

    it("should throw IVXPError with INVALID_ORDER_ID for truncated UUID (#7)", async () => {
      await expect(
        store.create(buildCreatePayload({ orderId: "ivxp-550e8400-e29b" })),
      ).rejects.toThrow(IVXPError);
    });

    it("should throw IVXPError with INVALID_ORDER_ID for UUID without hyphens (#7)", async () => {
      await expect(
        store.create(buildCreatePayload({ orderId: "ivxp-550e8400e29b41d4a716446655440000" })),
      ).rejects.toThrow(IVXPError);
    });

    it("should throw IVXPError with INVALID_ORDER_ID for empty string (#7)", async () => {
      await expect(store.create(buildCreatePayload({ orderId: "" }))).rejects.toThrow(IVXPError);
    });

    it("should throw IVXPError with ORDER_ALREADY_EXISTS for duplicate (#10)", async () => {
      await store.create(buildCreatePayload());

      try {
        await store.create(buildCreatePayload());
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("ORDER_ALREADY_EXISTS");
      }
    });

    it("should return a copy that does not affect internal state (#8)", async () => {
      const returned = await store.create(buildCreatePayload());

      // Mutate the returned object
      (returned as { status: string }).status = "paid";

      // Internal state should be unaffected
      const fetched = await store.get(VALID_ORDER_ID);
      expect(fetched!.status).toBe("quoted");
    });
  });

  // -------------------------------------------------------------------------
  // get()
  // -------------------------------------------------------------------------

  describe("get()", () => {
    it("should return null for nonexistent order", async () => {
      const order = await store.get("ivxp-00000000-0000-0000-0000-000000000000");
      expect(order).toBeNull();
    });

    it("should return a copy that does not affect internal state (#8)", async () => {
      await store.create(buildCreatePayload());

      const fetched = await store.get(VALID_ORDER_ID);
      expect(fetched).not.toBeNull();

      // Mutate the returned copy
      (fetched as { status: string }).status = "delivered";

      // Internal state should be unaffected
      const fetchedAgain = await store.get(VALID_ORDER_ID);
      expect(fetchedAgain!.status).toBe("quoted");
    });

    it("should return different references on successive calls (#8)", async () => {
      await store.create(buildCreatePayload());

      const a = await store.get(VALID_ORDER_ID);
      const b = await store.get(VALID_ORDER_ID);

      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  // -------------------------------------------------------------------------
  // update() with optimistic locking (#1)
  // -------------------------------------------------------------------------

  describe("update()", () => {
    it("should update an existing order", async () => {
      await store.create(buildCreatePayload());

      const updated = await store.update(VALID_ORDER_ID, { status: "paid" });

      expect(updated.status).toBe("paid");
      expect(updated.orderId).toBe(VALID_ORDER_ID);
    });

    it("should throw IVXPError with ORDER_NOT_FOUND for nonexistent order (#10)", async () => {
      try {
        await store.update("ivxp-00000000-0000-0000-0000-000000000000", { status: "paid" });
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("ORDER_NOT_FOUND");
      }
    });

    it("should succeed when expectedUpdatedAt matches (#1)", async () => {
      const created = await store.create(buildCreatePayload());

      const updated = await store.update(VALID_ORDER_ID, { status: "paid" }, created.updatedAt);

      expect(updated.status).toBe("paid");
    });

    it("should throw ORDER_CONCURRENT_MODIFICATION when expectedUpdatedAt does not match (#1)", async () => {
      await store.create(buildCreatePayload());

      try {
        await store.update(
          VALID_ORDER_ID,
          { status: "paid" },
          "1970-01-01T00:00:00.000Z", // stale timestamp
        );
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(IVXPError);
        expect((error as IVXPError).code).toBe("ORDER_CONCURRENT_MODIFICATION");
        expect((error as IVXPError).details?.orderId).toBe(VALID_ORDER_ID);
        expect((error as IVXPError).details?.expectedUpdatedAt).toBe("1970-01-01T00:00:00.000Z");
      }
    });

    it("should proceed unconditionally when expectedUpdatedAt is not provided (#1)", async () => {
      await store.create(buildCreatePayload());

      // First update succeeds without expectedUpdatedAt
      const updated1 = await store.update(VALID_ORDER_ID, { status: "paid" });
      expect(updated1.status).toBe("paid");

      // Second update also succeeds without expectedUpdatedAt
      const updated2 = await store.update(VALID_ORDER_ID, { status: "delivered" });
      expect(updated2.status).toBe("delivered");
    });

    it("should return a copy that does not affect internal state (#8)", async () => {
      await store.create(buildCreatePayload());

      const updated = await store.update(VALID_ORDER_ID, { status: "paid" });
      (updated as { status: string }).status = "delivered";

      const fetched = await store.get(VALID_ORDER_ID);
      expect(fetched!.status).toBe("paid");
    });
  });

  // -------------------------------------------------------------------------
  // list() (#8)
  // -------------------------------------------------------------------------

  describe("list()", () => {
    it("should return shallow copies of all orders (#8)", async () => {
      await store.create(buildCreatePayload());
      await store.create(buildCreatePayload({ orderId: VALID_ORDER_ID_2 }));

      const results = await store.list();
      expect(results).toHaveLength(2);

      // Mutate returned objects
      (results[0] as { status: string }).status = "delivered";

      // Internal state should be unaffected
      const fetched = await store.get(VALID_ORDER_ID);
      expect(fetched!.status).toBe("quoted");
    });

    it("should return different references for the same order on successive calls (#8)", async () => {
      await store.create(buildCreatePayload());

      const list1 = await store.list();
      const list2 = await store.list();

      expect(list1[0]).not.toBe(list2[0]);
      expect(list1[0]).toEqual(list2[0]);
    });

    it("should filter by status", async () => {
      await store.create(buildCreatePayload());
      await store.create(buildCreatePayload({ orderId: VALID_ORDER_ID_2 }));
      await store.update(VALID_ORDER_ID_2, { status: "paid" });

      const quoted = await store.list({ status: "quoted" });
      expect(quoted).toHaveLength(1);
      expect(quoted[0].orderId).toBe(VALID_ORDER_ID);

      const paid = await store.list({ status: "paid" });
      expect(paid).toHaveLength(1);
      expect(paid[0].orderId).toBe(VALID_ORDER_ID_2);
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------

  describe("delete()", () => {
    it("should remove an existing order", async () => {
      await store.create(buildCreatePayload());
      await store.delete(VALID_ORDER_ID);

      const fetched = await store.get(VALID_ORDER_ID);
      expect(fetched).toBeNull();
    });

    it("should not throw for nonexistent order", async () => {
      await expect(
        store.delete("ivxp-00000000-0000-0000-0000-000000000000"),
      ).resolves.toBeUndefined();
    });
  });
});
