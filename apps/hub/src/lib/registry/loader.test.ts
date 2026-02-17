import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadProviders, clearProviderCache } from "./loader";

describe("loadProviders", () => {
  beforeEach(() => {
    clearProviderCache();
  });

  afterEach(() => {
    clearProviderCache();
  });

  it("loads providers from JSON file", () => {
    const providers = loadProviders();
    expect(providers).toBeInstanceOf(Array);
    expect(providers.length).toBeGreaterThan(0);
  });

  it("returns cached providers on subsequent calls", () => {
    const first = loadProviders();
    const second = loadProviders();
    expect(first).toBe(second);
  });

  it("validates provider structure", () => {
    const providers = loadProviders();
    const provider = providers[0];

    expect(provider).toHaveProperty("provider_id");
    expect(provider).toHaveProperty("provider_address");
    expect(provider).toHaveProperty("name");
    expect(provider).toHaveProperty("description");
    expect(provider).toHaveProperty("endpoint_url");
    expect(provider).toHaveProperty("services");
    expect(provider).toHaveProperty("status");
    expect(provider).toHaveProperty("registered_at");
    expect(provider).toHaveProperty("updated_at");
  });

  it("validates service structure", () => {
    const providers = loadProviders();
    const service = providers[0].services[0];

    expect(service).toHaveProperty("service_type");
    expect(service).toHaveProperty("name");
    expect(service).toHaveProperty("description");
    expect(service).toHaveProperty("price_usdc");
    expect(service).toHaveProperty("estimated_time_seconds");
  });

  it("loads providers with correct status values", () => {
    const providers = loadProviders();
    const statuses = providers.map((p) => p.status);

    for (const status of statuses) {
      expect(["active", "inactive"]).toContain(status);
    }
  });
});

describe("clearProviderCache", () => {
  it("clears the cache so next load reads from file", () => {
    const first = loadProviders();
    clearProviderCache();
    const second = loadProviders();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
