import { describe, it, expect } from "vitest";
import { getServiceByType, getAllServiceTypes, formatPrice, formatServiceName } from "./services";

describe("getServiceByType", () => {
  it("returns service detail for a valid service type", () => {
    const result = getServiceByType("text_echo");
    expect(result).not.toBeNull();
    expect(result?.service_type).toBe("text_echo");
    expect(result?.input_schema).toBeDefined();
    expect(result?.output_schema).toBeDefined();
  });

  it("returns null for an unknown service type", () => {
    expect(getServiceByType("nonexistent_service")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getServiceByType("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(getServiceByType("   ")).toBeNull();
  });

  it("returns service with all expected fields", () => {
    const result = getServiceByType("text_echo");
    expect(result).toMatchObject({
      service_type: "text_echo",
      description: expect.any(String),
      price_usdc: expect.any(String),
      provider_address: expect.any(String),
      input_schema: expect.objectContaining({ type: "object" }),
      output_schema: expect.objectContaining({ type: expect.any(String) }),
    });
  });
});

describe("getAllServiceTypes", () => {
  it("returns an array of service type strings", () => {
    const types = getAllServiceTypes();
    expect(types.length).toBeGreaterThan(0);
    expect(types).toContain("text_echo");
    expect(types).toContain("image_gen");
  });

  it("returns unique values", () => {
    const types = getAllServiceTypes();
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });
});

describe("formatPrice", () => {
  it("formats a valid price string", () => {
    expect(formatPrice("1.50")).toBe("1.50 USDC");
  });

  it("adds trailing zeros", () => {
    expect(formatPrice("1")).toBe("1.00 USDC");
  });

  it("handles zero", () => {
    expect(formatPrice("0")).toBe("0.00 USDC");
  });

  it("returns 0.00 USDC for invalid input", () => {
    expect(formatPrice("not-a-number")).toBe("0.00 USDC");
  });

  it("formats small prices", () => {
    expect(formatPrice("0.10")).toBe("0.10 USDC");
  });
});

describe("formatServiceName", () => {
  it("converts underscore-separated to title case", () => {
    expect(formatServiceName("text_echo")).toBe("Text Echo");
  });

  it("handles single word", () => {
    expect(formatServiceName("ping")).toBe("Ping");
  });

  it("returns empty string for empty input", () => {
    expect(formatServiceName("")).toBe("");
  });

  it("handles consecutive underscores", () => {
    expect(formatServiceName("text__echo")).toBe("Text Echo");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(formatServiceName("   ")).toBe("");
  });
});
