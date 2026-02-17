import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProviderUpdate } from "./use-provider-update";

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

describe("useProviderUpdate", () => {
  const validFormData = {
    name: "Updated Provider",
    description: "Updated description for testing",
    endpointUrl: "https://updated.example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignMessageAsync.mockResolvedValue("0xmocksignature");
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useProviderUpdate());
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("successfully updates provider", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          provider: { name: "Updated Provider" },
        }),
    });

    const { result } = renderHook(() => useProviderUpdate());

    let updatedProvider: unknown;
    await act(async () => {
      updatedProvider = await result.current.update(validFormData);
    });

    expect(updatedProvider).toBeDefined();
    expect(result.current.state).toBe("success");
  });

  it("handles signature rejection", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("User rejected"));

    const { result } = renderHook(() => useProviderUpdate());

    await act(async () => {
      await result.current.update(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("SIGNATURE_REJECTED");
  });

  it("handles API error responses", async () => {
    mockSignMessageAsync.mockResolvedValue("0xmocksignature");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: { code: "PROVIDER_UNREACHABLE", message: "Endpoint not reachable" },
        }),
    });

    const { result } = renderHook(() => useProviderUpdate());

    await act(async () => {
      await result.current.update(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("PROVIDER_UNREACHABLE");
  });

  it("handles network errors", async () => {
    mockSignMessageAsync.mockResolvedValue("0xmocksignature");
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useProviderUpdate());

    await act(async () => {
      await result.current.update(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("NETWORK_ERROR");
  });

  it("handles wallet not connected", async () => {
    const { useAccount } = await import("wagmi");
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: undefined,
      isConnected: false,
    });

    const { result } = renderHook(() => useProviderUpdate());

    await act(async () => {
      await result.current.update(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("WALLET_NOT_CONNECTED");
    expect(result.current.error?.message).toBe("Please connect your wallet first.");
  });

  it("handles SIGNATURE_INVALID from API (mismatched message/signature)", async () => {
    // Restore connected state after wallet-not-connected test
    const { useAccount } = await import("wagmi");
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      isConnected: true,
    });

    mockSignMessageAsync.mockResolvedValue("0xmocksignature");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: { code: "SIGNATURE_INVALID", message: "Signature verification failed." },
        }),
    });

    const { result } = renderHook(() => useProviderUpdate());

    await act(async () => {
      await result.current.update(validFormData);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error?.code).toBe("SIGNATURE_INVALID");
    expect(result.current.error?.message).toBe("Signature verification failed. Please try again.");
  });

  it("returns null on error and preserves form data", async () => {
    mockSignMessageAsync.mockResolvedValue("0xmocksignature");
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: { code: "INTERNAL_ERROR", message: "Server error" },
        }),
    });

    const { result } = renderHook(() => useProviderUpdate());

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.update(validFormData);
    });

    expect(returnValue).toBeNull();
    expect(result.current.state).toBe("error");
  });

  it("resets state correctly", async () => {
    mockSignMessageAsync.mockRejectedValue(new Error("User rejected"));

    // Reset useAccount to connected
    const { useAccount } = await import("wagmi");
    (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      isConnected: true,
    });

    const { result } = renderHook(() => useProviderUpdate());

    await act(async () => {
      await result.current.update(validFormData);
    });

    expect(result.current.state).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});
