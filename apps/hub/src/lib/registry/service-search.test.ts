import { describe, it, expect } from "vitest";
import {
  computeRelevanceScore,
  searchServicesByText,
  filterServicesByType,
  filterServicesByPriceRange,
  filterServicesByProvider,
  sortServices,
  paginateServices,
  queryServices,
} from "./service-search";
import type { SearchServiceResultWire } from "./types";

const mockServices: SearchServiceResultWire[] = [
  {
    service_type: "text_echo",
    name: "Text Echo",
    description: "Echoes back the input text for testing",
    price_usdc: "0.10",
    estimated_time_seconds: 5,
    provider_id: "prov-001",
    provider_name: "IVXP Demo Provider",
    provider_address: "0xAAA",
    provider_endpoint_url: "https://demo.example.com",
  },
  {
    service_type: "image_gen",
    name: "Image Generation",
    description: "Generates images from text prompts",
    price_usdc: "1.50",
    estimated_time_seconds: 10,
    provider_id: "prov-001",
    provider_name: "IVXP Demo Provider",
    provider_address: "0xAAA",
    provider_endpoint_url: "https://demo.example.com",
  },
  {
    service_type: "research",
    name: "Deep Research",
    description: "Comprehensive research on any topic",
    price_usdc: "50.00",
    estimated_time_seconds: 28800,
    provider_id: "prov-002",
    provider_name: "Research Agent",
    provider_address: "0xBBB",
    provider_endpoint_url: "https://research.example.com",
  },
  {
    service_type: "code_review",
    name: "Code Review",
    description: "Detailed code review with suggestions",
    price_usdc: "50.00",
    estimated_time_seconds: 43200,
    provider_id: "prov-002",
    provider_name: "Research Agent",
    provider_address: "0xBBB",
    provider_endpoint_url: "https://research.example.com",
  },
];

describe("computeRelevanceScore", () => {
  it("returns highest score for exact name match", () => {
    const score = computeRelevanceScore(mockServices[0], "Text Echo");
    expect(score).toBe(100);
  });

  it("returns partial score for name substring match", () => {
    const score = computeRelevanceScore(mockServices[0], "Echo");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("returns score for service_type match", () => {
    const score = computeRelevanceScore(mockServices[0], "text_echo");
    expect(score).toBeGreaterThan(0);
  });

  it("returns score for description match", () => {
    const score = computeRelevanceScore(mockServices[2], "comprehensive");
    expect(score).toBeGreaterThan(0);
  });

  it("returns 0 for no match", () => {
    const score = computeRelevanceScore(mockServices[0], "zzzzz");
    expect(score).toBe(0);
  });
});

describe("searchServicesByText", () => {
  it("returns matching services with relevance scores", () => {
    const result = searchServicesByText(mockServices, "image");
    expect(result).toHaveLength(1);
    expect(result[0].service_type).toBe("image_gen");
    expect(result[0].relevance_score).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    const result = searchServicesByText(mockServices, "IMAGE");
    expect(result).toHaveLength(1);
  });

  it("returns empty array for no match", () => {
    const result = searchServicesByText(mockServices, "zzzzz");
    expect(result).toHaveLength(0);
  });

  it("matches across provider name", () => {
    const result = searchServicesByText(mockServices, "Research Agent");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe("filterServicesByType", () => {
  it("returns services matching the type", () => {
    const result = filterServicesByType(mockServices, "text_echo");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Text Echo");
  });

  it("is case-insensitive", () => {
    const result = filterServicesByType(mockServices, "TEXT_ECHO");
    expect(result).toHaveLength(1);
  });

  it("returns empty for non-matching type", () => {
    const result = filterServicesByType(mockServices, "nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("filterServicesByPriceRange", () => {
  it("filters by min price", () => {
    const result = filterServicesByPriceRange(mockServices, "1.00");
    expect(result).toHaveLength(3);
  });

  it("filters by max price", () => {
    const result = filterServicesByPriceRange(mockServices, undefined, "2.00");
    expect(result).toHaveLength(2);
  });

  it("filters by both min and max price", () => {
    const result = filterServicesByPriceRange(mockServices, "1.00", "2.00");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Image Generation");
  });

  it("returns all when no range specified", () => {
    const result = filterServicesByPriceRange(mockServices);
    expect(result).toHaveLength(4);
  });
});

describe("filterServicesByProvider", () => {
  it("returns services from specified provider", () => {
    const result = filterServicesByProvider(mockServices, "prov-002");
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.provider_id === "prov-002")).toBe(true);
  });

  it("returns empty for non-matching provider", () => {
    const result = filterServicesByProvider(mockServices, "prov-999");
    expect(result).toHaveLength(0);
  });
});

describe("sortServices", () => {
  it("sorts by name ascending", () => {
    const result = sortServices(mockServices, "name", "asc");
    expect(result[0].name).toBe("Code Review");
    expect(result[3].name).toBe("Text Echo");
  });

  it("sorts by name descending", () => {
    const result = sortServices(mockServices, "name", "desc");
    expect(result[0].name).toBe("Text Echo");
  });

  it("sorts by price ascending", () => {
    const result = sortServices(mockServices, "price", "asc");
    expect(result[0].price_usdc).toBe("0.10");
    expect(result[3].price_usdc).toBe("50.00");
  });

  it("sorts by price descending", () => {
    const result = sortServices(mockServices, "price", "desc");
    expect(result[0].price_usdc).toBe("50.00");
  });
});

describe("paginateServices", () => {
  it("returns correct page", () => {
    const { items, total } = paginateServices(mockServices, 1, 2);
    expect(items).toHaveLength(2);
    expect(total).toBe(4);
  });

  it("returns second page", () => {
    const { items, total } = paginateServices(mockServices, 2, 2);
    expect(items).toHaveLength(2);
    expect(total).toBe(4);
  });

  it("returns empty for out-of-range page", () => {
    const { items, total } = paginateServices(mockServices, 10, 2);
    expect(items).toHaveLength(0);
    expect(total).toBe(4);
  });
});

describe("queryServices", () => {
  it("applies text search and returns relevant results", () => {
    const { items } = queryServices(mockServices, {
      page: 1,
      page_size: 20,
      q: "echo",
      sort_by: "relevance",
      sort_order: "asc",
    });
    expect(items).toHaveLength(1);
    expect(items[0].service_type).toBe("text_echo");
  });

  it("applies combined filters", () => {
    const { items, total } = queryServices(mockServices, {
      page: 1,
      page_size: 20,
      service_type: "research",
      provider_id: "prov-002",
      sort_by: "name",
      sort_order: "asc",
    });
    expect(items).toHaveLength(1);
    expect(total).toBe(1);
    expect(items[0].name).toBe("Deep Research");
  });

  it("applies price range filter", () => {
    const { items } = queryServices(mockServices, {
      page: 1,
      page_size: 20,
      min_price: "1.00",
      max_price: "2.00",
      sort_by: "name",
      sort_order: "asc",
    });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Image Generation");
  });
});
