import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, _rateLimiter } from "./route";
import { NextRequest } from "next/server";

// Mock the rating service
vi.mock("@/lib/ratings/rating-service", () => ({
  submitRating: vi.fn(),
  buildRatingMessage: vi.fn(() => "mock message"),
  generateRatingId: vi.fn(() => "rating-test-uuid"),
  sanitizeReviewText: vi.fn((t: string) => t),
}));

// Mock the order store
vi.mock("@/stores/order-store", () => ({
  useOrderStore: {
    getState: vi.fn(() => ({
      getOrder: vi.fn(() => ({
        orderId: "order-001",
        status: "delivered",
        clientAddress: "0xClient123",
        providerAddress: "0xProvider456",
        serviceType: "text_echo",
      })),
    })),
  },
}));

// Mock the rate limiter module
vi.mock("@/lib/ratings/rate-limiter", () => {
  const check = vi.fn(() => ({ allowed: true, remaining: 99 }));
  const reset = vi.fn();
  return {
    createRateLimiter: vi.fn(() => ({ check, reset })),
  };
});

import { submitRating } from "@/lib/ratings/rating-service";

const validSignature = "0x" + "ab".repeat(65);

function createPostRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL("/api/ratings", "http://localhost:3000"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  order_id: "order-001",
  stars: 5,
  review_text: "Great service!",
  signature: validSignature,
  timestamp: Date.now(),
};

describe("POST /api/ratings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limiter allows
    _rateLimiter.check = vi.fn(() => ({ allowed: true, remaining: 99 }));
  });

  it("returns 201 with rating_id for valid submission", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      ratingId: "rating-test-uuid",
    });

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.rating_id).toBe("rating-test-uuid");
  });

  it("returns 429 when rate limited", async () => {
    _rateLimiter.check = vi.fn(() => ({
      allowed: false,
      retryAfterMs: 30_000,
    }));

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.code).toBe("RATE_LIMITED");
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("returns 404 for ORDER_NOT_FOUND", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      code: "ORDER_NOT_FOUND",
      message: "Order not found.",
    });

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe("ORDER_NOT_FOUND");
  });

  it("returns 422 for ORDER_NOT_DELIVERED", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      code: "ORDER_NOT_DELIVERED",
      message: "Order is not delivered.",
    });

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe("ORDER_NOT_DELIVERED");
  });

  it("returns 401 for INVALID_SIGNATURE", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      code: "INVALID_SIGNATURE",
      message: "Signature does not match.",
    });

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe("INVALID_SIGNATURE");
  });

  it("returns 409 for DUPLICATE_RATING", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      code: "DUPLICATE_RATING",
      message: "A rating for this order has already been submitted.",
    });

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe("DUPLICATE_RATING");
  });

  it("returns 400 for TIMESTAMP_EXPIRED", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      code: "TIMESTAMP_EXPIRED",
      message: "Timestamp is outside the allowed window.",
    });

    const response = await POST(createPostRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("TIMESTAMP_EXPIRED");
  });

  it("returns 400 for invalid request body (missing stars)", async () => {
    const response = await POST(
      createPostRequest({
        order_id: "order-001",
        signature: validSignature,
        timestamp: Date.now(),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });

  it("returns 400 for stars out of range", async () => {
    const response = await POST(createPostRequest({ ...validBody, stars: 10 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });

  it("returns 400 for invalid JSON body", async () => {
    const request = new NextRequest(new URL("/api/ratings", "http://localhost:3000"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_JSON");
  });

  it("returns 400 for invalid signature format", async () => {
    const response = await POST(createPostRequest({ ...validBody, signature: "bad-sig" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });

  it("returns 400 for invalid order_id format", async () => {
    const response = await POST(
      createPostRequest({
        ...validBody,
        order_id: "../../etc/passwd",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe("INVALID_PARAMETERS");
  });

  it("passes timestamp to submitRating", async () => {
    (submitRating as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      ratingId: "rating-test-uuid",
    });

    const ts = Date.now();
    await POST(createPostRequest({ ...validBody, timestamp: ts }));

    expect(submitRating).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: ts }),
      expect.any(Function),
    );
  });
});
