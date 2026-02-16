import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  requestDelivery,
  DeliveryError,
  DELIVERY_ERROR_CODES,
  type DeliveryRequestPayload,
} from "./delivery";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload(): DeliveryRequestPayload {
  return {
    order_id: "order-123",
    payment: {
      tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      network: "base-sepolia",
    },
    signature: {
      message: "IVXP Identity Verification | Order: order-123",
      sig: "0xdeadbeef",
      signer: "0x1234567890abcdef1234567890abcdef12345678",
    },
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requestDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Successful request ---

  it("sends validated payload and returns parsed response", async () => {
    const payload = validPayload();
    mockFetch.mockResolvedValueOnce(jsonResponse({ order_id: "order-123", status: "processing" }));

    const result = await requestDelivery(payload, "http://test-provider.com");

    expect(result).toEqual({ order_id: "order-123", status: "processing" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-provider.com/ivxp/orders/order-123/delivery",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  // --- Validation errors ---

  it("rejects empty order_id", async () => {
    const payload = { ...validPayload(), order_id: "" };

    await expect(requestDelivery(payload)).rejects.toThrow(DeliveryError);
    await expect(requestDelivery(payload)).rejects.toMatchObject({
      code: DELIVERY_ERROR_CODES.VALIDATION_FAILED,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects invalid tx_hash (not 0x-prefixed)", async () => {
    const payload = validPayload();
    const invalid = {
      ...payload,
      payment: { ...payload.payment, tx_hash: "not-hex" },
    };

    await expect(requestDelivery(invalid)).rejects.toThrow(DeliveryError);
    await expect(requestDelivery(invalid)).rejects.toMatchObject({
      code: DELIVERY_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("rejects invalid network", async () => {
    const payload = validPayload();
    const invalid = {
      ...payload,
      payment: { ...payload.payment, network: "ethereum" as "base" },
    };

    await expect(requestDelivery(invalid)).rejects.toThrow(DeliveryError);
    await expect(requestDelivery(invalid)).rejects.toMatchObject({
      code: DELIVERY_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("rejects invalid signer address", async () => {
    const payload = validPayload();
    const invalid = {
      ...payload,
      signature: { ...payload.signature, signer: "0xshort" },
    };

    await expect(requestDelivery(invalid)).rejects.toThrow(DeliveryError);
    await expect(requestDelivery(invalid)).rejects.toMatchObject({
      code: DELIVERY_ERROR_CODES.VALIDATION_FAILED,
    });
  });

  it("rejects empty signature message", async () => {
    const payload = validPayload();
    const invalid = {
      ...payload,
      signature: { ...payload.signature, message: "" },
    };

    await expect(requestDelivery(invalid)).rejects.toThrow(DeliveryError);
  });

  // --- Network errors ---

  it("throws NETWORK_ERROR when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const error = await requestDelivery(validPayload()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error).toMatchObject({
      code: DELIVERY_ERROR_CODES.NETWORK_ERROR,
      message: expect.stringContaining("Unable to reach"),
    });
  });

  // --- HTTP error responses ---

  it("throws sanitized error for 400 response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "bad" }, 400));

    const error = await requestDelivery(validPayload()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error).toMatchObject({
      code: DELIVERY_ERROR_CODES.SERVER_ERROR,
      message: expect.stringContaining("Invalid delivery request"),
    });
  });

  it("throws sanitized error for 500 response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));

    const error = await requestDelivery(validPayload()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error).toMatchObject({
      code: DELIVERY_ERROR_CODES.SERVER_ERROR,
      message: expect.stringContaining("temporarily unavailable"),
    });
  });

  it("throws sanitized error for 404 response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404));

    const error = await requestDelivery(validPayload()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error).toMatchObject({
      code: DELIVERY_ERROR_CODES.SERVER_ERROR,
      message: expect.stringContaining("Order not found"),
    });
  });

  // --- Malformed responses ---

  it("throws INVALID_RESPONSE for non-JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as Response);

    const error = await requestDelivery(validPayload()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error).toMatchObject({
      code: DELIVERY_ERROR_CODES.INVALID_RESPONSE,
    });
  });

  it("throws INVALID_RESPONSE for response missing required fields", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ unexpected: "data" }));

    const error = await requestDelivery(validPayload()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeliveryError);
    expect(error).toMatchObject({
      code: DELIVERY_ERROR_CODES.INVALID_RESPONSE,
    });
  });
});
