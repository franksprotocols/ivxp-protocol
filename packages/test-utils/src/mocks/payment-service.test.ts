/**
 * Tests for MockPaymentService.
 */

import { describe, expect, it } from "vitest";
import { MockPaymentService } from "./payment-service.js";
import { TEST_ACCOUNTS } from "../fixtures/wallets.js";

describe("MockPaymentService", () => {
  describe("send", () => {
    it("should return default tx hash", async () => {
      const service = new MockPaymentService();
      const hash = await service.send(
        TEST_ACCOUNTS.provider.address,
        "10.00",
      );
      expect(hash).toMatch(/^0x/);
      expect(hash.length).toBe(66);
    });

    it("should return custom tx hash when configured", async () => {
      const customHash =
        "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as `0x${string}`;
      const service = new MockPaymentService({
        txHashToReturn: customHash,
      });
      const hash = await service.send(
        TEST_ACCOUNTS.provider.address,
        "10.00",
      );
      expect(hash).toBe(customHash);
    });

    it("should throw when sendError is configured", async () => {
      const service = new MockPaymentService({
        sendError: new Error("insufficient balance"),
      });
      await expect(
        service.send(TEST_ACCOUNTS.provider.address, "10.00"),
      ).rejects.toThrow("insufficient balance");
    });

    it("should record send calls", async () => {
      const service = new MockPaymentService();
      await service.send(TEST_ACCOUNTS.provider.address, "10.00");
      await service.send(TEST_ACCOUNTS.client.address, "5.00");
      const calls = service.getSendCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0].to).toBe(TEST_ACCOUNTS.provider.address);
      expect(calls[0].amount).toBe("10.00");
      expect(calls[1].amount).toBe("5.00");
    });
  });

  describe("verify", () => {
    it("should return true by default", async () => {
      const service = new MockPaymentService();
      const result = await service.verify(
        "0x1234" as `0x${string}`,
        {
          from: TEST_ACCOUNTS.client.address,
          to: TEST_ACCOUNTS.provider.address,
          amount: "10.00",
        },
      );
      expect(result).toBe(true);
    });

    it("should return false when configured", async () => {
      const service = new MockPaymentService({ verifyResult: false });
      const result = await service.verify(
        "0x1234" as `0x${string}`,
        {
          from: TEST_ACCOUNTS.client.address,
          to: TEST_ACCOUNTS.provider.address,
          amount: "10.00",
        },
      );
      expect(result).toBe(false);
    });

    it("should record verify calls", async () => {
      const service = new MockPaymentService();
      await service.verify("0x1234" as `0x${string}`, {
        from: TEST_ACCOUNTS.client.address,
        to: TEST_ACCOUNTS.provider.address,
        amount: "10.00",
      });
      const calls = service.getVerifyCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].expected.amount).toBe("10.00");
    });
  });

  describe("getBalance", () => {
    it("should return default balance", async () => {
      const service = new MockPaymentService();
      const balance = await service.getBalance(
        TEST_ACCOUNTS.client.address,
      );
      expect(balance).toBe("1000.000000");
    });

    it("should return custom default balance when configured", async () => {
      const service = new MockPaymentService({
        defaultBalance: "500.000000",
      });
      const balance = await service.getBalance(
        TEST_ACCOUNTS.client.address,
      );
      expect(balance).toBe("500.000000");
    });

    it("should return per-address balance when set", async () => {
      const service = new MockPaymentService();
      service.setBalance(TEST_ACCOUNTS.client.address, "42.000000");
      const balance = await service.getBalance(
        TEST_ACCOUNTS.client.address,
      );
      expect(balance).toBe("42.000000");
    });

    it("should be case-insensitive for address lookup", async () => {
      const service = new MockPaymentService();
      service.setBalance(TEST_ACCOUNTS.client.address, "42.000000");
      const balance = await service.getBalance(
        TEST_ACCOUNTS.client.address.toLowerCase() as `0x${string}`,
      );
      expect(balance).toBe("42.000000");
    });

    it("should throw when getBalanceError is configured", async () => {
      const service = new MockPaymentService({
        getBalanceError: new Error("network error"),
      });
      await expect(
        service.getBalance(TEST_ACCOUNTS.client.address),
      ).rejects.toThrow("network error");
    });
  });

  describe("call management", () => {
    it("should track send call count", async () => {
      const service = new MockPaymentService();
      expect(service.getSendCallCount()).toBe(0);
      await service.send(TEST_ACCOUNTS.provider.address, "10.00");
      expect(service.getSendCallCount()).toBe(1);
    });

    it("should reset all calls", async () => {
      const service = new MockPaymentService();
      await service.send(TEST_ACCOUNTS.provider.address, "10.00");
      await service.verify("0x1234" as `0x${string}`, {
        from: TEST_ACCOUNTS.client.address,
        to: TEST_ACCOUNTS.provider.address,
        amount: "10.00",
      });
      await service.getBalance(TEST_ACCOUNTS.client.address);
      service.resetCalls();
      expect(service.getSendCalls()).toHaveLength(0);
      expect(service.getVerifyCalls()).toHaveLength(0);
      expect(service.getGetBalanceCalls()).toHaveLength(0);
    });
  });
});
