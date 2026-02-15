/**
 * Deliverable store tests.
 *
 * Tests InMemoryDeliverableStore CRUD operations.
 *
 * @see Story 3.17 - IVXPProvider Order Processing & Storage
 */

import { describe, expect, it } from "vitest";
import { InMemoryDeliverableStore, type StoredDeliverable } from "./deliverable-store.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestDeliverable(orderId: string): StoredDeliverable {
  return {
    orderId,
    content: "Test content",
    contentType: "text/plain",
    contentHash: "abc123def456",
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InMemoryDeliverableStore", () => {
  it("should store and retrieve a deliverable", () => {
    const store = new InMemoryDeliverableStore();
    const deliverable = createTestDeliverable("order-1");

    store.set("order-1", deliverable);

    const result = store.get("order-1");
    expect(result).toBeDefined();
    expect(result!.orderId).toBe("order-1");
    expect(result!.content).toBe("Test content");
  });

  it("should return undefined for non-existent order", () => {
    const store = new InMemoryDeliverableStore();

    const result = store.get("non-existent");

    expect(result).toBeUndefined();
  });

  it("should report has() correctly", () => {
    const store = new InMemoryDeliverableStore();
    const deliverable = createTestDeliverable("order-1");

    expect(store.has("order-1")).toBe(false);

    store.set("order-1", deliverable);

    expect(store.has("order-1")).toBe(true);
  });

  it("should delete a deliverable", () => {
    const store = new InMemoryDeliverableStore();
    const deliverable = createTestDeliverable("order-1");

    store.set("order-1", deliverable);
    store.delete("order-1");

    expect(store.get("order-1")).toBeUndefined();
    expect(store.has("order-1")).toBe(false);
  });

  it("should return a copy from get() to prevent mutation", () => {
    const store = new InMemoryDeliverableStore();
    const deliverable = createTestDeliverable("order-1");

    store.set("order-1", deliverable);

    const result1 = store.get("order-1");
    const result2 = store.get("order-1");

    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });

  it("should track size correctly", () => {
    const store = new InMemoryDeliverableStore();

    expect(store.size()).toBe(0);

    store.set("order-1", createTestDeliverable("order-1"));
    expect(store.size()).toBe(1);

    store.set("order-2", createTestDeliverable("order-2"));
    expect(store.size()).toBe(2);

    store.delete("order-1");
    expect(store.size()).toBe(1);
  });

  it("should clear all deliverables", () => {
    const store = new InMemoryDeliverableStore();

    store.set("order-1", createTestDeliverable("order-1"));
    store.set("order-2", createTestDeliverable("order-2"));
    store.clear();

    expect(store.size()).toBe(0);
    expect(store.get("order-1")).toBeUndefined();
  });

  it("should overwrite existing deliverable with same orderId", () => {
    const store = new InMemoryDeliverableStore();

    store.set("order-1", createTestDeliverable("order-1"));
    store.set("order-1", {
      ...createTestDeliverable("order-1"),
      content: "Updated content",
    });

    const result = store.get("order-1");
    expect(result!.content).toBe("Updated content");
    expect(store.size()).toBe(1);
  });

  it("should deep-copy Uint8Array content to prevent shared reference mutation", () => {
    const store = new InMemoryDeliverableStore();
    const binaryContent = new Uint8Array([1, 2, 3, 4]);
    const deliverable: StoredDeliverable = {
      orderId: "order-bin",
      content: binaryContent,
      contentType: "application/octet-stream",
      contentHash: "deadbeef",
      createdAt: new Date().toISOString(),
    };

    store.set("order-bin", deliverable);

    const retrieved = store.get("order-bin")!;
    expect(retrieved.content).toBeInstanceOf(Uint8Array);
    expect(retrieved.content).toEqual(new Uint8Array([1, 2, 3, 4]));

    // Mutating the retrieved copy should NOT affect the stored original
    (retrieved.content as Uint8Array)[0] = 99;

    const secondRetrieval = store.get("order-bin")!;
    expect((secondRetrieval.content as Uint8Array)[0]).toBe(1);
  });
});
