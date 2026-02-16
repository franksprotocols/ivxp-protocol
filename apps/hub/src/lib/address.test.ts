import { describe, it, expect } from "vitest";
import { truncateAddress, isValidAddress } from "./address";

describe("isValidAddress", () => {
  it("returns true for a valid lowercase address", () => {
    expect(isValidAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
  });

  it("returns true for a valid mixed-case address", () => {
    expect(isValidAddress("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12")).toBe(true);
  });

  it("returns false for missing 0x prefix", () => {
    expect(isValidAddress("1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });

  it("returns false for too-short address", () => {
    expect(isValidAddress("0x1234")).toBe(false);
  });

  it("returns false for non-hex characters", () => {
    expect(isValidAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidAddress("")).toBe(false);
  });

  it("returns false for special characters", () => {
    expect(isValidAddress("0x!@#$%^&*()!@#$%^&*()!@#$%^&*()!@#$%^&*()")).toBe(false);
  });
});

describe("truncateAddress", () => {
  it("truncates a valid ethereum address", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    expect(truncateAddress(address)).toBe("0x1234...5678");
  });

  it("uses custom start and end lengths", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    expect(truncateAddress(address, 8, 6)).toBe("0x123456...345678");
  });

  it("handles undefined input", () => {
    expect(truncateAddress(undefined)).toBe("");
  });

  it("handles empty string", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("returns empty string for invalid address (too short)", () => {
    expect(truncateAddress("0x1234")).toBe("");
  });

  it("returns empty string for non-hex strings", () => {
    expect(truncateAddress("not-an-address")).toBe("");
  });

  it("returns empty string for address with special characters", () => {
    expect(truncateAddress("0x!@#$%^&*()!@#$%^&*()!@#$%^&*()!@#$%^&*()")).toBe("");
  });

  it("returns empty string for address missing 0x prefix", () => {
    expect(truncateAddress("1234567890abcdef1234567890abcdef12345678")).toBe("");
  });
});
