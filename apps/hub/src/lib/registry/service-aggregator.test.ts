import { describe, it, expect, beforeEach } from "vitest";
import { flattenProviderServices, clearAggregatorCache } from "./service-aggregator";
import type { RegistryProviderWire } from "./types";

const mockProviders: RegistryProviderWire[] = [
  {
    provider_id: "prov-001",
    provider_address: "0xAAA",
    name: "Verified Provider",
    description: "A verified provider",
    endpoint_url: "https://verified.example.com",
    services: [
      {
        service_type: "text_echo",
        name: "Text Echo",
        description: "Echoes text",
        price_usdc: "0.10",
        estimated_time_seconds: 5,
      },
    ],
    status: "active",
    verification_status: "verified",
    last_verified_at: "2025-01-15T00:00:00Z",
    last_check_at: "2025-01-15T00:00:00Z",
    consecutive_failures: 0,
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    provider_id: "prov-002",
    provider_address: "0xBBB",
    name: "Unresponsive Provider",
    description: "An unresponsive provider",
    endpoint_url: "https://unresponsive.example.com",
    services: [
      {
        service_type: "research",
        name: "Research",
        description: "Research service",
        price_usdc: "50.00",
        estimated_time_seconds: 28800,
      },
    ],
    status: "active",
    verification_status: "unresponsive",
    last_verified_at: null,
    last_check_at: "2025-01-15T00:00:00Z",
    consecutive_failures: 3,
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    provider_id: "prov-003",
    provider_address: "0xCCC",
    name: "Inactive Provider",
    description: "An inactive provider",
    endpoint_url: "https://inactive.example.com",
    services: [
      {
        service_type: "consultation",
        name: "Consultation",
        description: "Consultation service",
        price_usdc: "25.00",
        estimated_time_seconds: 7200,
      },
    ],
    status: "inactive",
    verification_status: "verified",
    last_verified_at: "2025-01-15T00:00:00Z",
    last_check_at: "2025-01-15T00:00:00Z",
    consecutive_failures: 0,
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

beforeEach(() => {
  clearAggregatorCache();
});

describe("flattenProviderServices", () => {
  it("only includes services from verified active providers", () => {
    const result = flattenProviderServices(mockProviders);
    expect(result).toHaveLength(1);
    expect(result[0].provider_id).toBe("prov-001");
    expect(result[0].service_type).toBe("text_echo");
  });

  it("excludes unresponsive providers", () => {
    const result = flattenProviderServices(mockProviders);
    const providerIds = result.map((s) => s.provider_id);
    expect(providerIds).not.toContain("prov-002");
  });

  it("excludes inactive providers even if verified", () => {
    const result = flattenProviderServices(mockProviders);
    const providerIds = result.map((s) => s.provider_id);
    expect(providerIds).not.toContain("prov-003");
  });

  it("attaches provider metadata to each service", () => {
    const result = flattenProviderServices(mockProviders);
    expect(result[0].provider_name).toBe("Verified Provider");
    expect(result[0].provider_address).toBe("0xAAA");
    expect(result[0].provider_endpoint_url).toBe("https://verified.example.com");
  });

  it("returns empty array when no verified active providers", () => {
    const result = flattenProviderServices([mockProviders[1], mockProviders[2]]);
    expect(result).toHaveLength(0);
  });
});
