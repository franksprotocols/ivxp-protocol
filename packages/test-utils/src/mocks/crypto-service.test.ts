/**
 * Tests for MockCryptoService.
 */

import { describe, expect, it } from "vitest";
import { MockCryptoService } from "./crypto-service.js";
import { TEST_ACCOUNTS } from "../fixtures/wallets.js";

describe("MockCryptoService", () => {
  const createService = (
    overrides?: Partial<ConstructorParameters<typeof MockCryptoService>[0]>,
  ) =>
    new MockCryptoService({
      address: TEST_ACCOUNTS.client.address,
      ...overrides,
    });

  describe("getAddress", () => {
    it("should return the configured address", async () => {
      const service = createService();
      const address = await service.getAddress();
      expect(address).toBe(TEST_ACCOUNTS.client.address);
    });
  });

  describe("sign", () => {
    it("should return a deterministic signature by default", async () => {
      const service = createService();
      const sig = await service.sign("test message");
      expect(sig).toMatch(/^0x/);
    });

    it("should return custom signature when configured", async () => {
      const customSig = "0xdeadbeef" as `0x${string}`;
      const service = createService({ signatureToReturn: customSig });
      const sig = await service.sign("test message");
      expect(sig).toBe(customSig);
    });

    it("should throw when signError is configured", async () => {
      const service = createService({
        signError: new Error("sign failed"),
      });
      await expect(service.sign("test")).rejects.toThrow("sign failed");
    });

    it("should record calls", async () => {
      const service = createService();
      await service.sign("message 1");
      await service.sign("message 2");
      const calls = service.getSignCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0].message).toBe("message 1");
      expect(calls[1].message).toBe("message 2");
    });
  });

  describe("verify", () => {
    it("should return true by default", async () => {
      const service = createService();
      const result = await service.verify(
        "test",
        "0xsig" as `0x${string}`,
        TEST_ACCOUNTS.provider.address,
      );
      expect(result).toBe(true);
    });

    it("should return false when configured", async () => {
      const service = createService({ verifyResult: false });
      const result = await service.verify(
        "test",
        "0xsig" as `0x${string}`,
        TEST_ACCOUNTS.provider.address,
      );
      expect(result).toBe(false);
    });

    it("should throw when verifyError is configured", async () => {
      const service = createService({
        verifyError: new Error("verify failed"),
      });
      await expect(
        service.verify(
          "test",
          "0xsig" as `0x${string}`,
          TEST_ACCOUNTS.provider.address,
        ),
      ).rejects.toThrow("verify failed");
    });

    it("should record calls", async () => {
      const service = createService();
      await service.verify(
        "test",
        "0xsig" as `0x${string}`,
        TEST_ACCOUNTS.provider.address,
      );
      const calls = service.getVerifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].message).toBe("test");
      expect(calls[0].expectedAddress).toBe(TEST_ACCOUNTS.provider.address);
    });
  });

  describe("call counting", () => {
    it("should track sign call count", async () => {
      const service = createService();
      expect(service.getSignCallCount()).toBe(0);
      await service.sign("test");
      expect(service.getSignCallCount()).toBe(1);
    });

    it("should track verify call count", async () => {
      const service = createService();
      expect(service.getVerifyCallCount()).toBe(0);
      await service.verify(
        "test",
        "0xsig" as `0x${string}`,
        TEST_ACCOUNTS.provider.address,
      );
      expect(service.getVerifyCallCount()).toBe(1);
    });

    it("should reset calls", async () => {
      const service = createService();
      await service.sign("test");
      await service.verify(
        "test",
        "0xsig" as `0x${string}`,
        TEST_ACCOUNTS.provider.address,
      );
      service.resetCalls();
      expect(service.getSignCallCount()).toBe(0);
      expect(service.getVerifyCallCount()).toBe(0);
    });
  });
});
