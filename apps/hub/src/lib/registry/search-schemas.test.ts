import { describe, it, expect } from "vitest";
import { searchServicesQuerySchema } from "./search-schemas";

describe("searchServicesQuerySchema", () => {
  it("parses valid defaults when no params provided", () => {
    const result = searchServicesQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.sort_by).toBe("relevance");
    expect(result.sort_order).toBe("asc");
  });

  it("parses all valid query parameters", () => {
    const result = searchServicesQuerySchema.parse({
      page: "2",
      page_size: "10",
      q: "image",
      service_type: "image_gen",
      min_price: "1.00",
      max_price: "100.00",
      provider_id: "prov-001",
      sort_by: "price",
      sort_order: "desc",
    });
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(10);
    expect(result.q).toBe("image");
    expect(result.service_type).toBe("image_gen");
    expect(result.min_price).toBe("1.00");
    expect(result.max_price).toBe("100.00");
    expect(result.provider_id).toBe("prov-001");
    expect(result.sort_by).toBe("price");
    expect(result.sort_order).toBe("desc");
  });

  it("rejects page < 1", () => {
    expect(() =>
      searchServicesQuerySchema.parse({ page: "0" }),
    ).toThrow();
  });

  it("rejects page_size > 100", () => {
    expect(() =>
      searchServicesQuerySchema.parse({ page_size: "101" }),
    ).toThrow();
  });

  it("rejects invalid sort_by value", () => {
    expect(() =>
      searchServicesQuerySchema.parse({ sort_by: "invalid" }),
    ).toThrow();
  });

  it("rejects search query longer than 200 chars", () => {
    expect(() =>
      searchServicesQuerySchema.parse({ q: "a".repeat(201) }),
    ).toThrow();
  });

  it("rejects negative min_price", () => {
    expect(() =>
      searchServicesQuerySchema.parse({ min_price: "-1" }),
    ).toThrow();
  });

  it("rejects non-numeric max_price", () => {
    expect(() =>
      searchServicesQuerySchema.parse({ max_price: "abc" }),
    ).toThrow();
  });
});
