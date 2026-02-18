import { describe, it, expect, vi } from "vitest";
import {
  verifySingleProvider,
  verifyAllProviders,
  determineNewStatus,
  applyVerificationResult,
  validateStatusTransition,
} from "./verification-service";
import type { RegistryProviderWire, VerificationResult } from "./types";

function createMockProvider(overrides: Partial<RegistryProviderWire> = {}): RegistryProviderWire {
  return {
    provider_id: "prov-001",
    provider_address: "0xAAA",
    name: "Test Provider",
    description: "A test provider",
    endpoint_url: "https://test.example.com",
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
    registered_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    verification_status: "pending",
    last_verified_at: null,
    last_check_at: null,
    consecutive_failures: 0,
    ...overrides,
  };
}

describe("verifySingleProvider", () => {
  it("marks provider as verified when catalog responds with valid body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ services: [{ service_type: "text_echo" }] }),
    });

    const provider = createMockProvider();
    const result = await verifySingleProvider(provider, { fetchFn: mockFetch });

    expect(result.reachable).toBe(true);
    expect(result.newStatus).toBe("verified");
    expect(result.error).toBeNull();
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.example.com/ivxp/catalog",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("marks provider as failed when catalog returns non-2xx", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const provider = createMockProvider();
    const result = await verifySingleProvider(provider, { fetchFn: mockFetch });

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("status 503");
  });

  it("marks provider as failed when response body is invalid", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: "body" }),
    });

    const provider = createMockProvider();
    const result = await verifySingleProvider(provider, { fetchFn: mockFetch });

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("missing required 'services' array");
  });

  it("handles network errors gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const provider = createMockProvider();
    const result = await verifySingleProvider(provider, { fetchFn: mockFetch });

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("handles timeout via AbortController", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const error = new DOMException("The operation was aborted", "AbortError");
      return Promise.reject(error);
    });

    const provider = createMockProvider();
    const result = await verifySingleProvider(provider, {
      fetchFn: mockFetch,
      timeoutMs: 100,
    });

    expect(result.reachable).toBe(false);
    expect(result.error).toContain("did not respond within");
  });

  it("strips trailing slash from endpoint_url", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ services: [] }),
    });

    const provider = createMockProvider({ endpoint_url: "https://test.example.com/" });
    await verifySingleProvider(provider, { fetchFn: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.example.com/ivxp/catalog",
      expect.any(Object),
    );
  });
});

describe("determineNewStatus", () => {
  it("returns 'verified' when reachable", () => {
    const status = determineNewStatus({
      reachable: true,
      previousStatus: "unresponsive",
      consecutiveFailures: 5,
      gracePeriodFailures: 3,
    });
    expect(status).toBe("verified");
  });

  it("keeps previous status during grace period (1 failure)", () => {
    const status = determineNewStatus({
      reachable: false,
      previousStatus: "verified",
      consecutiveFailures: 0,
      gracePeriodFailures: 3,
    });
    expect(status).toBe("verified");
  });

  it("keeps previous status during grace period (2 failures)", () => {
    const status = determineNewStatus({
      reachable: false,
      previousStatus: "verified",
      consecutiveFailures: 1,
      gracePeriodFailures: 3,
    });
    expect(status).toBe("verified");
  });

  it("returns 'unresponsive' after grace period exceeded (3 failures)", () => {
    const status = determineNewStatus({
      reachable: false,
      previousStatus: "verified",
      consecutiveFailures: 2,
      gracePeriodFailures: 3,
    });
    expect(status).toBe("unresponsive");
  });

  it("returns 'unresponsive' when already past grace period", () => {
    const status = determineNewStatus({
      reachable: false,
      previousStatus: "unresponsive",
      consecutiveFailures: 10,
      gracePeriodFailures: 3,
    });
    expect(status).toBe("unresponsive");
  });

  it("returns 'verified' when previously unresponsive but now reachable (recovery)", () => {
    const status = determineNewStatus({
      reachable: true,
      previousStatus: "unresponsive",
      consecutiveFailures: 10,
      gracePeriodFailures: 3,
    });
    expect(status).toBe("verified");
  });
});

