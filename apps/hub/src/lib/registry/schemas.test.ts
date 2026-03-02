import { describe, it, expect } from "vitest";
import { claimProviderBodySchema, listProvidersQuerySchema, mineProvidersQuerySchema } from "./schemas";

describe("listProvidersQuerySchema", () => {
  it("parses valid defaults when no params provided", () => {
    const result = listProvidersQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.sort_by).toBe("name");
    expect(result.sort_order).toBe("asc");
    expect(result.include_unclaimed).toBe(false);
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
      registration_status: "claimed",
      include_unclaimed: "true",
    });
    expect(result.page).toBe(2);
    expect(result.page_size).toBe(10);
    expect(result.service_type).toBe("text_echo");
    expect(result.q).toBe("demo");
    expect(result.sort_by).toBe("service_count");
    expect(result.sort_order).toBe("desc");
    expect(result.status).toBe("active");
    expect(result.registration_status).toBe("claimed");
    expect(result.include_unclaimed).toBe(true);
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

  it("rejects invalid registration_status value", () => {
    expect(() => listProvidersQuerySchema.parse({ registration_status: "unknown" })).toThrow();
  });
});

describe("claimProviderBodySchema", () => {
  it("parses valid claim payload", () => {
    const parsed = claimProviderBodySchema.parse({
      endpoint_url: "https://provider.example.com",
      wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      message: "IVXP Provider Claim",
      signature: "0x" + "ab".repeat(65),
    });
    expect(parsed.endpoint_url).toBe("https://provider.example.com");
  });

  it("rejects invalid wallet address", () => {
    expect(() =>
      claimProviderBodySchema.parse({
        endpoint_url: "https://provider.example.com",
        wallet_address: "bad",
        message: "IVXP Provider Claim",
        signature: "0x" + "ab".repeat(65),
      }),
    ).toThrow();
  });
});

describe("mineProvidersQuerySchema", () => {
  it("parses query with defaults", () => {
    const parsed = mineProvidersQuerySchema.parse({
      wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
    });

    expect(parsed.page).toBe(1);
    expect(parsed.page_size).toBe(20);
  });

  it("rejects invalid wallet", () => {
    expect(() => mineProvidersQuerySchema.parse({ wallet_address: "bad" })).toThrow();
  });
});
