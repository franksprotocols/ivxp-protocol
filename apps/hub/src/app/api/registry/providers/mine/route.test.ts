import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const providers = [
  {
    provider_id: "prov-001",
    provider_address: "0x1111111111111111111111111111111111111111",
    name: "Claimed A",
    description: "A",
    endpoint_url: "https://a.example.com",
    services: [],
    status: "active" as const,
    registration_status: "claimed" as const,
    claimed_by: "0x1111111111111111111111111111111111111111",
    claimed_at: "2026-03-02T10:00:00Z",
    registered_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-02T10:00:00Z",
    verification_status: "verified" as const,
    last_verified_at: null,
    last_check_at: null,
    consecutive_failures: 0,
  },
  {
    provider_id: "prov-002",
    provider_address: "0x1111111111111111111111111111111111111111",
    name: "Pending B",
    description: "B",
    endpoint_url: "https://b.example.com",
    services: [],
    status: "active" as const,
    registration_status: "pending" as const,
    claimed_by: null,
    claimed_at: null,
    registered_at: "2026-03-02T09:00:00Z",
    updated_at: "2026-03-02T09:00:00Z",
    verification_status: "pending" as const,
    last_verified_at: null,
    last_check_at: null,
    consecutive_failures: 0,
  },
  {
    provider_id: "prov-003",
    provider_address: "0x2222222222222222222222222222222222222222",
    name: "Other Wallet",
    description: "C",
    endpoint_url: "https://c.example.com",
    services: [],
    status: "inactive" as const,
    registration_status: "claimed" as const,
    claimed_by: "0x2222222222222222222222222222222222222222",
    claimed_at: "2026-03-02T08:00:00Z",
    registered_at: "2026-03-01T08:00:00Z",
    updated_at: "2026-03-02T08:00:00Z",
    verification_status: "verified" as const,
    last_verified_at: null,
    last_check_at: null,
    consecutive_failures: 0,
  },
];

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => providers),
}));

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("GET /api/registry/providers/mine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns wallet-scoped providers", async () => {
    const response = await GET(
      createRequest(
        "/api/registry/providers/mine?wallet_address=0x1111111111111111111111111111111111111111",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("supports pagination", async () => {
    const response = await GET(
      createRequest(
        "/api/registry/providers/mine?wallet_address=0x1111111111111111111111111111111111111111&page=2&page_size=1",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(0);
    expect(body.total).toBe(1);
  });

  it("supports registration_status filtering", async () => {
    const response = await GET(
      createRequest(
        "/api/registry/providers/mine?wallet_address=0x1111111111111111111111111111111111111111&registration_status=claimed",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("returns 400 for invalid wallet_address", async () => {
    const response = await GET(createRequest("/api/registry/providers/mine?wallet_address=bad"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
  });
});
