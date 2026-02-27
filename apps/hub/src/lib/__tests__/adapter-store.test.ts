import { describe, it, expect, beforeEach } from "vitest";
import {
  createAdapter,
  listPublishedAdapters,
  getAdapter,
  updateAdapterStatus,
  deleteAdapter,
  resetStore,
  getStore,
} from "../adapter-store";
import { VALID_ADAPTER_INPUT } from "./fixtures";

describe("adapter-store", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("createAdapter", () => {
    it("creates an entry with pending_audit status", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);

      expect(entry.name).toBe(VALID_ADAPTER_INPUT.name);
      expect(entry.status).toBe("pending_audit");
      expect(entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(new Date(entry.createdAt).toISOString()).toBe(entry.createdAt);
    });

    it("generates unique ids for each entry", () => {
      const a = createAdapter(VALID_ADAPTER_INPUT);
      const b = createAdapter({ ...VALID_ADAPTER_INPUT, name: "Another" });

      expect(a.id).not.toBe(b.id);
    });

    it("adds entry to the store immutably", () => {
      const storeBefore = getStore();
      createAdapter(VALID_ADAPTER_INPUT);
      const storeAfter = getStore();

      expect(storeBefore).not.toBe(storeAfter);
      expect(storeBefore.adapters).toHaveLength(0);
      expect(storeAfter.adapters).toHaveLength(1);
    });

    it("records frameworkType metadata", () => {
      const entry = createAdapter({ ...VALID_ADAPTER_INPUT, frameworkType: "A2A" });
      expect(entry.frameworkType).toBe("A2A");
    });
  });

  describe("listPublishedAdapters", () => {
    it("returns only published adapters", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      // Still pending_audit, should not appear
      const result = listPublishedAdapters({ page: 1, limit: 10 });
      expect(result.adapters).toHaveLength(0);
      expect(result.total).toBe(0);

      // Publish it
      updateAdapterStatus(entry.id, "published", { auditResult: true });
      const result2 = listPublishedAdapters({ page: 1, limit: 10 });
      expect(result2.adapters).toHaveLength(1);
      expect(result2.total).toBe(1);
    });

    it("paginates correctly", () => {
      // Create 5 published adapters
      for (let i = 0; i < 5; i++) {
        const e = createAdapter({ ...VALID_ADAPTER_INPUT, name: `Adapter ${i}` });
        updateAdapterStatus(e.id, "published", { auditResult: true });
      }

      const page1 = listPublishedAdapters({ page: 1, limit: 2 });
      expect(page1.adapters).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page3 = listPublishedAdapters({ page: 3, limit: 2 });
      expect(page3.adapters).toHaveLength(1);
      expect(page3.total).toBe(5);

      const page4 = listPublishedAdapters({ page: 4, limit: 2 });
      expect(page4.adapters).toHaveLength(0);
      expect(page4.total).toBe(5);
    });
  });

  describe("getAdapter", () => {
    it("returns the adapter by id", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      const found = getAdapter(entry.id);
      expect(found).toEqual(entry);
    });

    it("returns undefined for unknown id", () => {
      expect(getAdapter("nonexistent")).toBeUndefined();
    });
  });

  describe("updateAdapterStatus", () => {
    it("transitions to published with auditResult", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      const updated = updateAdapterStatus(entry.id, "published", {
        auditResult: true,
      });

      expect(updated?.status).toBe("published");
      expect(updated?.auditResult).toBe(true);
    });

    it("transitions to rejected with reason", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      const updated = updateAdapterStatus(entry.id, "rejected", {
        auditResult: false,
        rejectionReason: "Tests failed",
      });

      expect(updated?.status).toBe("rejected");
      expect(updated?.auditResult).toBe(false);
      expect(updated?.rejectionReason).toBe("Tests failed");
    });

    it("returns undefined for unknown id", () => {
      expect(updateAdapterStatus("nope", "published")).toBeUndefined();
    });

    it("updates store immutably", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      const storeBefore = getStore();
      updateAdapterStatus(entry.id, "published", { auditResult: true });
      const storeAfter = getStore();

      expect(storeBefore).not.toBe(storeAfter);
      expect(storeBefore.adapters[0].status).toBe("pending_audit");
      expect(storeAfter.adapters[0].status).toBe("published");
    });
  });

  describe("deleteAdapter", () => {
    it("removes the adapter and returns true", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      const result = deleteAdapter(entry.id);

      expect(result).toBe(true);
      expect(getStore().adapters).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(deleteAdapter("nonexistent")).toBe(false);
    });

    it("deletes store immutably", () => {
      const entry = createAdapter(VALID_ADAPTER_INPUT);
      const storeBefore = getStore();
      deleteAdapter(entry.id);
      const storeAfter = getStore();

      expect(storeBefore).not.toBe(storeAfter);
      expect(storeBefore.adapters).toHaveLength(1);
      expect(storeAfter.adapters).toHaveLength(0);
    });
  });
});
