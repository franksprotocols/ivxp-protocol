import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => [
    {
      provider_id: "prov-001",
      provider_address: "0xAAA",
      name: "Active Provider",
      description: "Test",
      endpoint_url: "https://active.example.com",
      services: [
        {
          service_type: "text_echo",
          name: "Echo",
          description: "Echoes",
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
    },
  ]),
}));

vi.mock("@/lib/registry/writer", () => ({
  updateProviderVerifications: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers,
  });
}

describe("POST /api/registry/providers/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ services: [] }),
    });
  });

  it("returns verification summary with results", async () => {
    const response = await POST(createRequest("/api/registry/providers/verify"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total_checked).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body).toHaveProperty("started_at");
    expect(body).toHaveProperty("completed_at");
    expect(body).toHaveProperty("duration_ms");
  });

  it("returns 401 when CRON_SECRET is set but header is missing", async () => {
    process.env.CRON_SECRET = "test-secret";

    const response = await POST(createRequest("/api/registry/providers/verify"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");

    delete process.env.CRON_SECRET;
  });

  it("succeeds when CRON_SECRET matches header", async () => {
    process.env.CRON_SECRET = "test-secret";

    const response = await POST(
      createRequest("/api/registry/providers/verify", {
        "x-cron-secret": "test-secret",
      }),
    );

    expect(response.status).toBe(200);

    delete process.env.CRON_SECRET;
  });

  it("returns snake_case fields in response", async () => {
    const response = await POST(createRequest("/api/registry/providers/verify"));
    const body = await response.json();

    expect(body).toHaveProperty("total_checked");
    expect(body).toHaveProperty("verified_count");
    expect(body).toHaveProperty("unresponsive_count");
    expect(body).toHaveProperty("grace_period_count");
    expect(body).toHaveProperty("started_at");
    expect(body).toHaveProperty("completed_at");
    expect(body).toHaveProperty("duration_ms");
    expect(body.results[0]).toHaveProperty("provider_id");
    expect(body.results[0]).toHaveProperty("previous_status");
    expect(body.results[0]).toHaveProperty("new_status");
    expect(body.results[0]).toHaveProperty("response_time_ms");
    expect(body.results[0]).toHaveProperty("checked_at");
  });
});
