import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => [
    {
      provider_id: "prov-001",
      provider_address: "0xAAA",
      name: "Test Provider",
      description: "Test",
      endpoint_url: "https://test.example.com",
      services: [],
      status: "active",
      registered_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      verification_status: "pending",
      last_verified_at: null,
      last_check_at: null,
      consecutive_failures: 0,
    },
  ]),
}));

vi.mock("@/lib/registry/writer", () => ({
  updateProviderVerifications: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
  });
}

describe("POST /api/registry/providers/[address]/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ services: [] }),
    });
  });

  it("returns updated provider and verification result", async () => {
    const response = await POST(createRequest("/api/registry/providers/prov-001/verify"), {
      params: Promise.resolve({ address: "prov-001" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBeDefined();
    expect(body.provider.provider_id).toBe("prov-001");
    expect(body.verification).toBeDefined();
    expect(body.verification.provider_id).toBe("prov-001");
  });

  it("returns 404 for non-existent provider", async () => {
    const response = await POST(createRequest("/api/registry/providers/prov-999/verify"), {
      params: Promise.resolve({ address: "prov-999" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("PROVIDER_NOT_FOUND");
  });

  it("returns verification result with snake_case fields", async () => {
    const response = await POST(createRequest("/api/registry/providers/prov-001/verify"), {
      params: Promise.resolve({ address: "prov-001" }),
    });
    const body = await response.json();

    expect(body.verification).toHaveProperty("provider_id");
    expect(body.verification).toHaveProperty("provider_address");
    expect(body.verification).toHaveProperty("previous_status");
    expect(body.verification).toHaveProperty("new_status");
    expect(body.verification).toHaveProperty("response_time_ms");
    expect(body.verification).toHaveProperty("checked_at");
  });

  it("returns updated provider with verification fields", async () => {
    const response = await POST(createRequest("/api/registry/providers/prov-001/verify"), {
      params: Promise.resolve({ address: "prov-001" }),
    });
    const body = await response.json();

    expect(body.provider).toHaveProperty("verification_status");
    expect(body.provider).toHaveProperty("last_verified_at");
    expect(body.provider).toHaveProperty("last_check_at");
    expect(body.provider).toHaveProperty("consecutive_failures");
  });
});
