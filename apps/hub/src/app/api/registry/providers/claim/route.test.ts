import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { POST } from "./route";

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

const pendingProvider = {
  provider_id: "prov-pending",
  provider_address: "0x0000000000000000000000000000000000000000",
  name: "Pending Provider",
  description: "pending",
  endpoint_url: "https://pending.example.com",
  services: [],
  status: "active" as const,
  registration_status: "pending" as const,
  claimed_by: null,
  claimed_at: null,
  registered_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
  verification_status: "pending" as const,
  last_verified_at: null,
  last_check_at: null,
  consecutive_failures: 0,
};

vi.mock("@/lib/registry/loader", () => ({
  loadProviders: vi.fn(() => [pendingProvider]),
}));

vi.mock("@/lib/registry/verify-signature", () => ({
  verifyRegistrationSignature: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/registry/writer", () => ({
  claimProviderByEndpoint: vi.fn(async (_endpoint: string, wallet: string) => ({
    ...pendingProvider,
    registration_status: "claimed",
    provider_address: wallet,
    claimed_by: wallet,
    claimed_at: "2026-03-02T09:30:00Z",
    verification_status: "verified",
    last_verified_at: "2026-03-02T09:30:00Z",
    last_check_at: "2026-03-02T09:30:00Z",
    updated_at: "2026-03-02T09:30:00Z",
  })),
}));

async function buildClaimRequestBody(endpointUrl = "https://pending.example.com") {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const timestamp = new Date().toISOString();
  const message = [
    "IVXP Provider Claim",
    `Wallet: ${account.address}`,
    `Endpoint: ${endpointUrl}`,
    `Timestamp: ${timestamp}`,
  ].join("\n");

  const signature = await account.signMessage({ message });

  return {
    endpoint_url: endpointUrl,
    wallet_address: account.address,
    message,
    signature,
  };
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/registry/providers/claim", "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/registry/providers/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims a pending provider when challenge verification succeeds", async () => {
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);

    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const parsedBody = JSON.parse(String(init?.body));
      const challenge = parsedBody.challenge as string;
      const signature = await account.signMessage({ message: challenge });

      return {
        ok: true,
        status: 200,
        json: async () => ({
          challenge,
          signer: account.address,
          signature,
        }),
      } as Response;
    }) as typeof fetch;

    const body = await buildClaimRequestBody();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.provider.registration_status).toBe("claimed");
    expect(data.provider.claimed_by).toBe(body.wallet_address);
  });

  it("returns 401 when wallet proof verification fails", async () => {
    const { verifyRegistrationSignature } = await import("@/lib/registry/verify-signature");
    (verifyRegistrationSignature as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const body = await buildClaimRequestBody();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("WALLET_PROOF_INVALID");
  });

  it("returns 409 when provider is already claimed", async () => {
    const { loadProviders } = await import("@/lib/registry/loader");
    (loadProviders as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      { ...pendingProvider, registration_status: "claimed", claimed_by: pendingProvider.provider_address },
    ]);

    const body = await buildClaimRequestBody();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe("PROVIDER_ALREADY_CLAIMED");
  });

  it("returns 422 for invalid challenge response payload", async () => {
    global.fetch = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ invalid: true }),
      } as Response;
    }) as typeof fetch;

    const body = await buildClaimRequestBody();
    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe("CHALLENGE_INVALID_RESPONSE");
  });

  it("returns 400 for invalid parameters", async () => {
    const response = await POST(
      createPostRequest({
        endpoint_url: "not-url",
        wallet_address: "0xabc",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });
});
