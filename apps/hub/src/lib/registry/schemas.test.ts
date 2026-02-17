import { describe, it, expect } from "vitest";
import { listProvidersQuerySchema } from "./schemas";

describe("listProvidersQuerySchema", () => {
  it("parses valid defaults when no params provided", () => {
    const result = listProvidersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.sort_by).toBe("name");
    expect(result.sort_order).toBe("asc");
  });

  it("parses valid query parameters", () => {
    const result = listProvidersQuerySchema.parse({
      page: "2",
      page_size: "10",
      service_type: "text_echo",
      q: "demo",
      sort_by: "service_count",
      sort_order: "desc",
      status: "active",
    });
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(10);
    expect(result.service_type).toBe("text_echo");
    expect(result.q).toBe("demo");
    expect(result.sort_by).toBe("service_count");
    expect(result.sort_order).toBe("desc");
    expect(result.status).toBe("active");
  });

  it("rejects page < 1", () => {
    expect(() => listProvidersQuerySchema.parse({ page: "0" })).toThrow();
  });

  it("rejects negative page", () => {
    expect(() => listProvidersQuerySchema.parse({ page: "-1" })).toThrow();
  });

  it("rejects page_size > 100", () => {
    expect(() => listProvidersQuerySchema.parse({ page_size: "101" })).toThrow();
  });

  it("rejects page_size < 1", () => {
    expect(() => listProvidersQuerySchema.parse({ page_size: "0" })).toThrow();
  });

  it("rejects invalid sort_by value", () => {
    expect(() => listProvidersQuerySchema.parse({ sort_by: "invalid" })).toThrow();
  });

  it("rejects invalid sort_order value", () => {
    expect(() => listProvidersQuerySchema.parse({ sort_order: "random" })).toThrow();
  });

  it("rejects search query longer than 200 chars", () => {
    expect(() => listProvidersQuerySchema.parse({ q: "a".repeat(201) })).toThrow();
  });

  it("accepts search query of exactly 200 chars", () => {
    const result = listProvidersQuerySchema.parse({ q: "a".repeat(200) });
    expect(result.q).toHaveLength(200);
  });

  it("rejects invalid status value", () => {
    expect(() => listProvidersQuerySchema.parse({ status: "unknown" })).toThrow();
  });
});
