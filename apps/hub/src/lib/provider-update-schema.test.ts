import { describe, it, expect } from "vitest";
import { providerUpdateFormSchema } from "./provider-update-schema";

describe("providerUpdateFormSchema", () => {
  const validData = {
    name: "Test Provider",
    description: "A valid description that is long enough",
    endpointUrl: "https://example.com",
  };

  it("accepts valid update data", () => {
    const result = providerUpdateFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 3 characters", () => {
    const result = providerUpdateFormSchema.safeParse({ ...validData, name: "AB" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("at least 3");
    }
  });

  it("rejects name longer than 100 characters", () => {
    const result = providerUpdateFormSchema.safeParse({
      ...validData,
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects description shorter than 10 characters", () => {
    const result = providerUpdateFormSchema.safeParse({
      ...validData,
      description: "Short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("at least 10");
    }
  });

  it("rejects description longer than 500 characters", () => {
    const result = providerUpdateFormSchema.safeParse({
      ...validData,
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-HTTPS endpoint URL", () => {
    const result = providerUpdateFormSchema.safeParse({
      ...validData,
      endpointUrl: "http://example.com",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("HTTPS");
    }
  });

  it("accepts localhost HTTP endpoint URL for local development", () => {
    const result = providerUpdateFormSchema.safeParse({
      ...validData,
      endpointUrl: "http://localhost:3001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL format", () => {
    const result = providerUpdateFormSchema.safeParse({
      ...validData,
      endpointUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = providerUpdateFormSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
    }
  });
});
