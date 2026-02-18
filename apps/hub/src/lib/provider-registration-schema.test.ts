import { describe, it, expect } from "vitest";
import { providerRegistrationFormSchema } from "./provider-registration-schema";

const validData = {
  name: "Test Provider",
  description: "A test provider for IVXP protocol services",
  endpointUrl: "https://provider.example.com",
  services: [
    {
      serviceType: "text_echo",
      name: "Text Echo",
      description: "Echoes text back",
      priceUsdc: "1.50",
      estimatedTimeSeconds: 60,
    },
  ],
};

describe("providerRegistrationFormSchema", () => {
  it("accepts valid form data", () => {
    const result = providerRegistrationFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  // Provider name validation
  it("rejects name shorter than 3 characters", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      name: "AB",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  // Description validation
  it("rejects description shorter than 10 characters", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      description: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 500 characters", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  // Endpoint URL validation
  it("rejects invalid URL format", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      endpointUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-HTTPS URL", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      endpointUrl: "http://provider.example.com",
    });
    expect(result.success).toBe(false);
  });

  it("accepts localhost HTTP URL for local development", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      endpointUrl: "http://localhost:3001",
    });
    expect(result.success).toBe(true);
  });

  // Services validation
  it("rejects empty services array", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 services", () => {
    const services = Array.from({ length: 21 }, (_, i) => ({
      serviceType: `service_${i}`,
      name: `Service ${i}`,
      description: "A service",
      priceUsdc: "1.00",
      estimatedTimeSeconds: 60,
    }));
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services,
    });
    expect(result.success).toBe(false);
  });

  // Service type validation
  it("rejects non-snake_case service type", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], serviceType: "TextEcho" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects service type starting with number", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], serviceType: "1_echo" }],
    });
    expect(result.success).toBe(false);
  });

  // Price validation
  it("rejects invalid price format", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], priceUsdc: "1.5" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid decimal price", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], priceUsdc: "10.00" }],
    });
    expect(result.success).toBe(true);
  });

  // Estimated time validation
  it("rejects estimated time less than 1", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], estimatedTimeSeconds: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects estimated time greater than 7 days", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], estimatedTimeSeconds: 604801 }],
    });
    expect(result.success).toBe(false);
  });

  it("coerces string estimated time to number", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [{ ...validData.services[0], estimatedTimeSeconds: "60" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.services[0].estimatedTimeSeconds).toBe(60);
    }
  });

  // Multiple services
  it("accepts multiple valid services", () => {
    const result = providerRegistrationFormSchema.safeParse({
      ...validData,
      services: [
        validData.services[0],
        {
          serviceType: "image_gen",
          name: "Image Generator",
          description: "Generates images",
          priceUsdc: "5.00",
          estimatedTimeSeconds: 120,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
