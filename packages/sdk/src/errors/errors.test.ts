/**
 * Error classes unit tests.
 *
 * Tests IVXPError, InsufficientBalanceError, TransactionError,
 * and TransactionSubmissionError for correct inheritance, properties,
 * error cause chain, and behavior.
 */

import { describe, expect, it } from "vitest";
import { IVXPError } from "./base.js";
import {
  InsufficientBalanceError,
  TransactionError,
  TransactionSubmissionError,
} from "./specific.js";

// ---------------------------------------------------------------------------
// IVXPError
// ---------------------------------------------------------------------------

describe("IVXPError", () => {
  it("should be an instance of Error", () => {
    const error = new IVXPError("test message", "TEST_CODE");
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of IVXPError", () => {
    const error = new IVXPError("test message", "TEST_CODE");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should have the correct message", () => {
    const error = new IVXPError("something went wrong", "GENERIC_ERROR");
    expect(error.message).toBe("something went wrong");
  });

  it("should have the correct error code", () => {
    const error = new IVXPError("test", "MY_ERROR_CODE");
    expect(error.code).toBe("MY_ERROR_CODE");
  });

  it("should have the name IVXPError", () => {
    const error = new IVXPError("test", "CODE");
    expect(error.name).toBe("IVXPError");
  });

  it("should have a stack trace", () => {
    const error = new IVXPError("test", "CODE");
    expect(error.stack).toBeDefined();
  });

  // Error cause chain tests (Fix #1 / Fix #10)
  it("should store the cause when provided", () => {
    const original = new Error("root cause");
    const error = new IVXPError("wrapper", "WRAPPED", original);
    expect(error.cause).toBe(original);
  });

  it("should have undefined cause when not provided", () => {
    const error = new IVXPError("no cause", "CODE");
    expect(error.cause).toBeUndefined();
  });

  it("should support non-Error cause values", () => {
    const error = new IVXPError("wrapper", "CODE", "string cause");
    expect(error.cause).toBe("string cause");
  });

  it("should support nested error cause chains", () => {
    const root = new Error("root");
    const middle = new IVXPError("middle", "MID", root);
    const outer = new IVXPError("outer", "OUT", middle);

    expect(outer.cause).toBe(middle);
    expect((outer.cause as IVXPError).cause).toBe(root);
  });

  it("should be JSON serializable with code and message", () => {
    const error = new IVXPError("test message", "TEST_CODE");
    const serialized = JSON.parse(JSON.stringify({
      name: error.name,
      message: error.message,
      code: error.code,
    }));
    expect(serialized.name).toBe("IVXPError");
    expect(serialized.message).toBe("test message");
    expect(serialized.code).toBe("TEST_CODE");
  });
});

// ---------------------------------------------------------------------------
// InsufficientBalanceError
// ---------------------------------------------------------------------------

describe("InsufficientBalanceError", () => {
  it("should be an instance of Error", () => {
    const error = new InsufficientBalanceError("insufficient", "10.00", "50.00");
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of IVXPError", () => {
    const error = new InsufficientBalanceError("insufficient", "10.00", "50.00");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of InsufficientBalanceError", () => {
    const error = new InsufficientBalanceError("insufficient", "10.00", "50.00");
    expect(error).toBeInstanceOf(InsufficientBalanceError);
  });

  it("should have the correct message", () => {
    const error = new InsufficientBalanceError(
      "Insufficient USDC balance: 10.00 < 50.00",
      "10.00",
      "50.00",
    );
    expect(error.message).toBe("Insufficient USDC balance: 10.00 < 50.00");
  });

  it("should have the INSUFFICIENT_BALANCE error code", () => {
    const error = new InsufficientBalanceError("msg", "10.00", "50.00");
    expect(error.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("should have the name InsufficientBalanceError", () => {
    const error = new InsufficientBalanceError("msg", "10.00", "50.00");
    expect(error.name).toBe("InsufficientBalanceError");
  });

  it("should expose availableBalance", () => {
    const error = new InsufficientBalanceError("msg", "25.500000", "100.00");
    expect(error.availableBalance).toBe("25.500000");
  });

  it("should expose requiredAmount", () => {
    const error = new InsufficientBalanceError("msg", "25.500000", "100.00");
    expect(error.requiredAmount).toBe("100.00");
  });

  it("should be catchable as IVXPError", () => {
    const error = new InsufficientBalanceError("msg", "10.00", "50.00");
    try {
      throw error;
    } catch (e) {
      expect(e).toBeInstanceOf(IVXPError);
      if (e instanceof IVXPError) {
        expect(e.code).toBe("INSUFFICIENT_BALANCE");
      }
    }
  });

  it("should support error cause chain", () => {
    const original = new Error("RPC failed");
    const error = new InsufficientBalanceError("msg", "10.00", "50.00", original);
    expect(error.cause).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// TransactionError
// ---------------------------------------------------------------------------

describe("TransactionError", () => {
  const sampleHash =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

  it("should be an instance of IVXPError", () => {
    const error = new TransactionError("reverted", sampleHash);
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should have the TRANSACTION_FAILED error code", () => {
    const error = new TransactionError("reverted", sampleHash);
    expect(error.code).toBe("TRANSACTION_FAILED");
  });

  it("should have the name TransactionError", () => {
    const error = new TransactionError("reverted", sampleHash);
    expect(error.name).toBe("TransactionError");
  });

  it("should require txHash (always defined)", () => {
    const error = new TransactionError("reverted", sampleHash);
    expect(error.txHash).toBe(sampleHash);
  });

  it("should support error cause chain", () => {
    const original = new Error("revert reason");
    const error = new TransactionError("reverted", sampleHash, original);
    expect(error.cause).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// TransactionSubmissionError
// ---------------------------------------------------------------------------

describe("TransactionSubmissionError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new TransactionSubmissionError("submission failed");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new TransactionSubmissionError("submission failed");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the TRANSACTION_SUBMISSION_FAILED error code", () => {
    const error = new TransactionSubmissionError("submission failed");
    expect(error.code).toBe("TRANSACTION_SUBMISSION_FAILED");
  });

  it("should have the name TransactionSubmissionError", () => {
    const error = new TransactionSubmissionError("submission failed");
    expect(error.name).toBe("TransactionSubmissionError");
  });

  it("should not have a txHash property", () => {
    const error = new TransactionSubmissionError("submission failed");
    expect(error).not.toHaveProperty("txHash");
  });

  it("should support error cause chain", () => {
    const original = new Error("ECONNREFUSED");
    const error = new TransactionSubmissionError("failed", original);
    expect(error.cause).toBe(original);
  });

  it("should have undefined cause when not provided", () => {
    const error = new TransactionSubmissionError("failed");
    expect(error.cause).toBeUndefined();
  });

  it("should be distinguishable from TransactionError", () => {
    const sampleHash =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;
    const txError = new TransactionError("reverted", sampleHash);
    const subError = new TransactionSubmissionError("submission failed");

    expect(txError).not.toBeInstanceOf(TransactionSubmissionError);
    expect(subError).not.toBeInstanceOf(TransactionError);
    expect(txError.code).not.toBe(subError.code);
  });
});
