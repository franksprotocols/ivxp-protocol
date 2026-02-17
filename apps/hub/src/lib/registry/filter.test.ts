import { describe, it, expect } from "vitest";
import {
  filterByServiceType,
  filterBySearchQuery,
  filterByStatus,
  sortProviders,
  paginateProviders,
  queryProviders,
} from "./filter";
import { mockProviders } from "./test-fixtures";

describe("filterByServiceType", () => {
  it("returns providers offering the specified service type", () => {
    const result = filterByServiceType(mockProviders, "text_echo");
    expect(result).toHaveLength(1);
    expect(result[0].provider_id).toBe("prov-001");
  });

  it("is case-insensitive", () => {
    const result = filterByServiceType(mockProviders, "TEXT_ECHO");
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no match", () => {
    const result = filterByServiceType(mockProviders, "nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("filterBySearchQuery", () => {
  it("matches provider name", () => {
    const result = filterBySearchQuery(mockProviders, "Alpha");
    expect(result).toHaveLength(1);
    expect(result[0].provider_id).toBe("prov-001");
  });

  it("matches provider description", () => {
    const result = filterBySearchQuery(mockProviders, "research");
    expect(result).toHaveLength(1);
    expect(result[0].provider_id).toBe("prov-002");
  });

  it("matches service name or description", () => {
    const result = filterBySearchQuery(mockProviders, "code review");
    expect(result).toHaveLength(1);
    expect(result[0].provider_id).toBe("prov-002");
  });

  it("is case-insensitive", () => {
    const result = filterBySearchQuery(mockProviders, "ALPHA");
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no match", () => {
    const result = filterBySearchQuery(mockProviders, "zzzzz");
    expect(result).toHaveLength(0);
  });
});

describe("filterByStatus", () => {
  it("returns only active providers", () => {
    const result = filterByStatus(mockProviders, "active");
    expect(result).toHaveLength(2);
  });

  it("returns only inactive providers", () => {
    const result = filterByStatus(mockProviders, "inactive");
    expect(result).toHaveLength(1);
    expect(result[0].provider_id).toBe("prov-003");
  });
});

describe("sortProviders", () => {
  it("sorts by name ascending", () => {
    const result = sortProviders(mockProviders, "name", "asc");
    expect(result[0].name).toBe("Alpha Provider");
    expect(result[2].name).toBe("Gamma Offline");
  });

  it("sorts by name descending", () => {
    const result = sortProviders(mockProviders, "name", "desc");
    expect(result[0].name).toBe("Gamma Offline");
  });

  it("sorts by service_count ascending", () => {
    const result = sortProviders(mockProviders, "service_count", "asc");
    expect(result[0].services).toHaveLength(1);
    expect(result[2].services).toHaveLength(2);
  });

  it("does not mutate the original array", () => {
    const original = [...mockProviders];
    sortProviders(mockProviders, "name", "desc");
    expect(mockProviders).toEqual(original);
  });

  it("sorts by service_count descending", () => {
    const result = sortProviders(mockProviders, "service_count", "desc");
    expect(result[0].services).toHaveLength(2);
    expect(result[2].services).toHaveLength(1);
  });

  it("handles empty array", () => {
    const result = sortProviders([], "name", "asc");
    expect(result).toHaveLength(0);
  });

  it("handles single item array", () => {
    const single = [mockProviders[0]];
    const result = sortProviders(single, "name", "asc");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockProviders[0]);
  });
});

describe("paginateProviders", () => {
  it("returns correct page", () => {
    const { items, total } = paginateProviders(mockProviders, 1, 2);
    expect(items).toHaveLength(2);
    expect(total).toBe(3);
  });

  it("returns second page", () => {
    const { items, total } = paginateProviders(mockProviders, 2, 2);
    expect(items).toHaveLength(1);
    expect(total).toBe(3);
  });

  it("returns empty for out-of-range page", () => {
    const { items, total } = paginateProviders(mockProviders, 10, 2);
    expect(items).toHaveLength(0);
    expect(total).toBe(3);
  });
});

describe("queryProviders", () => {
  it("applies all filters in sequence", () => {
    const { items, total } = queryProviders(mockProviders, {
      page: 1,
      page_size: 20,
      status: "active",
      service_type: "research",
      q: undefined,
      sort_by: "name",
      sort_order: "asc",
    });
    expect(items).toHaveLength(1);
    expect(total).toBe(1);
    expect(items[0].provider_id).toBe("prov-002");
  });

  it("returns all when no filters applied", () => {
    const { items, total } = queryProviders(mockProviders, {
      page: 1,
      page_size: 20,
      sort_by: "name",
      sort_order: "asc",
    });
    expect(items).toHaveLength(3);
    expect(total).toBe(3);
  });

  it("combines search and pagination", () => {
    const { items, total } = queryProviders(mockProviders, {
      page: 1,
      page_size: 1,
      q: "provider",
      sort_by: "name",
      sort_order: "asc",
    });
    expect(items).toHaveLength(1);
    expect(total).toBe(2);
  });
});
