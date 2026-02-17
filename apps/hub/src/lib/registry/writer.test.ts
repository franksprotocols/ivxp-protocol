import { describe, it, expect } from "vitest";
import { isProviderRegistered, generateProviderId } from "./writer";
import type { RegistryProviderWire } from "./types";

const mockProviders: RegistryProviderWire[] = [
  {
    provider_id: "prov-001",
    provider_address: "0xAAA111BBB222CCC333DDD444EEE555FFF666AAA1",
    name: "Existing Provider",
    description: "Already registered",
    endpoint_url: "https://existing.example.com",
    services: [],
    status: "active",
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("isProviderRegistered", () => {
  it("returns true when provider_address exists (exact match)", () => {
    expect(
      isProviderRegistered(
        mockProviders,
        "0xAAA111BBB222CCC333DDD444EEE555FFF666AAA1",
      ),
    ).toBe(true);
  });

  it("returns true for case-insensitive match", () => {
    expect(
      isProviderRegistered(
        mockProviders,
        "0xaaa111bbb222ccc333ddd444eee555fff666aaa1",
      ),
    ).toBe(true);
  });

  it("returns false when provider_address does not exist", () => {
    expect(
      isProviderRegistered(
        mockProviders,
        "0x0000000000000000000000000000000000000001",
      ),
    ).toBe(false);
  });
});

describe("generateProviderId", () => {
  it("generates a string starting with prov-", () => {
    const id = generateProviderId();
    expect(id).toMatch(/^prov-[a-f0-9-]+$/);
  });

  it("generates unique IDs", () => {
    const id1 = generateProviderId();
    const id2 = generateProviderId();
    expect(id1).not.toBe(id2);
  });
});
