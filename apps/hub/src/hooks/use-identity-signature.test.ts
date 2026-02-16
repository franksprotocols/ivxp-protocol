import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdentitySignature, SIGNATURE_ERROR_CODES } from "./use-identity-signature";
import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Mock wagmi hooks
// ---------------------------------------------------------------------------

const mockSignMessageAsync = vi.fn();
let mockAddress: Address | undefined = "0xUserAddress0000000000000000000000000001" as Address;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockAddress,
  }),
  useSignMessage: () => ({
    signMessageAsync: mockSignMessageAsync,
  }),
}));

// ---------------------------------------------------------------------------
// Mock delivery API
// ---------------------------------------------------------------------------

const mockRequestDelivery = vi.fn();

vi.mock("@/lib/api/delivery", () => ({
  requestDelivery: (...args: unknown[]) => mockRequestDelivery(...args),
}));

// ---------------------------------------------------------------------------
// Mock order store
// ---------------------------------------------------------------------------

const mockUpdateOrderStatus = vi.fn();
vi.mock("@/stores/order-store", () => ({
  useOrderStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ updateOrderStatus: mockUpdateOrderStatus }),
}));

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_ID = "order-sig-1";
const TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;
const FAKE_SIGNATURE = "0xfakesignature123" as `0x${string}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useIdentitySignature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "0xUserAddress0000000000000000000000000001" as Address;
    mockSignMessageAsync.mockResolvedValue(FAKE_SIGNATURE);
    mockRequestDelivery.mockResolvedValue({
      order_id: ORDER_ID,
      status: "processing",
    });
  });

  it("starts in idle state with null errorCode", () => {
    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );
    expect(result.current.step).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.signature).toBeNull();
  });

  it("constructs message with millisecond timestamp", async () => {
    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(mockSignMessageAsync).toHaveBeenCalledTimes(1);
    const callArgs = mockSignMessageAsync.mock.calls[0][0] as { message: string };
    expect(callArgs.message).toContain("IVXP Identity Verification");
    expect(callArgs.message).toContain(`Order: ${ORDER_ID}`);
    expect(callArgs.message).toContain("Address: 0xUserAddress");
    // Verify millisecond timestamp (numeric, not ISO)
    const timestampMatch = callArgs.message.match(/Timestamp: (\d+)/);
    expect(timestampMatch).not.toBeNull();
    const ts = Number(timestampMatch![1]);
    expect(ts).toBeGreaterThan(1700000000000); // sanity: after 2023 in ms
    expect(ts).toBeLessThan(2000000000000); // sanity: before 2033 in ms
  });

  it("completes full sign + delivery flow", async () => {
    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(result.current.step).toBe("submitted");
    expect(result.current.signature).toBe(FAKE_SIGNATURE);
    expect(result.current.error).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(mockRequestDelivery).toHaveBeenCalledTimes(1);
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith(ORDER_ID, "processing");
    expect(mockPush).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
  });

  it("handles user rejection with friendly message and errorCode", async () => {
    const rejectionError = new Error("User rejected the request.");
    Object.defineProperty(rejectionError, "name", {
      value: "UserRejectedRequestError",
    });
    mockSignMessageAsync.mockRejectedValueOnce(rejectionError);

    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("Signature rejected. You can retry without paying again.");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.USER_REJECTED);
    expect(result.current.signature).toBeNull();
  });

  it("retries signature after rejection", async () => {
    const rejectionError = new Error("User rejected the request.");
    Object.defineProperty(rejectionError, "name", {
      value: "UserRejectedRequestError",
    });
    mockSignMessageAsync
      .mockRejectedValueOnce(rejectionError)
      .mockResolvedValueOnce(FAKE_SIGNATURE);

    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });
    expect(result.current.step).toBe("error");

    await act(async () => {
      await result.current.signAndDeliver();
    });
    expect(result.current.step).toBe("submitted");
    expect(result.current.signature).toBe(FAKE_SIGNATURE);
    expect(mockPush).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
  });

  it("handles delivery request failure with retry", async () => {
    mockRequestDelivery
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ order_id: ORDER_ID, status: "processing" });

    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });
    expect(result.current.step).toBe("error");
    expect(result.current.error).toContain("Network error");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.DELIVERY_FAILED);
    expect(result.current.signature).toBe(FAKE_SIGNATURE);

    await act(async () => {
      await result.current.retryDelivery();
    });
    expect(result.current.step).toBe("submitted");
    expect(mockSignMessageAsync).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(`/orders/${ORDER_ID}`);
  });

  it("retryDelivery is no-op when no signature exists", async () => {
    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.retryDelivery();
    });

    expect(result.current.step).toBe("idle");
    expect(mockRequestDelivery).not.toHaveBeenCalled();
  });

  it("passes correct wire format to requestDelivery", async () => {
    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(mockRequestDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        payment: expect.objectContaining({
          tx_hash: TX_HASH,
          network: "base-sepolia",
        }),
        signature: expect.objectContaining({
          sig: FAKE_SIGNATURE,
          signer: "0xUserAddress0000000000000000000000000001",
        }),
      }),
    );
  });

  // Issue #9: Wallet disconnection detected on delivery retry
  it("handles wallet disconnection on delivery retry", async () => {
    // First call: signing succeeds but delivery fails
    mockRequestDelivery.mockRejectedValueOnce(new Error("Network error"));

    const { result, rerender } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });
    expect(result.current.step).toBe("error");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.DELIVERY_FAILED);

    // Wallet disconnects between attempts
    mockAddress = undefined;
    rerender();

    // Retry delivery -- hook should detect wallet disconnection via addressRef
    await act(async () => {
      await result.current.retryDelivery();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toContain("Wallet disconnected");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.WALLET_DISCONNECTED);
  });

  // Issue #14: Empty orderId validated at hook boundary (fail fast)
  it("errors on empty orderId before attempting to sign", async () => {
    const { result } = renderHook(() => useIdentitySignature({ orderId: "", txHash: TX_HASH }));

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("Invalid order ID.");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.SIGNING_FAILED);
    // Should not have attempted signing or delivery
    expect(mockSignMessageAsync).not.toHaveBeenCalled();
    expect(mockRequestDelivery).not.toHaveBeenCalled();
  });

  // Issue #13: errorCode for signing failure
  it("sets SIGNING_FAILED errorCode for non-rejection signing errors", async () => {
    mockSignMessageAsync.mockRejectedValueOnce(new Error("Unknown wallet error"));

    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.SIGNING_FAILED);
  });

  // Issue #13: WALLET_DISCONNECTED errorCode
  it("sets WALLET_DISCONNECTED errorCode when wallet not connected", async () => {
    mockAddress = undefined;

    const { result } = renderHook(() =>
      useIdentitySignature({ orderId: ORDER_ID, txHash: TX_HASH }),
    );

    await act(async () => {
      await result.current.signAndDeliver();
    });

    expect(result.current.step).toBe("error");
    expect(result.current.error).toBe("Wallet not connected.");
    expect(result.current.errorCode).toBe(SIGNATURE_ERROR_CODES.WALLET_DISCONNECTED);
  });
});
