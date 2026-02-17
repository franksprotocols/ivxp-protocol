import { describe, it, expect } from "vitest";
import { buildSearchUrl } from "./use-service-search";

describe("buildSearchUrl", () => {
  it("returns base URL when no params provided", () => {
    const url = buildSearchUrl({});
    expect(url).toBe("/api/registry/services/search");
  });

  it("includes q parameter", () => {
    const url = buildSearchUrl({ q: "image" });
    expect(url).toContain("q=image");
  });

  it("includes service_type parameter", () => {
    const url = buildSearchUrl({ serviceType: "text_echo" });
    expect(url).toContain("service_type=text_echo");
  });

  it("includes price range parameters", () => {
    const url = buildSearchUrl({ minPrice: "1.00", maxPrice: "5.00" });
    expect(url).toContain("min_price=1.00");
    expect(url).toContain("max_price=5.00");
  });

  it("includes provider_id parameter", () => {
    const url = buildSearchUrl({ providerId: "prov-001" });
    expect(url).toContain("provider_id=prov-001");
  });

  it("includes sort parameters", () => {
    const url = buildSearchUrl({ sortBy: "price", sortOrder: "desc" });
    expect(url).toContain("sort_by=price");
    expect(url).toContain("sort_order=desc");
  });

  it("includes pagination parameters", () => {
    const url = buildSearchUrl({ page: 2, pageSize: 10 });
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=10");
  });

  it("omits undefined parameters", () => {
    const url = buildSearchUrl({ q: "test" });
    expect(url).not.toContain("service_type");
    expect(url).not.toContain("min_price");
    expect(url).not.toContain("max_price");
    expect(url).not.toContain("provider_id");
  });
});
