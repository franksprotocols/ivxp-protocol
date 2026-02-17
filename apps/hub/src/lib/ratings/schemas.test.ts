import { describe, it, expect } from "vitest";
import { submitRatingBodySchema } from "./schemas";

describe("submitRatingBodySchema", () => {
  const validBody = {
    order_id: "order-123",
    stars: 5,
    review_text: "Great service!",
    signature: "0x" + "ab".repeat(65),
    timestamp: Date.now(),
  };

  it("accepts valid rating body with review", () => {
    const result = submitRatingBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("accepts valid rating body without review", () => {
    const { review_text: _, ...bodyWithoutReview } = validBody;
    const result = submitRatingBodySchema.safeParse(bodyWithoutReview);
    expect(result.success).toBe(true);
  });

  it("rejects stars below 1", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      stars: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects stars above 5", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      stars: 6,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer stars", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      stars: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty order_id", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      order_id: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects order_id with special characters", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      order_id: "order/../../../etc/passwd",
    });
    expect(result.success).toBe(false);
  });

  it("rejects order_id with spaces", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      order_id: "order 123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts order_id with hyphens and underscores", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      order_id: "order-123_abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid signature format", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      signature: "not-a-signature",
    });
    expect(result.success).toBe(false);
  });

  it("rejects review_text exceeding 1000 characters", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      review_text: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts review_text at exactly 1000 characters", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      review_text: "x".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing signature", () => {
    const { signature: _, ...bodyWithoutSig } = validBody;
    const result = submitRatingBodySchema.safeParse(bodyWithoutSig);
    expect(result.success).toBe(false);
  });

  it("rejects missing timestamp", () => {
    const { timestamp: _, ...bodyWithoutTs } = validBody;
    const result = submitRatingBodySchema.safeParse(bodyWithoutTs);
    expect(result.success).toBe(false);
  });

  it("rejects negative timestamp", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      timestamp: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer timestamp", () => {
    const result = submitRatingBodySchema.safeParse({
      ...validBody,
      timestamp: 1700000000.5,
    });
    expect(result.success).toBe(false);
  });
});
