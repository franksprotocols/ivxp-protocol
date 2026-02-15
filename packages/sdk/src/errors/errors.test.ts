/**
 * Error classes unit tests.
 *
 * Tests IVXPError, InsufficientBalanceError, TransactionError,
 * TransactionSubmissionError, and payment verification error classes
 * for correct inheritance, properties, error cause chain, and behavior.
 */

import { describe, expect, it } from "vitest";
import { IVXPError } from "./base.js";
import {
  InsufficientBalanceError,
  TransactionError,
  TransactionSubmissionError,
  PaymentNotFoundError,
  PaymentPendingError,
  PaymentFailedError,
  PaymentAmountMismatchError,
  SignatureVerificationError,
  PaymentVerificationError,
  OrderNotFoundError,
  ServiceUnavailableError,
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
    const serialized = JSON.parse(
      JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
      }),
    );
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

// ---------------------------------------------------------------------------
// PaymentNotFoundError
// ---------------------------------------------------------------------------

describe("PaymentNotFoundError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new PaymentNotFoundError("not found");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new PaymentNotFoundError("not found");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the PAYMENT_NOT_FOUND error code", () => {
    const error = new PaymentNotFoundError("not found");
    expect(error.code).toBe("PAYMENT_NOT_FOUND");
  });

  it("should have the name PaymentNotFoundError", () => {
    const error = new PaymentNotFoundError("not found");
    expect(error.name).toBe("PaymentNotFoundError");
  });

  it("should have the correct message", () => {
    const error = new PaymentNotFoundError("Transaction 0x123 not found");
    expect(error.message).toBe("Transaction 0x123 not found");
  });

  it("should support error cause chain", () => {
    const cause = new Error("RPC error");
    const error = new PaymentNotFoundError("not found", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new PaymentNotFoundError("not found");
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PaymentPendingError
// ---------------------------------------------------------------------------

describe("PaymentPendingError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new PaymentPendingError("pending");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new PaymentPendingError("pending");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the PAYMENT_PENDING error code", () => {
    const error = new PaymentPendingError("pending");
    expect(error.code).toBe("PAYMENT_PENDING");
  });

  it("should have the name PaymentPendingError", () => {
    const error = new PaymentPendingError("pending");
    expect(error.name).toBe("PaymentPendingError");
  });

  it("should support error cause chain", () => {
    const cause = new Error("underlying");
    const error = new PaymentPendingError("pending", cause);
    expect(error.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// PaymentFailedError
// ---------------------------------------------------------------------------

describe("PaymentFailedError", () => {
  const sampleHash =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

  it("should be an instance of IVXPError", () => {
    const error = new PaymentFailedError("reverted", sampleHash);
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new PaymentFailedError("reverted", sampleHash);
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the PAYMENT_FAILED error code", () => {
    const error = new PaymentFailedError("reverted", sampleHash);
    expect(error.code).toBe("PAYMENT_FAILED");
  });

  it("should have the name PaymentFailedError", () => {
    const error = new PaymentFailedError("reverted", sampleHash);
    expect(error.name).toBe("PaymentFailedError");
  });

  it("should expose txHash", () => {
    const error = new PaymentFailedError("reverted", sampleHash);
    expect(error.txHash).toBe(sampleHash);
  });

  it("should support error cause chain", () => {
    const cause = new Error("revert reason");
    const error = new PaymentFailedError("reverted", sampleHash, cause);
    expect(error.cause).toBe(cause);
  });
});

// ---------------------------------------------------------------------------
// PaymentAmountMismatchError
// ---------------------------------------------------------------------------

describe("PaymentAmountMismatchError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the PAYMENT_AMOUNT_MISMATCH error code", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error.code).toBe("PAYMENT_AMOUNT_MISMATCH");
  });

  it("should have the name PaymentAmountMismatchError", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error.name).toBe("PaymentAmountMismatchError");
  });

  it("should expose expectedAmount", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error.expectedAmount).toBe("10.00");
  });

  it("should expose actualAmount", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error.actualAmount).toBe("5.00");
  });

  it("should support error cause chain", () => {
    const cause = new Error("root");
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error.cause).toBeUndefined();
  });

  it("should be distinguishable from PaymentNotFoundError", () => {
    const mismatchError = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    const notFoundError = new PaymentNotFoundError("not found");

    expect(mismatchError).not.toBeInstanceOf(PaymentNotFoundError);
    expect(notFoundError).not.toBeInstanceOf(PaymentAmountMismatchError);
    expect(mismatchError.code).not.toBe(notFoundError.code);
  });
});

