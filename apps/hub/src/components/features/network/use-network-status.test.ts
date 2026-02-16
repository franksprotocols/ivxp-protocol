import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "./use-network-status";
import { createTestWrapper } from "@/test/test-utils";

// Mock wagmi hooks
const mockUseChainId = vi.fn();
const mockUseAccount = vi.fn();
const mockSwitchChain = vi.fn();
let mockIsPending = false;

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useChainId: () => mockUseChainId(),
    useAccount: () => mockUseAccount(),
    useSwitchChain: () => ({
      switchChain: mockSwitchChain,
      isPending: mockIsPending,
    }),
  };
});

type ErrorCallback = { onError: (e: Error) => void };

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("useNetworkStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPending = false;
    mockUseAccount.mockReturnValue({ isConnected: true });
    mockUseChainId.mockReturnValue(1);
  });

  it("detects wrong network on unsupported chain", () => {
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.isWrongNetwork).toBe(true);
  });

  it("detects correct network for Base Mainnet", () => {
    mockUseChainId.mockReturnValue(8453);
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.isWrongNetwork).toBe(false);
  });

  it("detects correct network for Base Sepolia", () => {
    mockUseChainId.mockReturnValue(84532);
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.isWrongNetwork).toBe(false);
  });

  it("reports not wrong network when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.isWrongNetwork).toBe(false);
  });

  it("returns formatted chain name for unknown chain", () => {
    mockUseChainId.mockReturnValue(1);
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.currentChainName).toBe("Unknown (1)");
  });

  it("returns empty chain name when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.currentChainName).toBe("");
  });

  it("reports isSwitching true when isPending is true", () => {
    mockIsPending = true;
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.isSwitching).toBe(true);
  });

  it("reports isSwitching false when isPending is false", () => {
    mockIsPending = false;
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.isSwitching).toBe(false);
  });

  it("calls switchChain when switchToTarget is invoked", () => {
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    act(() => {
      result.current.switchToTarget();
    });
    expect(mockSwitchChain).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: expect.any(Number) }),
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  describe("error classification by error.name", () => {
    it("classifies UserRejectedRequestError as user-rejected", () => {
      mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
        cb.onError(createNamedError("UserRejectedRequestError", ""));
      });
      const { result } = renderHook(() => useNetworkStatus(), {
        wrapper: createTestWrapper(),
      });
      act(() => result.current.switchToTarget());
      expect(result.current.switchError).toBe("user-rejected");
    });

    it("classifies SwitchChainNotSupportedError as unsupported", () => {
      mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
        cb.onError(createNamedError("SwitchChainNotSupportedError", ""));
      });
      const { result } = renderHook(() => useNetworkStatus(), {
        wrapper: createTestWrapper(),
      });
      act(() => result.current.switchToTarget());
      expect(result.current.switchError).toBe("unsupported");
    });
  });

  describe("error classification by error.message fallback", () => {
    it("classifies 'rejected' message as user-rejected", () => {
      mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
        cb.onError(new Error("User rejected the request"));
      });
      const { result } = renderHook(() => useNetworkStatus(), {
        wrapper: createTestWrapper(),
      });
      act(() => result.current.switchToTarget());
      expect(result.current.switchError).toBe("user-rejected");
    });

    it("classifies 'not supported' message as unsupported", () => {
      mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
        cb.onError(new Error("Chain not supported"));
      });
      const { result } = renderHook(() => useNetworkStatus(), {
        wrapper: createTestWrapper(),
      });
      act(() => result.current.switchToTarget());
      expect(result.current.switchError).toBe("unsupported");
    });

    it("classifies unknown message as unknown", () => {
      mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
        cb.onError(new Error("Something went wrong"));
      });
      const { result } = renderHook(() => useNetworkStatus(), {
        wrapper: createTestWrapper(),
      });
      act(() => result.current.switchToTarget());
      expect(result.current.switchError).toBe("unknown");
    });
  });

  it("clears error when clearError is called", () => {
    mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
      cb.onError(new Error("User rejected the request"));
    });
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    act(() => result.current.switchToTarget());
    expect(result.current.switchError).toBe("user-rejected");
    act(() => result.current.clearError());
    expect(result.current.switchError).toBeNull();
  });

  it("clears previous error when switchToTarget is called again", () => {
    let callCount = 0;
    mockSwitchChain.mockImplementation((_opts: unknown, cb: ErrorCallback) => {
      callCount += 1;
      if (callCount === 1) {
        cb.onError(new Error("User rejected the request"));
      }
      // Second call succeeds (no error callback)
    });
    const { result } = renderHook(() => useNetworkStatus(), {
      wrapper: createTestWrapper(),
    });
    act(() => result.current.switchToTarget());
    expect(result.current.switchError).toBe("user-rejected");
    act(() => result.current.switchToTarget());
    expect(result.current.switchError).toBeNull();
  });
});
