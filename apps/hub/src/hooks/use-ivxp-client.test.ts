import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIVXPClient } from "./use-ivxp-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deliveryPayload() {
  return {
    order_id: "ord_123",
    payment: {
      tx_hash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      network: "base-sepolia" as const,
    },
    signature: {
      message: "signed",
      sig: `0x${"b".repeat(130)}`,
      signer: "0x1234567890abcdef1234567890abcdef12345678",
    },
  };
}

describe("useIVXPClient", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to legacy delivery endpoint only when canonical endpoint returns 404", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "not found" }))
      .mockResolvedValueOnce(jsonResponse(200, { order_id: "ord_123", status: "processing" }));

    const { result } = renderHook(() => useIVXPClient());
    const response = await result.current.requestDelivery(
      "http://provider.test",
      deliveryPayload(),
    );

    expect(response).toEqual({ order_id: "ord_123", status: "processing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/ivxp/orders/ord_123/delivery");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://provider.test/ivxp/deliver");
  });

  it("does not fall back to legacy delivery endpoint on non-404 canonical errors", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));

    const { result } = renderHook(() => useIVXPClient());
    await expect(
      result.current.requestDelivery("http://provider.test", deliveryPayload()),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/ivxp/orders/ord_123/delivery");
  });

  it("falls back order status endpoint only on 404", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { error: "not found" }))
      .mockResolvedValueOnce(jsonResponse(200, { order_id: "ord_123", status: "processing" }));

    const { result } = renderHook(() => useIVXPClient());
    const status = await result.current.getOrderStatus("http://provider.test", "ord_123");

    expect(status).toEqual({ order_id: "ord_123", status: "processing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://provider.test/ivxp/status/ord_123");
  });

  it("does not fall back order status endpoint on non-404 failures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));

    const { result } = renderHook(() => useIVXPClient());
    await expect(result.current.getOrderStatus("http://provider.test", "ord_123")).rejects.toMatchObject(
      { code: "PROVIDER_UNAVAILABLE" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses protocol service_quote payload into hub quote response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        protocol: "IVXP/1.0",
        message_type: "service_quote",
        timestamp: "2026-02-20T00:00:00.000Z",
        order_id: "ivxp-quote-1",
        provider_agent: {
          name: "demo-provider",
          wallet_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        quote: {
          price_usdc: 0.5,
          estimated_delivery: "2026-02-20T01:00:00.000Z",
          payment_address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          network: "base-sepolia",
        },
      }),
    );

    const { result } = renderHook(() => useIVXPClient());
    const quote = await result.current.requestQuote("http://provider.test", {
      service_type: "text_echo",
      input: { text: "hello" },
    });

    expect(quote).toEqual({
      order_id: "ivxp-quote-1",
      price_usdc: "0.5",
      payment_address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      expires_at: "2026-02-20T01:00:00.000Z",
      service_type: "text_echo",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://provider.test/ivxp/request",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps compatibility with flat quote payload and infers service_type", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        order_id: "ord-flat-1",
        price_usdc: "1.00",
        payment_address: "0xcccccccccccccccccccccccccccccccccccccccc",
        expires_at: "2026-02-20T01:00:00.000Z",
      }),
    );

    const { result } = renderHook(() => useIVXPClient());
    const quote = await result.current.requestQuote("http://provider.test", {
      service_type: "image_gen",
      input: { prompt: "cat" },
    });

    expect(quote).toEqual({
      order_id: "ord-flat-1",
      price_usdc: "1.00",
      payment_address: "0xcccccccccccccccccccccccccccccccccccccccc",
      expires_at: "2026-02-20T01:00:00.000Z",
      service_type: "image_gen",
    });
  });

  it("decodes non-data-uri base64 deliverable content for binary types", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        content: "SGVsbG8=",
        content_type: "application/octet-stream",
        content_hash: "hash-1",
        file_name: "result.txt",
      }),
    );

    const { result } = renderHook(() => useIVXPClient());
    const deliverable = await result.current.downloadDeliverable("http://provider.test", "ord_123");

    expect(new TextDecoder().decode(deliverable.content)).toBe("Hello");
    expect(deliverable.contentType).toBe("application/octet-stream");
    expect(deliverable.contentHash).toBe("hash-1");
  });
});