// ---------------------------------------------------------------------------
// SignatureVerificationError
// ---------------------------------------------------------------------------

describe("SignatureVerificationError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new SignatureVerificationError("invalid signature");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new SignatureVerificationError("invalid signature");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the SIGNATURE_INVALID error code", () => {
    const error = new SignatureVerificationError("invalid");
    expect(error.code).toBe("SIGNATURE_INVALID");
  });

  it("should have the name SignatureVerificationError", () => {
    const error = new SignatureVerificationError("invalid");
    expect(error.name).toBe("SignatureVerificationError");
  });

  it("should have the correct message", () => {
    const error = new SignatureVerificationError("EIP-191 signature is invalid");
    expect(error.message).toBe("EIP-191 signature is invalid");
  });

  it("should support error cause chain", () => {
    const cause = new Error("crypto error");
    const error = new SignatureVerificationError("invalid", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new SignatureVerificationError("invalid");
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PaymentVerificationError
// ---------------------------------------------------------------------------

describe("PaymentVerificationError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new PaymentVerificationError("payment not verified");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new PaymentVerificationError("payment not verified");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the PAYMENT_NOT_VERIFIED error code", () => {
    const error = new PaymentVerificationError("not verified");
    expect(error.code).toBe("PAYMENT_NOT_VERIFIED");
  });

  it("should have the name PaymentVerificationError", () => {
    const error = new PaymentVerificationError("not verified");
    expect(error.name).toBe("PaymentVerificationError");
  });

  it("should support error cause chain", () => {
    const cause = new Error("on-chain error");
    const error = new PaymentVerificationError("not verified", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new PaymentVerificationError("not verified");
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OrderNotFoundError
// ---------------------------------------------------------------------------

describe("OrderNotFoundError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new OrderNotFoundError("not found");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new OrderNotFoundError("not found");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the ORDER_NOT_FOUND error code", () => {
    const error = new OrderNotFoundError("not found");
    expect(error.code).toBe("ORDER_NOT_FOUND");
  });

  it("should have the name OrderNotFoundError", () => {
    const error = new OrderNotFoundError("not found");
    expect(error.name).toBe("OrderNotFoundError");
  });

  it("should support error cause chain", () => {
    const cause = new Error("db error");
    const error = new OrderNotFoundError("not found", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new OrderNotFoundError("not found");
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ServiceUnavailableError
// ---------------------------------------------------------------------------

describe("ServiceUnavailableError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new ServiceUnavailableError("service down");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new ServiceUnavailableError("service down");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the SERVICE_UNAVAILABLE error code", () => {
    const error = new ServiceUnavailableError("unavailable");
    expect(error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("should have the name ServiceUnavailableError", () => {
    const error = new ServiceUnavailableError("unavailable");
    expect(error.name).toBe("ServiceUnavailableError");
  });

  it("should support error cause chain", () => {
    const cause = new Error("ECONNREFUSED");
    const error = new ServiceUnavailableError("unavailable", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new ServiceUnavailableError("unavailable");
    expect(error.cause).toBeUndefined();
  });

  it("should be distinguishable from SignatureVerificationError", () => {
    const svcError = new ServiceUnavailableError("unavailable");
    const sigError = new SignatureVerificationError("invalid");

    expect(svcError).not.toBeInstanceOf(SignatureVerificationError);
    expect(sigError).not.toBeInstanceOf(ServiceUnavailableError);
    expect(svcError.code).not.toBe(sigError.code);
  });
});
