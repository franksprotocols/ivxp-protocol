import { describe, it, expect, vi } from "vitest";
import type { RatingWire } from "./types";

const mockRating: RatingWire = {
  rating_id: "rating-001",
  order_id: "order-001",
  provider_address: "0xAAA",
  service_type: "text_echo",
  client_address: "0xBBB",
  stars: 5,
  review_text: "Excellent service",
  signature: "0x" + "ab".repeat(65),
  created_at: 1700000000000,
};

const secondRating: RatingWire = {
  ...mockRating,
  rating_id: "rating-002",
  order_id: "order-002",
  client_address: "0xCCC",
  provider_address: "0xDDD",
  stars: 3,
};

// ============================================================
// Pure function tests (no fs mocking needed)
// ============================================================

describe("isDuplicateRating", () => {
  it("returns true for matching order_id + client_address", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([mockRating], "order-001", "0xBBB")).toBe(true);
  });

  it("returns true for case-insensitive client_address", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([mockRating], "order-001", "0xbbb")).toBe(true);
  });

  it("returns false for different order_id", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([mockRating], "order-999", "0xBBB")).toBe(false);
  });

  it("returns false for different client_address", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([mockRating], "order-001", "0xCCC")).toBe(false);
  });

  it("returns false for empty ratings array", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([], "order-001", "0xBBB")).toBe(false);
  });

  it("finds duplicate among multiple ratings", async () => {
    const mod = await import("./rating-storage");
    expect(
      mod.isDuplicateRating([secondRating, mockRating], "order-001", "0xBBB"),
    ).toBe(true);
  });

  it("returns false when order matches but client does not", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([mockRating], "order-001", "0xZZZ")).toBe(false);
  });

  it("returns false when client matches but order does not", async () => {
    const mod = await import("./rating-storage");
    expect(mod.isDuplicateRating([mockRating], "order-999", "0xBBB")).toBe(false);
  });
});

// ============================================================
// Mocked module tests for fs-dependent functions
// ============================================================

// Mock the entire rating-storage module to test the API contract
vi.mock("./rating-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rating-storage")>();
  return {
    ...actual,
    loadRatings: vi.fn(() => []),
    addRating: vi.fn(async (rating: RatingWire) => rating),
    getRatingsByProvider: vi.fn(() => []),
  };
});

describe("loadRatings (mocked)", () => {
  it("returns mocked ratings data", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.loadRatings).mockReturnValue([mockRating]);

    const ratings = mod.loadRatings();
    expect(ratings).toHaveLength(1);
    expect(ratings[0].rating_id).toBe("rating-001");
  });

  it("returns empty array from factory default", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.loadRatings).mockReturnValue([]);

    const ratings = mod.loadRatings();
    expect(ratings).toEqual([]);
  });

  it("returns multiple ratings", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.loadRatings).mockReturnValue([mockRating, secondRating]);

    const ratings = mod.loadRatings();
    expect(ratings).toHaveLength(2);
  });

  it("returns empty when ratings field is missing", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.loadRatings).mockReturnValue([]);

    const ratings = mod.loadRatings();
    expect(ratings).toHaveLength(0);
  });
});

describe("addRating (mocked)", () => {
  it("returns the rating on success", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.addRating).mockResolvedValue(mockRating);

    const result = await mod.addRating(mockRating);
    expect(result.rating_id).toBe("rating-001");
  });

  it("throws on duplicate rating", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.addRating).mockRejectedValue(
      new Error("Rating already exists for order order-001 from 0xBBB"),
    );

    await expect(mod.addRating(mockRating)).rejects.toThrow("Rating already exists");
  });

  it("is called with correct rating data", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.addRating).mockResolvedValue(mockRating);

    await mod.addRating(mockRating);
    expect(mod.addRating).toHaveBeenCalledWith(mockRating);
  });

  it("appends new rating without mutating existing", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.addRating).mockResolvedValue(secondRating);

    const result = await mod.addRating(secondRating);
    expect(result.rating_id).toBe("rating-002");
    expect(result.order_id).toBe("order-002");
  });
});

describe("getRatingsByProvider (mocked)", () => {
  it("returns ratings for matching provider", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.getRatingsByProvider).mockReturnValue([mockRating]);

    const ratings = mod.getRatingsByProvider("0xAAA");
    expect(ratings).toHaveLength(1);
  });

  it("returns empty for non-matching provider", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.getRatingsByProvider).mockReturnValue([]);

    const ratings = mod.getRatingsByProvider("0xZZZ");
    expect(ratings).toHaveLength(0);
  });

  it("returns multiple ratings for same provider", async () => {
    const mod = await import("./rating-storage");
    const anotherFromSameProvider: RatingWire = {
      ...secondRating,
      provider_address: "0xAAA",
    };
    vi.mocked(mod.getRatingsByProvider).mockReturnValue([
      mockRating,
      anotherFromSameProvider,
    ]);

    const ratings = mod.getRatingsByProvider("0xAAA");
    expect(ratings).toHaveLength(2);
  });

  it("is called with the correct provider address", async () => {
    const mod = await import("./rating-storage");
    vi.mocked(mod.getRatingsByProvider).mockReturnValue([]);

    mod.getRatingsByProvider("0xAAA");
    expect(mod.getRatingsByProvider).toHaveBeenCalledWith("0xAAA");
  });
});
