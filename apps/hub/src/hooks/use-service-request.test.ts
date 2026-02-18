import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServiceRequest } from "./use-service-request";

const mockRequestQuote = vi.fn();
const mockEmit = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
}));

vi.mock("./use-ivxp-client", () => ({
  useIVXPClient: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: mockEmit,
    requestQuote: mockRequestQuote,
    requestDelivery: vi.fn(),
    getOrderStatus: vi.fn(),
    downloadDeliverable: vi.fn(),
  }),
}));

describe("useServiceRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with idle state", () => {
    const { result } = renderHook(() => useServiceRequest());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns quote data and emits order.quoted on success", async () => {
    mockRequestQuote.mockResolvedValue({
      order_id: "ord_123",
      price_usdc: "1.00",
      payment_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      service_type: "text_echo",
    });

    const { result } = renderHook(() => useServiceRequest());

    let quote: Awaited<ReturnType<typeof result.current.submitRequest>> = null;
    await act(async () => {
      quote = await result.current.submitRequest("text_echo", "http://localhost:3001", {
        text: "hello",
      });
    });

    expect(mockRequestQuote).toHaveBeenCalledWith("http://localhost:3001", {
      service_type: "text_echo",
      input: { text: "hello" },
      client_address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(quote).toEqual(
      expect.objectContaining({
        order_id: "ord_123",
        price_usdc: "1.00",
        service_type: "text_echo",
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith(
      "order.quoted",
      expect.objectContaining({ orderId: "ord_123", priceUsdc: "1.00" }),
    );
    expect(result.current.error).toBeNull();
  });

  it("maps adapter error code and message on failure", async () => {
    const error = new Error("Provider unreachable");
    (error as Error & { code: string }).code = "NETWORK_ERROR";
    mockRequestQuote.mockRejectedValue(error);

    const { result } = renderHook(() => useServiceRequest());

    await act(async () => {
      const quote = await result.current.submitRequest("text_echo", "http://localhost:3001", {
        text: "hello",
      });
      expect(quote).toBeNull();
    });

    expect(result.current.error).toEqual({
      code: "NETWORK_ERROR",
      message: "Provider unreachable",
    });
  });

  it("reset clears error state", async () => {
    mockRequestQuote.mockRejectedValue(new Error("Request failed"));
    const { result } = renderHook(() => useServiceRequest());

    await act(async () => {
      await result.current.submitRequest("text_echo", "http://localhost:3001", { text: "hello" });
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
  });
});
