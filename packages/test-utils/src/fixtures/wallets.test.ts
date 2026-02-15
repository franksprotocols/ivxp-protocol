/**
 * Tests for wallet fixtures.
 */

import { describe, expect, it } from "vitest";
import {
  ANVIL_CHAIN_ID,
  ANVIL_RPC_URL,
  MOCK_USDC_ADDRESS,
  TEST_ACCOUNTS,
} from "./wallets.js";

describe("wallet fixtures", () => {
  describe("TEST_ACCOUNTS", () => {
    it("should have client, provider, thirdParty, and deployer accounts", () => {
      expect(TEST_ACCOUNTS.client).toBeDefined();
      expect(TEST_ACCOUNTS.provider).toBeDefined();
      expect(TEST_ACCOUNTS.thirdParty).toBeDefined();
      expect(TEST_ACCOUNTS.deployer).toBeDefined();
    });

    it("should have valid hex addresses starting with 0x", () => {
      for (const [, account] of Object.entries(TEST_ACCOUNTS)) {
        expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    });

    it("should have valid hex private keys starting with 0x", () => {
      for (const [, account] of Object.entries(TEST_ACCOUNTS)) {
        expect(account.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
      }
    });

    it("should have unique addresses for each account", () => {
      const addresses = Object.values(TEST_ACCOUNTS).map((a) => a.address);
      const unique = new Set(addresses);
      expect(unique.size).toBe(addresses.length);
    });
  });

  describe("MOCK_USDC_ADDRESS", () => {
    it("should be a valid hex address", () => {
      expect(MOCK_USDC_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("ANVIL_RPC_URL", () => {
    it("should point to localhost", () => {
      expect(ANVIL_RPC_URL).toContain("127.0.0.1");
    });
  });

  describe("ANVIL_CHAIN_ID", () => {
    it("should be 31337 (foundry default)", () => {
      expect(ANVIL_CHAIN_ID).toBe(31337);
    });
  });
});
