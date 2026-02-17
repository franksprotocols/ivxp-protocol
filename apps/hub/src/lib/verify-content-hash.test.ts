import { describe, it, expect } from "vitest";
import { computeSha256, verifyContentHash } from "./verify-content-hash";

describe("computeSha256", () => {
  it("computes correct SHA-256 for known input", async () => {
    const input = new TextEncoder().encode("hello world");
    const hash = await computeSha256(input.buffer as ArrayBuffer);
    // Known SHA-256 of "hello world"
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("computes correct SHA-256 for empty input", async () => {
    const input = new TextEncoder().encode("");
    const hash = await computeSha256(input.buffer as ArrayBuffer);
    // Known SHA-256 of empty string
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("verifyContentHash", () => {
  it("returns verified=true when hashes match (raw hex)", async () => {
    const content = new TextEncoder().encode("hello world");
    const correctHash =
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
    const result = await verifyContentHash(content.buffer as ArrayBuffer, correctHash);
    expect(result.verified).toBe(true);
    expect(result.computedHash).toContain("sha256:");
  });

  it("returns verified=true when hashes match (sha256: prefix)", async () => {
    const content = new TextEncoder().encode("hello world");
    const correctHash =
      "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
    const result = await verifyContentHash(content.buffer as ArrayBuffer, correctHash);
    expect(result.verified).toBe(true);
  });

  it("returns verified=false when hashes do not match", async () => {
    const content = new TextEncoder().encode("hello world");
    const wrongHash = "sha256:0000000000000000000000000000000000000000";
    const result = await verifyContentHash(content.buffer as ArrayBuffer, wrongHash);
    expect(result.verified).toBe(false);
  });

  it("includes both computed and claimed hashes in result", async () => {
    const content = new TextEncoder().encode("test");
    const claimed = "sha256:abc123";
    const result = await verifyContentHash(content.buffer as ArrayBuffer, claimed);
    expect(result.claimedHash).toBe(claimed);
    expect(result.computedHash).toMatch(/^sha256:/);
  });
});
