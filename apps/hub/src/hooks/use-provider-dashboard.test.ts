import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useProviderDashboard } from "./use-provider-dashboard";

const mockPush = vi.fn();
const mockSignMessageAsync = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    isConnected: true,
  })),
  useSignMessage: vi.fn(() => ({
    signMessageAsync: mockSignMessageAsync,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const providerFixture = {
  provider_id: "prov-001",
  provider_address: "0x1234567890abcdef1234567890abcdef12345678",
  name: "Test Provider",
  description: "A provider",
  endpoint_url: "https://test.example.com",
  services: [],
  status: "active",
  registration_status: "claimed",
  claimed_by: "0x1234567890abcdef1234567890abcdef12345678",
  claimed_at: "2026-03-02T09:00:00Z",
  verification_status: "verified",
  last_verified_at: "2026-03-02T09:00:00Z",
  last_check_at: "2026-03-02T09:00:00Z",
  consecutive_failures: 0,
  registered_at: "2026-03-01T09:00:00Z",
  updated_at: "2026-03-02T09:00:00Z",
};

describe("useProviderDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignMessageAsync.mockResolvedValue("0x" + "ab".repeat(65));
  });

  it("fetches wallet-scoped provider list on mount", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ providers: [providerFixture], total: 1 }),
    });

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("loaded"));
    expect(result.current.provider?.provider_id).toBe("prov-001");
    expect(result.current.providers).toHaveLength(1);
  });

  it("sets not-found state when no provider is found", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ providers: [], total: 0 }),
    });

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("not-found"));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("sets error state on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: { message: "Server error" } }),
    });

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("Server error");
  });

  it("sets disconnected state when wallet is not connected", async () => {
    const { useAccount } = await import("wagmi");
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: undefined,
      isConnected: false,
    });

    const { result } = renderHook(() => useProviderDashboard());

    expect(result.current.state).toBe("disconnected");
    expect(result.current.provider).toBeNull();
  });

  it("handles network errors gracefully", async () => {
    const { useAccount } = await import("wagmi");
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      isConnected: true,
    });

    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("error"));
    expect(result.current.error).toBe("Network error. Please check your connection.");
  });

  it("claims a provider and refetches data", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/registry/providers/mine")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ providers: [providerFixture], total: 1 }),
        } as Response;
      }

      if (url === "/api/registry/providers/claim") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ provider: providerFixture }),
        } as Response;
      }

      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch;

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("loaded"));

    await act(async () => {
      const ok = await result.current.claimProvider("https://test.example.com");
      expect(ok).toBe(true);
    });

    expect(mockSignMessageAsync).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/registry/providers/claim",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
