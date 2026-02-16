import { describe, it, expect, vi, afterEach } from "vitest";
import { base, baseSepolia } from "wagmi/chains";
import {
  isSupportedChain,
  getChainName,
  getTargetChain,
  SUPPORTED_CHAIN_IDS,
  UNKNOWN_CHAIN_NAME,
} from "./network-constants";

describe("network-constants", () => {
  describe("SUPPORTED_CHAIN_IDS", () => {
    it("includes Base Mainnet", () => {
      expect(SUPPORTED_CHAIN_IDS).toContain(base.id);
    });

    it("includes Base Sepolia", () => {
      expect(SUPPORTED_CHAIN_IDS).toContain(baseSepolia.id);
    });

    it("has exactly 2 supported chains", () => {
      expect(SUPPORTED_CHAIN_IDS).toHaveLength(2);
    });
  });

  describe("isSupportedChain", () => {
    it("returns true for Base Mainnet", () => {
      expect(isSupportedChain(base.id)).toBe(true);
    });

    it("returns true for Base Sepolia", () => {
      expect(isSupportedChain(baseSepolia.id)).toBe(true);
    });

    it("returns false for Ethereum Mainnet", () => {
      expect(isSupportedChain(1)).toBe(false);
    });

    it("returns false for arbitrary chain ID", () => {
      expect(isSupportedChain(999)).toBe(false);
    });

    it("returns false for zero", () => {
      expect(isSupportedChain(0)).toBe(false);
    });

    it("returns false for negative chain ID", () => {
      expect(isSupportedChain(-1)).toBe(false);
    });

    it("returns false for MAX_SAFE_INTEGER", () => {
      expect(isSupportedChain(Number.MAX_SAFE_INTEGER)).toBe(false);
    });
  });

  describe("getChainName", () => {
    it("returns 'Base' for Base Mainnet", () => {
      expect(getChainName(base.id)).toBe("Base");
    });

    it("returns 'Base Sepolia' for Base Sepolia", () => {
      expect(getChainName(baseSepolia.id)).toBe("Base Sepolia");
    });

    it("returns UNKNOWN_CHAIN_NAME for unsupported chain", () => {
      expect(getChainName(1)).toBe(UNKNOWN_CHAIN_NAME);
    });
  });

  describe("getTargetChain", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("returns Base Mainnet in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(getTargetChain().id).toBe(base.id);
    });

    it("returns Base Sepolia in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(getTargetChain().id).toBe(baseSepolia.id);
    });

    it("returns Base Sepolia in test", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(getTargetChain().id).toBe(baseSepolia.id);
    });
  });
});
