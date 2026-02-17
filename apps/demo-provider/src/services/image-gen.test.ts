/**
 * Unit tests for the image_gen service handler.
 *
 * Validates:
 * - AC #2: image_gen returns a generated placeholder image
 * - AC #3: deliverables are properly formatted
 * - AC #4: content hashes are calculated for verification
 * - Error handling for invalid inputs
 */

import { describe, expect, it } from "vitest";
import { executeImageGen } from "./image-gen.js";
import { computeContentHash } from "./content-hash.js";

const TEST_ORDER_ID = "ivxp-550e8400-e29b-41d4-a716-446655440000";

describe("executeImageGen", () => {
  it("should return a valid SVG image (AC #2)", async () => {
    const result = await executeImageGen(TEST_ORDER_ID, "A sunset");

    expect(result.contentType).toBe("image/svg+xml");
    expect(result.content).toBeTypeOf("string");

    const svg = result.content as string;
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("IVXP Demo Image");
    expect(svg).toContain("A sunset");
  });

  it("should include the order ID in the SVG", async () => {
    const result = await executeImageGen(TEST_ORDER_ID, "Test prompt");
    const svg = result.content as string;
    // Order ID is truncated in display
    expect(svg).toContain("ivxp-550e8400-e29b-4");
  });

  it("should include correct content hash (AC #4)", async () => {
    const result = await executeImageGen(TEST_ORDER_ID, "Hash test");

    expect(result.contentHash).toBeTypeOf("string");
    expect(result.contentHash).toHaveLength(64);

    // Verify hash matches content
    const expectedHash = computeContentHash(result.content);
    expect(result.contentHash).toBe(expectedHash);
  });

  it("should include metadata with image dimensions", async () => {
    const result = await executeImageGen(TEST_ORDER_ID, "Metadata test");

    expect(result.metadata).toBeDefined();
    expect(result.metadata!["prompt"]).toBe("Metadata test");
    expect(result.metadata!["width"]).toBe(512);
    expect(result.metadata!["height"]).toBe(512);
    expect(result.metadata!["order_id"]).toBe(TEST_ORDER_ID);
    expect(result.metadata!["format"]).toBe("svg");
  });

  it("should escape XML special characters in prompt", async () => {
    const result = await executeImageGen(TEST_ORDER_ID, 'Test <script>alert("xss")</script>');
    const svg = result.content as string;

    // Should not contain raw HTML tags
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("should throw for empty description", async () => {
    await expect(executeImageGen(TEST_ORDER_ID, "")).rejects.toThrow("description is required");
  });

  it("should throw for whitespace-only description", async () => {
    await expect(executeImageGen(TEST_ORDER_ID, "   ")).rejects.toThrow(
      "description cannot be empty",
    );
  });

  it("should throw for prompt exceeding max length", async () => {
    const longPrompt = "x".repeat(201);
    await expect(executeImageGen(TEST_ORDER_ID, longPrompt)).rejects.toThrow(
      "exceeds maximum length",
    );
  });
});
