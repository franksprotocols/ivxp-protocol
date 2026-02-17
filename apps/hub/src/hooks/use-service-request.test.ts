import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServiceRequest } from "./use-service-request";

describe("useServiceRequest", () => {
  it("starts with idle state", () => {
    const { result } = renderHook(() => useServiceRequest());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets loading state during submission", async () => {
    const { result } = renderHook(() => useServiceRequest());

    const loadingStates: boolean[] = [];

    const promise = act(async () => {
      const submitPromise = result.current.submitRequest(
        "text_echo",
        "https://provider.example.com",
        { text: "hello" },
      );
      loadingStates.push(result.current.isLoading);
      await submitPromise;
    });

    await promise;
    expect(result.current.isLoading).toBe(false);
  });

  it("returns quote data on success", async () => {
    const { result } = renderHook(() => useServiceRequest());

    let quote: unknown;
    await act(async () => {
      quote = await result.current.submitRequest("text_echo", "https://provider.example.com", {
        text: "hello",
      });
    });

    expect(quote).toBeDefined();
    expect(quote).toHaveProperty("order_id");
    expect(quote).toHaveProperty("price_usdc");
    expect(result.current.error).toBeNull();
  });

  it("sets error state on failure", async () => {
    const { result } = renderHook(() => useServiceRequest());

    await act(async () => {
      const quote = await result.current.submitRequest("text_echo", "https://FAIL.example.com", {
        text: "hello",
      });
      expect(quote).toBeNull();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error).toHaveProperty("message");
    expect(result.current.isLoading).toBe(false);
  });

  it("resets error state on new submission", async () => {
    const { result } = renderHook(() => useServiceRequest());

    // First: trigger an error
    await act(async () => {
      await result.current.submitRequest("text_echo", "https://FAIL.example.com", {
        text: "hello",
      });
    });

    expect(result.current.error).not.toBeNull();

    // Second: successful submission clears error
    await act(async () => {
      await result.current.submitRequest("text_echo", "https://provider.example.com", {
        text: "hello",
      });
    });

    expect(result.current.error).toBeNull();
  });

  it("reset() clears error state", async () => {
    const { result } = renderHook(() => useServiceRequest());

    await act(async () => {
      await result.current.submitRequest("text_echo", "https://FAIL.example.com", {
        text: "hello",
      });
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.error).toBeNull();
  });

  it("returns quote with snake_case wire format fields", async () => {
    const { result } = renderHook(() => useServiceRequest());

    let quote: Record<string, unknown> | undefined;
    await act(async () => {
      quote = (await result.current.submitRequest("text_echo", "https://provider.example.com", {
        text: "hello",
      })) as unknown as Record<string, unknown>;
    });

    // Verify wire format uses snake_case
    expect(quote).toHaveProperty("order_id");
    expect(quote).toHaveProperty("price_usdc");
    expect(quote).toHaveProperty("payment_address");
    expect(quote).toHaveProperty("expires_at");
    expect(quote).toHaveProperty("service_type");
    // Verify no camelCase keys leaked
    expect(quote).not.toHaveProperty("orderId");
    expect(quote).not.toHaveProperty("priceUsdc");
  });

  it("includes error code in error state", async () => {
    const { result } = renderHook(() => useServiceRequest());

    await act(async () => {
      await result.current.submitRequest("text_echo", "https://FAIL.example.com", {
        text: "hello",
      });
    });

    expect(result.current.error?.code).toBe("REQUEST_FAILED");
    expect(result.current.error?.message).toContain("Provider unreachable");
  });
});
