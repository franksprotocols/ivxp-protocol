import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => [
    {
      provider_id: "prov-001",
      provider_address: "0x1234567890abcdef1234567890abcdef12345678",
      name: "Test Provider",
      description: "A test provider for dashboard",
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
      verification_status: "verified",
      last_verified_at: "2026-02-01T00:00:00Z",
      last_check_at: "2026-02-01T00:00:00Z",
      consecutive_failures: 0,
      registered_at: "2026-01-15T00:00:00Z",
      updated_at: "2026-01-15T00:00:00Z",
    },
  ]),
}));

vi.mock("@/lib/registry/verify-signature", () => ({
  verifyRegistrationSignature: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/registry/verify-endpoint", () => ({
  verifyProviderEndpoint: vi.fn().mockResolvedValue({ reachable: true }),
}));

vi.mock("@/lib/registry/writer", () => ({
  updateProvider: vi.fn().mockResolvedValue({
    provider_id: "prov-001",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    name: "Updated Provider",
    description: "Updated description for testing",
    endpoint_url: "https://updated.example.com",
    services: [],
    status: "active",
    verification_status: "verified",
    registered_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-02-09T00:00:00Z",
  }),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

function createGetRequest(address: string): NextRequest {
  return new NextRequest(new URL(`/api/registry/providers/${address}`, "http://localhost:3000"));
}

function createPutRequest(address: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(`/api/registry/providers/${address}`, "http://localhost:3000"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validAddress = "0x1234567890abcdef1234567890abcdef12345678";
const routeParams = { params: Promise.resolve({ address: validAddress }) };

describe("GET /api/registry/providers/[address]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns provider data for a valid registered address", async () => {
    const response = await GET(createGetRequest(validAddress), routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBeDefined();
    expect(body.provider.provider_address).toBe(validAddress);
    expect(body.provider.name).toBe("Test Provider");
  });

  it("returns 404 for an unregistered address", async () => {
    const unknownParams = {
      params: Promise.resolve({ address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    };
    const response = await GET(
      createGetRequest("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      unknownParams,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("PROVIDER_NOT_FOUND");
  });

  it("returns 400 for an invalid address format", async () => {
    const badParams = { params: Promise.resolve({ address: "not-an-address" }) };
    const response = await GET(createGetRequest("not-an-address"), badParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_ADDRESS");
  });

  it("performs case-insensitive address lookup", async () => {
    const upperParams = {
      params: Promise.resolve({ address: "0x1234567890ABCDEF1234567890ABCDEF12345678" }),
    };
    const response = await GET(
      createGetRequest("0x1234567890ABCDEF1234567890ABCDEF12345678"),
      upperParams,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBeDefined();
  });

  it("returns 500 with INTERNAL_ERROR when provider loading fails", async () => {
    const { loadProviders } = await import("@/lib/registry/loader");
    (loadProviders as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("registry unavailable");
    });

    const response = await GET(createGetRequest(validAddress), routeParams);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /api/registry/providers/[address]", () => {
  const validBody = {
    name: "Updated Provider",
    description: "Updated description for testing",
    endpoint_url: "https://updated.example.com",
    signature: "0x" + "ab".repeat(65),
    message: "IVXP Provider Update\nProvider: 0x1234...",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates provider with valid data and signature", async () => {
    const response = await PUT(createPutRequest(validAddress, validBody), routeParams);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider.name).toBe("Updated Provider");
  });

  it("returns 400 for missing required fields", async () => {
    const response = await PUT(createPutRequest(validAddress, { name: "X" }), routeParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
  });

  it("returns 401 for invalid signature", async () => {
    const { verifyRegistrationSignature } = await import("@/lib/registry/verify-signature");
    (verifyRegistrationSignature as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const response = await PUT(createPutRequest(validAddress, validBody), routeParams);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("SIGNATURE_INVALID");
  });

  it("returns 422 for unreachable endpoint", async () => {
    const { verifyProviderEndpoint } = await import("@/lib/registry/verify-endpoint");
    (verifyProviderEndpoint as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      reachable: false,
      error: "timeout",
    });

    const response = await PUT(createPutRequest(validAddress, validBody), routeParams);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("PROVIDER_UNREACHABLE");
  });

  it("returns 404 for unregistered address", async () => {
    const unknownParams = {
      params: Promise.resolve({ address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    };
    const response = await PUT(
      createPutRequest("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", validBody),
      unknownParams,
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("PROVIDER_NOT_FOUND");
  });

  it("returns 400 for invalid address format", async () => {
    const badParams = { params: Promise.resolve({ address: "bad-address" }) };
    const response = await PUT(createPutRequest("bad-address", validBody), badParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_ADDRESS");
  });

  it("returns 413 for oversized request body", async () => {
    const oversizedRequest = new NextRequest(
      new URL(`/api/registry/providers/${validAddress}`, "http://localhost:3000"),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "20000",
        },
        body: JSON.stringify(validBody),
      },
    );

    const response = await PUT(oversizedRequest, routeParams);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
