import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";
import { mockProviders } from "@/lib/registry/test-fixtures";
import { privateKeyToAccount } from "viem/accounts";

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => mockProviders.slice(0, 2)),
  clearProviderCache: vi.fn(),
}));

vi.mock("@/lib/registry/writer", () => ({
  generateProviderId: vi.fn(() => "prov-test-uuid"),
  addProvider: vi.fn((provider: unknown) => provider),
}));

vi.mock("@/lib/registry/verify-endpoint", () => ({
  verifyProviderEndpoint: vi.fn(() => ({ reachable: true })),
}));

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("GET /api/registry/providers", () => {
  it("returns claimed providers only by default", async () => {
    const response = await GET(createRequest("/api/registry/providers"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(20);
  });

  it("ignores include_unclaimed=true and returns claimed providers only (security fix)", async () => {
    const response = await GET(createRequest("/api/registry/providers?include_unclaimed=true"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("filters by service_type", async () => {
    const response = await GET(
      createRequest("/api/registry/providers?service_type=text_echo&include_unclaimed=true"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("filters by search query", async () => {
    const response = await GET(
      createRequest("/api/registry/providers?q=alpha&include_unclaimed=true"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("returns 400 for invalid page parameter", async () => {
    const response = await GET(createRequest("/api/registry/providers?page=-1"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
    expect(body.error.details).toBeDefined();
  });
});

async function buildSignedRequest(endpointUrl = "https://test.example.com"): Promise<{
  body: Record<string, unknown>;
}> {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const timestamp = new Date().toISOString();
  const message = [
    "IVXP Provider Registration",
    `Address: ${account.address}`,
    "Name: Test Provider",
    `Endpoint: ${endpointUrl}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");

  const signature = await account.signMessage({ message });

  return {
    body: {
      provider_address: account.address,
      name: "Test Provider",
      description: "A test provider for unit testing the registration flow",
      endpoint_url: endpointUrl,
      services: [
        {
          service_type: "text_echo",
          name: "Text Echo",
          description: "Echoes back the input text",
          price_usdc: "0.10",
          estimated_time_seconds: 5,
        },
      ],
      signature,
      message,
    },
  };
}

function buildUnsignedRequest(endpointUrl = "https://unsigned.example.com") {
  return {
    name: "Unsigned Provider",
    description: "Unsigned provider for skill-first registration",
    endpoint_url: endpointUrl,
    services: [
      {
        service_type: "text_echo",
        name: "Text Echo",
        description: "Echoes back the input text",
        price_usdc: "0.10",
        estimated_time_seconds: 5,
      },
    ],
  };
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/registry/providers", "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/registry/providers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with claimed provider data for valid signed registration", async () => {
    const { body } = await buildSignedRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.provider.provider_id).toBe("prov-test-uuid");
    expect(data.provider.registration_status).toBe("claimed");
    expect(data.provider.claimed_by).toBe(body.provider_address);
  });

  it("returns 201 with pending provider for unsigned registration", async () => {
    const response = await POST(createPostRequest(buildUnsignedRequest()));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.provider.registration_status).toBe("pending");
    expect(data.provider.claimed_by).toBeNull();
    expect(data.provider.claimed_at).toBeNull();
  });

  it("returns 401 for invalid signature", async () => {
    const { body } = await buildSignedRequest();
    body.signature = "0x" + "00".repeat(65);

    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("SIGNATURE_INVALID");
  });

  it("returns 409 for duplicate endpoint_url", async () => {
    const { addProvider } = await import("@/lib/registry/writer");
    (addProvider as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Provider with endpoint https://test.example.com already exists");
    });

    const { body } = await buildSignedRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe("DUPLICATE_ENDPOINT");
  });

  it("returns 400 for missing required fields", async () => {
    const response = await POST(createPostRequest({ provider_address: "0xAAA" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
    expect(data.error.details).toBeDefined();
  });

  it("returns 422 when provider endpoint is unreachable", async () => {
    const { verifyProviderEndpoint } = await import("@/lib/registry/verify-endpoint");
    (verifyProviderEndpoint as ReturnType<typeof vi.fn>).mockResolvedValue({
      reachable: false,
      error: "Provider did not respond within 5000ms",
    });

    const { body } = await buildSignedRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe("PROVIDER_UNREACHABLE");
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest(new URL("/api/registry/providers", "http://localhost:3000"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_JSON");
  });
});
