import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildRatingMessage,
  generateRatingId,
  submitRating,
  sanitizeReviewText,
} from "./rating-service";

// Mock the storage module
vi.mock("./rating-storage", () => ({
  loadRatings: vi.fn(() => []),
  isDuplicateRating: vi.fn(() => false),
  addRating: vi.fn(async (rating) => rating),
}));

// Mock viem's recoverMessageAddress
vi.mock("viem", () => ({
  recoverMessageAddress: vi.fn(() => "0xClient123"),
}));

import { isDuplicateRating } from "./rating-storage";
import { recoverMessageAddress } from "viem";

const mockOrder = {
  orderId: "order-001",
  status: "delivered",
  clientAddress: "0xClient123",
  providerAddress: "0xProvider456",
  serviceType: "text_echo",
};

describe("buildRatingMessage", () => {
  it("builds message without review", () => {
    const msg = buildRatingMessage({
      orderId: "order-001",
      stars: 5,
      timestamp: 1700000000000,
    });
    expect(msg).toContain("IVXP Rating Submission");
    expect(msg).toContain("Order: order-001");
    expect(msg).toContain("Stars: 5");
    expect(msg).toContain("Timestamp: 1700000000000");
    expect(msg).not.toContain("Review:");
  });

  it("builds message with review", () => {
    const msg = buildRatingMessage({
      orderId: "order-001",
      stars: 3,
      reviewText: "Good service",
      timestamp: 1700000000000,
    });
    expect(msg).toContain("Review: Good service");
  });
});

describe("generateRatingId", () => {
  it("generates a string starting with rating-", () => {
    const id = generateRatingId();
    expect(id).toMatch(/^rating-/);
  });

  it("generates unique IDs", () => {
    const id1 = generateRatingId();
    const id2 = generateRatingId();
    expect(id1).not.toBe(id2);
  });
});

describe("sanitizeReviewText", () => {
  it("escapes basic HTML tags", () => {
    expect(sanitizeReviewText("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
    );
  });

  it("escapes double quotes", () => {
    expect(sanitizeReviewText('a "quoted" word')).toBe("a &quot;quoted&quot; word");
  });

  it("escapes single quotes", () => {
    expect(sanitizeReviewText("it's")).toBe("it&#x27;s");
  });

  it("escapes ampersands", () => {
    expect(sanitizeReviewText("a & b")).toBe("a &amp; b");
  });

  it("escapes forward slashes", () => {
    expect(sanitizeReviewText("a/b")).toBe("a&#x2F;b");
  });

  it("escapes backticks", () => {
    expect(sanitizeReviewText("`code`")).toBe("&#96;code&#96;");
  });

  it("escapes img onerror XSS vector", () => {
    const input = '<img src=x onerror="alert(1)">';
    const result = sanitizeReviewText(input);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
    // onerror is safe as plain text when angle brackets are escaped
  });

  it("escapes SVG onload XSS vector", () => {
    const input = '<svg onload="alert(1)">';
    const result = sanitizeReviewText(input);
    expect(result).not.toContain("<svg");
    expect(result).toContain("&lt;svg");
  });

  it("escapes javascript: protocol", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeReviewText(input);
    expect(result).not.toContain("<a");
    expect(result).toContain("&lt;a");
  });

  it("escapes event handler attributes", () => {
    const input = '<div onmouseover="alert(1)">hover</div>';
    const result = sanitizeReviewText(input);
    expect(result).not.toContain("<div");
    expect(result).toContain("&lt;div");
  });

  it("escapes nested encoding attempts", () => {
    const input = "&lt;script&gt;alert(1)&lt;/script&gt;";
    const result = sanitizeReviewText(input);
    expect(result).toContain("&amp;lt;");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeReviewText("")).toBe("");
  });

  it("preserves safe text unchanged (except slashes)", () => {
    expect(sanitizeReviewText("Hello world 123")).toBe("Hello world 123");
  });
});

