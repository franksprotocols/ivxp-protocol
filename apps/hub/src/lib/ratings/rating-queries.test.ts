import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RatingWire } from "./types";
import {
  calculateAverage,
  calculateDistribution,
  sortRatings,
  paginateRatings,
  queryProviderRatings,
} from "./rating-queries";

// Mock rating-storage so we don't touch the filesystem
vi.mock("./rating-storage", () => ({
  loadRatings: vi.fn(),
}));

import { loadRatings } from "./rating-storage";

const mockLoadRatings = vi.mocked(loadRatings);

function makeRating(overrides: Partial<RatingWire> = {}): RatingWire {
  return {
    rating_id: "r-1",
    order_id: "o-1",
    provider_address: "0xAAA",
    service_type: "text_echo",
    client_address: "0xBBB",
    stars: 4,
    review_text: "Good service",
    signature: "0xsig",
    created_at: 1700000000000,
    ...overrides,
  };
}

describe("calculateAverage", () => {
  it("returns 0 for empty array", () => {
    expect(calculateAverage([])).toBe(0);
  });

  it("calculates average rounded to 1 decimal", () => {
    const ratings = [
      makeRating({ stars: 5 }),
      makeRating({ stars: 4 }),
      makeRating({ stars: 3 }),
    ];
    // (5+4+3)/3 = 4.0
    expect(calculateAverage(ratings)).toBe(4);
  });

  it("rounds correctly for non-integer averages", () => {
    const ratings = [
      makeRating({ stars: 5 }),
      makeRating({ stars: 4 }),
      makeRating({ stars: 4 }),
    ];
    // (5+4+4)/3 = 4.333... → 4.3
    expect(calculateAverage(ratings)).toBe(4.3);
  });

  it("handles single rating", () => {
    expect(calculateAverage([makeRating({ stars: 2 })])).toBe(2);
  });
});

describe("calculateDistribution", () => {
  it("returns all zeros for empty array", () => {
    expect(calculateDistribution([])).toEqual({
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    });
  });

  it("counts ratings per star level", () => {
    const ratings = [
      makeRating({ stars: 5 }),
      makeRating({ stars: 5 }),
      makeRating({ stars: 3 }),
      makeRating({ stars: 1 }),
    ];
    expect(calculateDistribution(ratings)).toEqual({
      1: 1, 2: 0, 3: 1, 4: 0, 5: 2,
    });
  });
});

describe("sortRatings", () => {
  const ratings = [
    makeRating({ stars: 3, created_at: 1000 }),
    makeRating({ stars: 5, created_at: 3000 }),
    makeRating({ stars: 1, created_at: 2000 }),
  ];

  it("sorts by newest first", () => {
    const sorted = sortRatings(ratings, "newest");
    expect(sorted.map((r) => r.created_at)).toEqual([3000, 2000, 1000]);
  });

  it("sorts by oldest first", () => {
    const sorted = sortRatings(ratings, "oldest");
    expect(sorted.map((r) => r.created_at)).toEqual([1000, 2000, 3000]);
  });

  it("sorts by highest rating first", () => {
    const sorted = sortRatings(ratings, "highest");
    expect(sorted.map((r) => r.stars)).toEqual([5, 3, 1]);
  });

  it("sorts by lowest rating first", () => {
    const sorted = sortRatings(ratings, "lowest");
    expect(sorted.map((r) => r.stars)).toEqual([1, 3, 5]);
  });

  it("does not mutate original array", () => {
    const original = [...ratings];
    sortRatings(ratings, "newest");
    expect(ratings).toEqual(original);
  });
});

describe("paginateRatings", () => {
  const ratings = Array.from({ length: 25 }, (_, i) =>
    makeRating({ rating_id: `r-${i}`, created_at: i }),
  );

  it("returns first page", () => {
    const page = paginateRatings(ratings, 1, 10);
    expect(page).toHaveLength(10);
    expect(page[0].rating_id).toBe("r-0");
  });

  it("returns second page", () => {
    const page = paginateRatings(ratings, 2, 10);
    expect(page).toHaveLength(10);
    expect(page[0].rating_id).toBe("r-10");
  });

  it("returns partial last page", () => {
    const page = paginateRatings(ratings, 3, 10);
    expect(page).toHaveLength(5);
  });

  it("returns empty for out-of-range page", () => {
    const page = paginateRatings(ratings, 10, 10);
    expect(page).toHaveLength(0);
  });
});

describe("queryProviderRatings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by provider address (case-insensitive)", () => {
    mockLoadRatings.mockReturnValue([
      makeRating({ provider_address: "0xAAA", stars: 5 }),
      makeRating({ provider_address: "0xBBB", stars: 3 }),
      makeRating({ provider_address: "0xaaa", stars: 4 }),
    ]);

    const result = queryProviderRatings("0xAAA");
    expect(result.rating_count).toBe(2);
    expect(result.average_rating).toBe(4.5);
    expect(result.provider_address).toBe("0xAAA");
  });

  it("returns empty result for unknown provider", () => {
    mockLoadRatings.mockReturnValue([
      makeRating({ provider_address: "0xAAA" }),
    ]);

    const result = queryProviderRatings("0xZZZ");
    expect(result.rating_count).toBe(0);
    expect(result.average_rating).toBe(0);
    expect(result.ratings).toHaveLength(0);
  });

  it("applies pagination", () => {
    const ratings = Array.from({ length: 15 }, (_, i) =>
      makeRating({
        rating_id: `r-${i}`,
        provider_address: "0xAAA",
        created_at: i * 1000,
      }),
    );
    mockLoadRatings.mockReturnValue(ratings);

    const result = queryProviderRatings("0xAAA", {
      page: 2,
      limit: 5,
    });
    expect(result.ratings).toHaveLength(5);
    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
  });

  it("includes rating distribution", () => {
    mockLoadRatings.mockReturnValue([
      makeRating({ provider_address: "0xAAA", stars: 5 }),
      makeRating({ provider_address: "0xAAA", stars: 5 }),
      makeRating({ provider_address: "0xAAA", stars: 3 }),
    ]);

    const result = queryProviderRatings("0xAAA");
    expect(result.rating_distribution).toEqual({
      1: 0, 2: 0, 3: 1, 4: 0, 5: 2,
    });
  });
});
