/**
 * Tests for helper utilities.
 */

import { describe, expect, it } from "vitest";
import { delay, waitFor, flushMicrotasks } from "./wait.js";
import {
  assertHexAddress,
  assertHexHash,
  assertOrderIdFormat,
  assertOrderStatus,
  assertProtocolVersion,
  assertValidOrder,
} from "./assertions.js";
import { createMockOrder, resetOrderCounter } from "../fixtures/orders.js";

describe("wait helpers", () => {
  describe("delay", () => {
    it("should resolve after specified time", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe("waitFor", () => {
    it("should resolve when condition becomes true", async () => {
      let counter = 0;
      const condition = () => {
        counter += 1;
        return counter >= 3;
      };
      await waitFor(condition, { interval: 10, timeout: 1000 });
      expect(counter).toBeGreaterThanOrEqual(3);
    });

    it("should throw on timeout", async () => {
      await expect(
        waitFor(() => false, {
          timeout: 100,
          interval: 10,
          timeoutMessage: "custom timeout",
        }),
      ).rejects.toThrow("custom timeout");
    });

    it("should support async conditions", async () => {
      let counter = 0;
      await waitFor(
        async () => {
          counter += 1;
          return counter >= 2;
        },
        { interval: 10, timeout: 1000 },
      );
      expect(counter).toBeGreaterThanOrEqual(2);
    });
  });

  describe("flushMicrotasks", () => {
    it("should resolve microtasks", async () => {
      let resolved = false;
      Promise.resolve().then(() => {
        resolved = true;
      });
      await flushMicrotasks();
      expect(resolved).toBe(true);
    });
  });
});

describe("assertion helpers", () => {
  describe("assertHexAddress", () => {
    it("should pass for valid hex address", () => {
      expect(() => assertHexAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).not.toThrow();
    });

    it("should throw for non-string", () => {
      expect(() => assertHexAddress(42)).toThrow("to be a string");
    });

    it("should throw for missing 0x prefix", () => {
      expect(() => assertHexAddress("f39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toThrow(
        'start with "0x"',
      );
    });

    it("should throw for wrong length", () => {
      expect(() => assertHexAddress("0x1234")).toThrow("42 characters");
    });
  });

  describe("assertHexHash", () => {
    it("should pass for valid hex hash", () => {
      expect(() =>
        assertHexHash("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
      ).not.toThrow();
    });

    it("should throw for wrong length", () => {
      expect(() => assertHexHash("0x1234")).toThrow("66 characters");
    });
  });

  describe("assertOrderStatus", () => {
    it("should pass for matching status", () => {
      resetOrderCounter();
      const order = createMockOrder("paid");
      expect(() => assertOrderStatus(order, "paid")).not.toThrow();
    });

    it("should throw for mismatched status", () => {
      resetOrderCounter();
      const order = createMockOrder("quoted");
      expect(() => assertOrderStatus(order, "paid")).toThrow('status "paid"');
    });
  });

  describe("assertValidOrder", () => {
    it("should pass for valid order", () => {
      resetOrderCounter();
      const order = createMockOrder("quoted");
      expect(() => assertValidOrder(order)).not.toThrow();
    });

    it("should throw for empty string fields", () => {
      resetOrderCounter();
      const order = createMockOrder("quoted", {
        serviceType: "",
      });
      expect(() => assertValidOrder(order)).toThrow("non-empty");
    });
  });

  describe("assertOrderIdFormat", () => {
    it("should pass for valid order ID", () => {
      expect(() => assertOrderIdFormat("ivxp-550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
    });

    it("should throw for invalid format", () => {
      expect(() => assertOrderIdFormat("order-123")).toThrow('start with "ivxp-"');
    });
  });

  describe("assertProtocolVersion", () => {
    it("should pass for IVXP/1.0", () => {
      expect(() => assertProtocolVersion("IVXP/1.0")).not.toThrow();
    });

    it("should throw for wrong version", () => {
      expect(() => assertProtocolVersion("IVXP/2.0")).toThrow("IVXP/1.0");
    });
  });
});