describe("submitRating", () => {
  const validParams = {
    orderId: "order-001",
    stars: 5 as const,
    reviewText: "Great!",
    signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
    timestamp: Date.now(),
  };

  const getOrder = vi.fn(() => mockOrder);

  beforeEach(() => {
    vi.clearAllMocks();
    getOrder.mockReturnValue(mockOrder);
    (recoverMessageAddress as ReturnType<typeof vi.fn>).mockResolvedValue("0xClient123");
    (isDuplicateRating as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  it("returns success for valid rating submission", async () => {
    const result = await submitRating(validParams, getOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ratingId).toMatch(/^rating-/);
    }
  });

  it("returns TIMESTAMP_EXPIRED when timestamp is too old", async () => {
    const oldParams = {
      ...validParams,
      timestamp: Date.now() - 6 * 60 * 1000,
    };
    const result = await submitRating(oldParams, getOrder);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("TIMESTAMP_EXPIRED");
    }
  });

  it("returns TIMESTAMP_EXPIRED when timestamp is in the future", async () => {
    const futureParams = {
      ...validParams,
      timestamp: Date.now() + 6 * 60 * 1000,
    };
    const result = await submitRating(futureParams, getOrder);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("TIMESTAMP_EXPIRED");
    }
  });

  it("accepts timestamp within 5 minute window", async () => {
    const recentParams = {
      ...validParams,
      timestamp: Date.now() - 4 * 60 * 1000,
    };
    const result = await submitRating(recentParams, getOrder);
    expect(result.success).toBe(true);
  });

  it("returns ORDER_NOT_FOUND when order does not exist", async () => {
    getOrder.mockReturnValue(undefined);
    const result = await submitRating(validParams, getOrder);
    expect(result).toEqual({
      success: false,
      code: "ORDER_NOT_FOUND",
      message: "Order not found.",
    });
  });

  it("returns ORDER_NOT_DELIVERED when order is not delivered", async () => {
    getOrder.mockReturnValue({ ...mockOrder, status: "processing" });
    const result = await submitRating(validParams, getOrder);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("ORDER_NOT_DELIVERED");
    }
  });

  it("returns INVALID_SIGNATURE when recovery fails", async () => {
    (recoverMessageAddress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("bad sig"));
    const result = await submitRating(validParams, getOrder);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_SIGNATURE");
    }
  });

  it("returns INVALID_SIGNATURE when recovered address does not match", async () => {
    (recoverMessageAddress as ReturnType<typeof vi.fn>).mockResolvedValue("0xWrongAddress");
    const result = await submitRating(validParams, getOrder);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_SIGNATURE");
    }
  });

  it("returns DUPLICATE_RATING when rating already exists", async () => {
    (isDuplicateRating as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const result = await submitRating(validParams, getOrder);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("DUPLICATE_RATING");
    }
  });

  it("sanitizes review text with HTML entities", async () => {
    const { addRating } = await import("./rating-storage");
    const paramsWithXss = {
      ...validParams,
      reviewText: '<script>alert("xss")</script>',
    };
    await submitRating(paramsWithXss, getOrder);
    const savedRating = (addRating as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedRating.review_text).not.toContain("<script>");
    expect(savedRating.review_text).toContain("&lt;script&gt;");
  });

  it("uses client timestamp for signature verification", async () => {
    const ts = Date.now() - 60_000;
    const paramsWithTs = { ...validParams, timestamp: ts };
    await submitRating(paramsWithTs, getOrder);
    expect(recoverMessageAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(`Timestamp: ${ts}`),
      }),
    );
  });

  it("stores client timestamp as created_at", async () => {
    const { addRating } = await import("./rating-storage");
    const ts = Date.now() - 30_000;
    const paramsWithTs = { ...validParams, timestamp: ts };
    await submitRating(paramsWithTs, getOrder);
    const savedRating = (addRating as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(savedRating.created_at).toBe(ts);
  });
});
