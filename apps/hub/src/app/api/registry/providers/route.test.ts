import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";
import { mockProviders } from "@/lib/registry/test-fixtures";
import { privateKeyToAccount } from "viem/accounts";

// Anvil test account #0
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
  it("returns paginated provider list with defaults", async () => {
    const response = await GET(createRequest("/api/registry/providers"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(20);
  });

  it("filters by service_type", async () => {
    const response = await GET(createRequest("/api/registry/providers?service_type=text_echo"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider_id).toBe("prov-001");
  });

  it("returns empty for non-matching service_type", async () => {
    const response = await GET(createRequest("/api/registry/providers?service_type=nonexistent"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("filters by search query", async () => {
    const response = await GET(createRequest("/api/registry/providers?q=alpha"));
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

  it("returns 400 for page_size exceeding max", async () => {
    const response = await GET(createRequest("/api/registry/providers?page_size=999"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_PARAMETERS");
  });

  it("supports pagination parameters", async () => {
    const response = await GET(createRequest("/api/registry/providers?page=1&page_size=5"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(5);
  });

  it("returns snake_case fields in response", async () => {
    const response = await GET(createRequest("/api/registry/providers"));
    const body = await response.json();

    expect(body).toHaveProperty("providers");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("page_size");
    expect(body.providers[0]).toHaveProperty("provider_id");
    expect(body.providers[0]).toHaveProperty("provider_address");
    expect(body.providers[0]).toHaveProperty("endpoint_url");
    expect(body.providers[0]).toHaveProperty("registered_at");
    expect(body.providers[0]).toHaveProperty("updated_at");
  });

  it("returns empty results with total 0 for search with no matches", async () => {
    const response = await GET(createRequest("/api/registry/providers?q=zzzznonexistent"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
  });
});

async function buildValidRequest(endpointUrl = "https://test.example.com"): Promise<{
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

  it("returns 201 with provider data for valid registration", async () => {
    const { body } = await buildValidRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.provider).toBeDefined();
    expect(data.provider.provider_id).toBe("prov-test-uuid");
    expect(data.provider.name).toBe("Test Provider");
    expect(data.provider.status).toBe("active");
    expect(data.provider.registered_at).toBeDefined();
  });

  it("returns 401 for invalid signature", async () => {
    const { body } = await buildValidRequest();
    body.signature = "0x" + "00".repeat(65); // Invalid signature

    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("SIGNATURE_INVALID");
  });

  it("returns 409 for duplicate provider_address", async () => {
    const { addProvider } = await import("@/lib/registry/writer");
    (addProvider as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error(
        "Provider with address 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 already exists",
      );
    });

    const { body } = await buildValidRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe("PROVIDER_ALREADY_REGISTERED");
  });

  it("returns 400 for missing required fields", async () => {
    const response = await POST(
      createPostRequest({
        provider_address: "0xAAA",
        // Missing name, description, endpoint_url, services, signature, message
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
    expect(data.error.details).toBeDefined();
  });

  it("returns 400 for invalid endpoint_url (not HTTPS)", async () => {
    const { body } = await buildValidRequest();
    body.endpoint_url = "http://insecure.example.com";

    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
    expect(data.error.details?.endpoint_url).toBeDefined();
  });

  it("accepts localhost HTTP endpoint_url for local development", async () => {
    const { body } = await buildValidRequest("http://localhost:3001");
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.provider.endpoint_url).toBe("http://localhost:3001");
  });

  it("returns 422 when provider endpoint is unreachable", async () => {
    const { verifyProviderEndpoint } = await import("@/lib/registry/verify-endpoint");
    (verifyProviderEndpoint as ReturnType<typeof vi.fn>).mockResolvedValue({
      reachable: false,
      error: "Provider did not respond within 5000ms",
    });

    const { body } = await buildValidRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe("PROVIDER_UNREACHABLE");
  });

  it("returns snake_case fields in response", async () => {
    const { body } = await buildValidRequest();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.provider).toHaveProperty("provider_id");
    expect(data.provider).toHaveProperty("provider_address");
    expect(data.provider).toHaveProperty("endpoint_url");
    expect(data.provider).toHaveProperty("registered_at");
    expect(data.provider).toHaveProperty("updated_at");
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
