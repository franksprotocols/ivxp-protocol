import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePayment } from "./use-payment";
import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Mock wagmi hooks
// ---------------------------------------------------------------------------

const mockWriteContractAsync = vi.fn();
const mockReadContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xUserAddress0000000000000000000000000001" as Address }),
  useChainId: () => 84532, // Base Sepolia chain ID
  useWriteContract: () => ({ writeContractAsync: mockWriteContractAsync }),
  usePublicClient: () => ({
    readContract: mockReadContract,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
  }),
}));

// ---------------------------------------------------------------------------
// Mock network constants (Fix #4: chain validation)
// ---------------------------------------------------------------------------

vi.mock("@/lib/network-constants", () => ({
  isSupportedChain: () => true,
  getTargetChain: () => ({ name: "Base Sepolia", id: 84532 }),
}));

// ---------------------------------------------------------------------------
// Mock USDC contract config
// ---------------------------------------------------------------------------

vi.mock("@/lib/usdc-contract", () => ({
  getUsdcConfig: () => ({
    address: "0x0000000000000000000000000000000000000000",
    abi: [],
  }),
  usdcConfig: {
    address: "0x0000000000000000000000000000000000000000",
    abi: [],
  },
  USDC_DECIMALS: 6,
  assertUsdcConfigured: () => {},
}));

// ---------------------------------------------------------------------------
// Mock order store
// ---------------------------------------------------------------------------

const mockUpdateOrderPayment = vi.fn();
vi.mock("@/stores/order-store", () => ({
  useOrderStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ updateOrderPayment: mockUpdateOrderPayment }),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_ADDR = "0xProviderAddress000000000000000000000001" as Address;
const FAKE_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("usePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: sufficient balance and allowance
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") return Promise.resolve(10_000_000n); // 10 USDC
      if (functionName === "allowance") return Promise.resolve(10_000_000n);
      return Promise.resolve(0n);
    });
    mockWriteContractAsync.mockResolvedValue(FAKE_TX_HASH);
    mockWaitForTransactionReceipt.mockResolvedValue({
      blockNumber: 42n,
      status: "success",
    });
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => usePayment("order-1"));
    expect(result.current.step).toBe("idle");
    expect(result.current.txHash).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isRetrying).toBe(false);
  });

  it("completes full payment flow when allowance is sufficient", async () => {
    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("confirmed");
    expect(result.current.txHash).toBe(FAKE_TX_HASH);
    expect(result.current.blockNumber).toBe(42n);
    // Should only call transfer (no approve needed)
    expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);
    expect(mockWriteContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "transfer" }),
    );
  });

  it("requests approval when allowance is insufficient", async () => {
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") return Promise.resolve(10_000_000n);
      if (functionName === "allowance") return Promise.resolve(0n); // no allowance
      return Promise.resolve(0n);
    });

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("confirmed");
    // approve + transfer = 2 calls
    expect(mockWriteContractAsync).toHaveBeenCalledTimes(2);
    expect(mockWriteContractAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: "approve" }),
    );
    expect(mockWriteContractAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: "transfer" }),
    );
  });

  it("handles insufficient balance", async () => {
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") return Promise.resolve(500_000n); // 0.5 USDC
      if (functionName === "allowance") return Promise.resolve(10_000_000n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain("Insufficient USDC balance");
    expect(result.current.error?.code).toBe("INSUFFICIENT_BALANCE");
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("handles wallet rejection during transfer with specific error code", async () => {
    const rejectionError = new Error("User rejected the request.");
    Object.defineProperty(rejectionError, "name", { value: "UserRejectedRequestError" });
    mockWriteContractAsync.mockRejectedValueOnce(rejectionError);

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error?.code).toBe("USER_REJECTED");
    expect(result.current.error?.recoverable).toBe(true);
  });

  it("supports retry after wallet rejection", async () => {
    const rejectionError = new Error("User rejected the request.");
    mockWriteContractAsync
      .mockRejectedValueOnce(rejectionError)
      .mockResolvedValueOnce(FAKE_TX_HASH);

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("error");

    // Retry
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.step).toBe("confirmed");
    expect(result.current.txHash).toBe(FAKE_TX_HASH);
  });

  it("updates order store on payment confirmation", async () => {
    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(mockUpdateOrderPayment).toHaveBeenCalledWith("order-1", {
      txHash: FAKE_TX_HASH,
      status: "paying",
    });
    expect(mockUpdateOrderPayment).toHaveBeenCalledWith("order-1", {
      blockNumber: 42n,
      status: "paid",
    });
  });

  it("exposes balance info for insufficient balance errors", async () => {
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") return Promise.resolve(500_000n); // 0.5 USDC
      if (functionName === "allowance") return Promise.resolve(10_000_000n);
      return Promise.resolve(0n);
    });

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.balance).toBe("0.5");
  });

  // Fix #7: Partial success and retryVerification tests
  it("enters partial-success state when confirmation fails after tx sent", async () => {
    mockWaitForTransactionReceipt.mockRejectedValueOnce(new Error("Confirmation failed"));

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("partial-success");
    expect(result.current.txHash).toBe(FAKE_TX_HASH);
    expect(result.current.error?.code).toBe("PARTIAL_SUCCESS");
    expect(result.current.error?.recoverable).toBe(true);
  });

  it("retryVerification succeeds after partial-success", async () => {
    // First: fail confirmation to get into partial-success
    mockWaitForTransactionReceipt
      .mockRejectedValueOnce(new Error("Confirmation failed"))
      .mockResolvedValueOnce({ blockNumber: 99n, status: "success" });

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("partial-success");

    // Retry verification
    await act(async () => {
      await result.current.retryVerification();
    });

    expect(result.current.step).toBe("confirmed");
    expect(result.current.blockNumber).toBe(99n);
    expect(result.current.isRetrying).toBe(false);
  });

  it("retryVerification fails gracefully", async () => {
    // First: fail confirmation to get into partial-success
    mockWaitForTransactionReceipt
      .mockRejectedValueOnce(new Error("Confirmation failed"))
      .mockRejectedValueOnce(new Error("Still failing"));

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("partial-success");

    // Retry verification - fails again
    await act(async () => {
      await result.current.retryVerification();
    });

    expect(result.current.step).toBe("partial-success");
    expect(result.current.error?.message).toContain("Verification retry failed");
    expect(result.current.isRetrying).toBe(false);
  });

  // Fix #8: Receipt status validation
  it("handles reverted transaction receipt", async () => {
    mockWaitForTransactionReceipt.mockResolvedValueOnce({
      blockNumber: 42n,
      status: "reverted",
    });

    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error?.code).toBe("TRANSACTION_REVERTED");
    expect(result.current.error?.message).toContain("reverted");
  });

  // Fix #3: Timeout parameter is passed
  it("passes timeout to waitForTransactionReceipt", async () => {
    const { result } = renderHook(() => usePayment("order-1"));

    await act(async () => {
      await result.current.initiatePayment(PROVIDER_ADDR, "1.50");
    });

    expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: 60_000 }),
    );
  });
});
