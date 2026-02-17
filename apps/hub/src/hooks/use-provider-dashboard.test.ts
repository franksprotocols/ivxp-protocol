import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProviderDashboard } from "./use-provider-dashboard";

const mockPush = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: vi.fn(() => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    isConnected: true,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("useProviderDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches provider data on mount when wallet is connected", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          provider: {
            provider_id: "prov-001",
            name: "Test Provider",
            verification_status: "verified",
          },
        }),
    });

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("loaded"));
    expect(result.current.provider).toBeDefined();
    expect(result.current.provider?.name).toBe("Test Provider");
  });

  it("redirects to /provider/register when provider not found", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { code: "PROVIDER_NOT_FOUND" } }),
    });

    const { result } = renderHook(() => useProviderDashboard());

    await waitFor(() => expect(result.current.state).toBe("not-found"));
    expect(mockPush).toHaveBeenCalledWith("/provider/register");
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
    // Reset useAccount to connected state
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
});