describe("validateStatusTransition", () => {
  it("accepts valid status transition parameters", () => {
    expect(() =>
      validateStatusTransition({
        reachable: true,
        previousStatus: "pending",
        consecutiveFailures: 0,
        gracePeriodFailures: 3,
      }),
    ).not.toThrow();
  });

  it("throws on invalid previousStatus", () => {
    expect(() =>
      validateStatusTransition({
        reachable: true,
        previousStatus: "invalid" as unknown as "pending" | "verified" | "unresponsive",
        consecutiveFailures: 0,
        gracePeriodFailures: 3,
      }),
    ).toThrow("Invalid previousStatus");
  });

  it("throws on negative consecutiveFailures", () => {
    expect(() =>
      validateStatusTransition({
        reachable: false,
        previousStatus: "pending",
        consecutiveFailures: -1,
        gracePeriodFailures: 3,
      }),
    ).toThrow("consecutiveFailures must be a non-negative integer");
  });

  it("throws on non-integer consecutiveFailures", () => {
    expect(() =>
      validateStatusTransition({
        reachable: false,
        previousStatus: "pending",
        consecutiveFailures: 1.5,
        gracePeriodFailures: 3,
      }),
    ).toThrow("consecutiveFailures must be a non-negative integer");
  });

  it("throws on invalid gracePeriodFailures", () => {
    expect(() =>
      validateStatusTransition({
        reachable: false,
        previousStatus: "pending",
        consecutiveFailures: 0,
        gracePeriodFailures: 0,
      }),
    ).toThrow("gracePeriodFailures must be a positive integer");
  });
});

describe("verifyAllProviders", () => {
  it("verifies only active providers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ services: [] }),
    });

    const providers = [
      createMockProvider({ provider_id: "prov-001", status: "active" }),
      createMockProvider({ provider_id: "prov-002", status: "inactive" }),
      createMockProvider({ provider_id: "prov-003", status: "active" }),
    ];

    const results = await verifyAllProviders(providers, { fetchFn: mockFetch });

    expect(results).toHaveLength(2);
    expect(results[0].providerId).toBe("prov-001");
    expect(results[1].providerId).toBe("prov-003");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns results for all providers even if some fail", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ services: [] }),
        });
      }
      return Promise.reject(new Error("Network error"));
    });

    const providers = [
      createMockProvider({ provider_id: "prov-001" }),
      createMockProvider({ provider_id: "prov-002" }),
    ];

    const results = await verifyAllProviders(providers, { fetchFn: mockFetch });

    expect(results).toHaveLength(2);
    expect(results[0].reachable).toBe(true);
    expect(results[1].reachable).toBe(false);
  });
});

describe("applyVerificationResult", () => {
  it("resets consecutive_failures on successful verification", () => {
    const provider = createMockProvider({ consecutive_failures: 5 });
    const result: VerificationResult = {
      providerId: "prov-001",
      providerAddress: "0xAAA",
      name: "Test Provider",
      previousStatus: "unresponsive",
      newStatus: "verified",
      reachable: true,
      responseTimeMs: 100,
      error: null,
      errorCode: null,
      checkedAt: "2025-06-15T10:30:00Z",
    };

    const updated = applyVerificationResult(provider, result);

    expect(updated.verification_status).toBe("verified");
    expect(updated.consecutive_failures).toBe(0);
    expect(updated.last_verified_at).toBe("2025-06-15T10:30:00Z");
    expect(updated.last_check_at).toBe("2025-06-15T10:30:00Z");
  });

  it("increments consecutive_failures on failed verification", () => {
    const provider = createMockProvider({ consecutive_failures: 1 });
    const result: VerificationResult = {
      providerId: "prov-001",
      providerAddress: "0xAAA",
      name: "Test Provider",
      previousStatus: "verified",
      newStatus: "verified",
      reachable: false,
      responseTimeMs: null,
      error: "Timeout",
      errorCode: null,
      checkedAt: "2025-06-15T10:30:00Z",
    };

    const updated = applyVerificationResult(provider, result);

    expect(updated.consecutive_failures).toBe(2);
    expect(updated.last_check_at).toBe("2025-06-15T10:30:00Z");
    expect(updated.last_verified_at).toBeNull();
  });

  it("does not mutate the original provider object", () => {
    const provider = createMockProvider();
    const result: VerificationResult = {
      providerId: "prov-001",
      providerAddress: "0xAAA",
      name: "Test Provider",
      previousStatus: "pending",
      newStatus: "verified",
      reachable: true,
      responseTimeMs: 100,
      error: null,
      errorCode: null,
      checkedAt: "2025-06-15T10:30:00Z",
    };

    const updated = applyVerificationResult(provider, result);

    expect(updated).not.toBe(provider);
    expect(provider.verification_status).toBe("pending");
    expect(updated.verification_status).toBe("verified");
  });
});
