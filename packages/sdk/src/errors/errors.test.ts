/**
 * Error classes unit tests.
 *
 * Tests the full IVXP error class hierarchy including:
 * - IVXPError base class (inheritance, toJSON, details, cause chain)
 * - All specific error subclasses (payment, verification, order, network, polling)
 * - PartialSuccessError (txHash recovery, recoverable flag, originalError)
 * - Error code uniqueness across the hierarchy
 * - JSON serialization for structured logging
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
  OrderExpiredError,
  ServiceUnavailableError,
  MaxPollAttemptsError,
  PartialSuccessError,
  BudgetExceededError,
  TimeoutError,
  ProviderError,
} from "./specific.js";
import { ERROR_CODES } from "./index.js";

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

  // Details tests
  it("should store details when provided", () => {
    const details = { key: "value", count: 42 };
    const error = new IVXPError("test", "CODE", details);
    expect(error.details).toEqual(details);
  });

  it("should have undefined details when not provided", () => {
    const error = new IVXPError("test", "CODE");
    expect(error.details).toBeUndefined();
  });

  // Error cause chain tests
  it("should store the cause when provided", () => {
    const original = new Error("root cause");
    const error = new IVXPError("wrapper", "WRAPPED", undefined, original);
    expect(error.cause).toBe(original);
  });

  it("should have undefined cause when not provided", () => {
    const error = new IVXPError("no cause", "CODE");
    expect(error.cause).toBeUndefined();
  });

  it("should support non-Error cause values", () => {
    const error = new IVXPError("wrapper", "CODE", undefined, "string cause");
    expect(error.cause).toBe("string cause");
  });

  it("should support nested error cause chains", () => {
    const root = new Error("root");
    const middle = new IVXPError("middle", "MID", undefined, root);
    const outer = new IVXPError("outer", "OUT", undefined, middle);

    expect(outer.cause).toBe(middle);
    expect((outer.cause as IVXPError).cause).toBe(root);
  });

  // toJSON tests
  it("should serialize to JSON with toJSON()", () => {
    const error = new IVXPError("test message", "TEST_CODE", { foo: "bar" });
    const json = error.toJSON();

    expect(json.name).toBe("IVXPError");
    expect(json.code).toBe("TEST_CODE");
    expect(json.message).toBe("test message");
    expect(json.details).toEqual({ foo: "bar" });
    expect(json.stack).toBeDefined();
    expect(json.cause).toBeUndefined();
  });

  it("should serialize to JSON with undefined details", () => {
    const error = new IVXPError("test message", "TEST_CODE");
    const json = error.toJSON();

    expect(json.name).toBe("IVXPError");
    expect(json.code).toBe("TEST_CODE");
    expect(json.message).toBe("test message");
    expect(json.details).toBeUndefined();
    expect(json.stack).toBeDefined();
  });

  it("should be JSON.stringify compatible via toJSON()", () => {
    const error = new IVXPError("test message", "TEST_CODE", { key: "value" });
    const parsed = JSON.parse(JSON.stringify(error));

    expect(parsed.name).toBe("IVXPError");
    expect(parsed.message).toBe("test message");
    expect(parsed.code).toBe("TEST_CODE");
    expect(parsed.details).toEqual({ key: "value" });
    expect(parsed.stack).toBeDefined();
  });

  // toJSON cause chain serialization (Review Issue #3)
  it("should serialize Error cause in toJSON()", () => {
    const root = new Error("root cause");
    const error = new IVXPError("wrapper", "WRAPPED", undefined, root);
    const json = error.toJSON();

    expect(json.cause).toEqual({ name: "Error", message: "root cause" });
  });

  it("should serialize non-Error cause in toJSON()", () => {
    const error = new IVXPError("wrapper", "WRAPPED", undefined, "string cause");
    const json = error.toJSON();

    expect(json.cause).toBe("string cause");
  });

  it("should serialize IVXPError cause in toJSON()", () => {
    const inner = new IVXPError("inner", "INNER_CODE");
    const outer = new IVXPError("outer", "OUTER_CODE", undefined, inner);
    const json = outer.toJSON();

    expect(json.cause).toEqual({ name: "IVXPError", message: "inner" });
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

  it("should include balance info in details", () => {
    const error = new InsufficientBalanceError("msg", "10.00", "50.00");
    expect(error.details).toEqual({
      availableBalance: "10.00",
      requiredAmount: "50.00",
    });
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

  it("should include txHash in details", () => {
    const error = new TransactionError("reverted", sampleHash);
    expect(error.details).toEqual({ txHash: sampleHash });
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

  it("should include txHash in details", () => {
    const error = new PaymentFailedError("reverted", sampleHash);
    expect(error.details).toEqual({ txHash: sampleHash });
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

  it("should include amounts in details", () => {
    const error = new PaymentAmountMismatchError("mismatch", "10.00", "5.00");
    expect(error.details).toEqual({
      expectedAmount: "10.00",
      actualAmount: "5.00",
    });
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
// OrderExpiredError
// ---------------------------------------------------------------------------

describe("OrderExpiredError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new OrderExpiredError("order expired");
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new OrderExpiredError("order expired");
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the ORDER_EXPIRED error code", () => {
    const error = new OrderExpiredError("expired");
    expect(error.code).toBe("ORDER_EXPIRED");
  });

  it("should have the name OrderExpiredError", () => {
    const error = new OrderExpiredError("expired");
    expect(error.name).toBe("OrderExpiredError");
  });

  it("should have the correct message", () => {
    const error = new OrderExpiredError("Order ord_123 has expired");
    expect(error.message).toBe("Order ord_123 has expired");
  });

  it("should support error cause chain", () => {
    const cause = new Error("TTL exceeded");
    const error = new OrderExpiredError("expired", cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new OrderExpiredError("expired");
    expect(error.cause).toBeUndefined();
  });

  it("should be distinguishable from OrderNotFoundError", () => {
    const expired = new OrderExpiredError("expired");
    const notFound = new OrderNotFoundError("not found");

    expect(expired).not.toBeInstanceOf(OrderNotFoundError);
    expect(notFound).not.toBeInstanceOf(OrderExpiredError);
    expect(expired.code).not.toBe(notFound.code);
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

// ---------------------------------------------------------------------------
// MaxPollAttemptsError
// ---------------------------------------------------------------------------

describe("MaxPollAttemptsError", () => {
  it("should be an instance of IVXPError", () => {
    const error = new MaxPollAttemptsError(10);
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new MaxPollAttemptsError(10);
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the MAX_POLL_ATTEMPTS error code", () => {
    const error = new MaxPollAttemptsError(5);
    expect(error.code).toBe("MAX_POLL_ATTEMPTS");
  });

  it("should have the name MaxPollAttemptsError", () => {
    const error = new MaxPollAttemptsError(5);
    expect(error.name).toBe("MaxPollAttemptsError");
  });

  it("should include attempts count in message", () => {
    const error = new MaxPollAttemptsError(7);
    expect(error.message).toBe("Max polling attempts (7) exceeded");
  });

  it("should expose attempts", () => {
    const error = new MaxPollAttemptsError(12);
    expect(error.attempts).toBe(12);
  });

  it("should include attempts in details", () => {
    const error = new MaxPollAttemptsError(3);
    expect(error.details).toEqual({ attempts: 3 });
  });

  it("should support error cause chain", () => {
    const cause = new Error("timeout");
    const error = new MaxPollAttemptsError(5, cause);
    expect(error.cause).toBe(cause);
  });

  it("should have undefined cause when not provided", () => {
    const error = new MaxPollAttemptsError(5);
    expect(error.cause).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PartialSuccessError (AC #2, #4)
// ---------------------------------------------------------------------------

describe("PartialSuccessError", () => {
  const sampleHash =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;

  it("should be an instance of IVXPError", () => {
    const error = new PartialSuccessError("tx sent but verification failed", sampleHash);
    expect(error).toBeInstanceOf(IVXPError);
  });

  it("should be an instance of Error", () => {
    const error = new PartialSuccessError("tx sent but verification failed", sampleHash);
    expect(error).toBeInstanceOf(Error);
  });

  it("should have the PARTIAL_SUCCESS error code", () => {
    const error = new PartialSuccessError("partial", sampleHash);
    expect(error.code).toBe("PARTIAL_SUCCESS");
  });

  it("should have the name PartialSuccessError", () => {
    const error = new PartialSuccessError("partial", sampleHash);
    expect(error.name).toBe("PartialSuccessError");
  });

  it("should expose txHash for recovery (AC #2)", () => {
    const error = new PartialSuccessError("partial", sampleHash);
    expect(error.txHash).toBe(sampleHash);
  });

  it("should default recoverable to true", () => {
    const error = new PartialSuccessError("partial", sampleHash);
    expect(error.recoverable).toBe(true);
  });

  it("should allow setting recoverable to false", () => {
    const error = new PartialSuccessError("partial", sampleHash, false);
    expect(error.recoverable).toBe(false);
  });

  it("should store the original error", () => {
    const original = new Error("verification timeout");
    const error = new PartialSuccessError("partial", sampleHash, true, original);
    expect(error.originalError).toBe(original);
  });

  it("should have undefined originalError when not provided", () => {
    const error = new PartialSuccessError("partial", sampleHash);
    expect(error.originalError).toBeUndefined();
  });

  it("should include recovery info in details (AC #4)", () => {
    const original = new Error("verification timeout");
    const error = new PartialSuccessError("partial", sampleHash, true, original);

    expect(error.details).toEqual({
      txHash: sampleHash,
      recoverable: true,
      originalError: "verification timeout",
    });
  });

  it("should include undefined originalError in details when not provided", () => {
    const error = new PartialSuccessError("partial", sampleHash);

    expect(error.details).toEqual({
      txHash: sampleHash,
      recoverable: true,
      originalError: undefined,
    });
  });

  it("should serialize to JSON with full recovery info", () => {
    const original = new Error("timeout");
    const error = new PartialSuccessError("tx sent", sampleHash, true, original);
    const json = error.toJSON();

    expect(json.name).toBe("PartialSuccessError");
    expect(json.code).toBe("PARTIAL_SUCCESS");
    expect(json.message).toBe("tx sent");
    expect(json.details).toEqual({
      txHash: sampleHash,
      recoverable: true,
      originalError: "timeout",
    });
  });

  it("should be catchable and distinguishable in try/catch", () => {
    const error = new PartialSuccessError("partial", sampleHash);
    try {
      throw error;
    } catch (e) {
      expect(e).toBeInstanceOf(PartialSuccessError);
      expect(e).toBeInstanceOf(IVXPError);
      if (e instanceof PartialSuccessError) {
        expect(e.txHash).toBe(sampleHash);
        expect(e.recoverable).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: Error Code Uniqueness (AC #3)
// ---------------------------------------------------------------------------

describe("Error code uniqueness", () => {
  it("should have unique error codes for every error class", () => {
    const sampleHash =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

    const errors = [
      new InsufficientBalanceError("msg", "10", "50"),
      new TransactionError("msg", sampleHash),
      new TransactionSubmissionError("msg"),
      new PaymentNotFoundError("msg"),
      new PaymentPendingError("msg"),
      new PaymentFailedError("msg", sampleHash),
      new PaymentAmountMismatchError("msg", "10", "5"),
      new SignatureVerificationError("msg"),
      new PaymentVerificationError("msg"),
      new OrderNotFoundError("msg"),
      new OrderExpiredError("msg"),
      new ServiceUnavailableError("msg"),
      new MaxPollAttemptsError(5),
      new PartialSuccessError("msg", sampleHash),
      new BudgetExceededError("msg", { orderId: "test-order", priceUsdc: 50 }, 10),
      new TimeoutError("msg", "quote"),
      new ProviderError("msg", "http://test.example", "quote"),
    ];

    const codes = errors.map((e) => e.code);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("should have ERROR_CODES constant matching all error codes", () => {
    const sampleHash =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

    const errors = [
      new InsufficientBalanceError("msg", "10", "50"),
      new TransactionError("msg", sampleHash),
      new TransactionSubmissionError("msg"),
      new PaymentNotFoundError("msg"),
      new PaymentPendingError("msg"),
      new PaymentFailedError("msg", sampleHash),
      new PaymentAmountMismatchError("msg", "10", "5"),
      new SignatureVerificationError("msg"),
      new PaymentVerificationError("msg"),
      new OrderNotFoundError("msg"),
      new OrderExpiredError("msg"),
      new ServiceUnavailableError("msg"),
      new MaxPollAttemptsError(5),
      new PartialSuccessError("msg", sampleHash),
      new BudgetExceededError("msg", { orderId: "test-order", priceUsdc: 50 }, 10),
      new TimeoutError("msg", "quote"),
      new ProviderError("msg", "http://test.example", "quote"),
    ];

    const errorCodeValues = Object.values(ERROR_CODES);
    const classCodes = errors.map((e) => e.code);

    // Every class code should exist in ERROR_CODES
    for (const code of classCodes) {
      expect(errorCodeValues).toContain(code);
    }

    // Every ERROR_CODES value should have a corresponding class
    for (const code of errorCodeValues) {
      expect(classCodes).toContain(code);
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: All Errors Extend IVXPError (AC #1)
// ---------------------------------------------------------------------------

describe("All errors extend IVXPError (AC #1)", () => {
  const sampleHash =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`;

  const errorInstances = [
    new InsufficientBalanceError("msg", "10", "50"),
    new TransactionError("msg", sampleHash),
    new TransactionSubmissionError("msg"),
    new PaymentNotFoundError("msg"),
    new PaymentPendingError("msg"),
    new PaymentFailedError("msg", sampleHash),
    new PaymentAmountMismatchError("msg", "10", "5"),
    new SignatureVerificationError("msg"),
    new PaymentVerificationError("msg"),
    new OrderNotFoundError("msg"),
    new OrderExpiredError("msg"),
    new ServiceUnavailableError("msg"),
    new MaxPollAttemptsError(5),
    new PartialSuccessError("msg", sampleHash),
  ];

  for (const error of errorInstances) {
    it(`${error.name} should extend IVXPError`, () => {
      expect(error).toBeInstanceOf(IVXPError);
    });

    it(`${error.name} should extend Error`, () => {
      expect(error).toBeInstanceOf(Error);
    });

    it(`${error.name} should have a string error code`, () => {
      expect(typeof error.code).toBe("string");
      expect(error.code.length).toBeGreaterThan(0);
    });

    it(`${error.name} should have SCREAMING_SNAKE_CASE error code`, () => {
      expect(error.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    });

    it(`${error.name} should support toJSON()`, () => {
      const json = error.toJSON();
      expect(json.name).toBe(error.name);
      expect(json.code).toBe(error.code);
      expect(json.message).toBe(error.message);
    });

    it(`${error.name} should have correct prototype chain`, () => {
      expect(Object.getPrototypeOf(error).constructor).toBe(error.constructor);
      expect(Object.getPrototypeOf(Object.getPrototypeOf(error))).toBe(IVXPError.prototype);
    });
  }
});

// ---------------------------------------------------------------------------
// ERROR_CODES constant value matching (Review Issue #6)
// ---------------------------------------------------------------------------

describe("ERROR_CODES constant values match class codes", () => {
  it("should have key-value identity for every ERROR_CODES entry", () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key);
    }
  });

  it("should have correct count of error codes", () => {
    expect(Object.keys(ERROR_CODES).length).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// MaxPollAttemptsError edge cases (Review Issue #7)
// ---------------------------------------------------------------------------

describe("MaxPollAttemptsError edge cases", () => {
  it("should handle 0 attempts", () => {
    const error = new MaxPollAttemptsError(0);
    expect(error.message).toBe("Max polling attempts (0) exceeded");
    expect(error.attempts).toBe(0);
    expect(error.details).toEqual({ attempts: 0 });
  });

  it("should handle 1 attempt", () => {
    const error = new MaxPollAttemptsError(1);
    expect(error.message).toBe("Max polling attempts (1) exceeded");
    expect(error.attempts).toBe(1);
  });

  it("should handle large attempt count", () => {
    const error = new MaxPollAttemptsError(Number.MAX_SAFE_INTEGER);
    expect(error.attempts).toBe(Number.MAX_SAFE_INTEGER);
    expect(error.details).toEqual({ attempts: Number.MAX_SAFE_INTEGER });
  });
});

// ---------------------------------------------------------------------------
// Transaction hash validation (Review Issue #5)
// ---------------------------------------------------------------------------

describe("Transaction hash validation", () => {
  it("should reject invalid tx hash in TransactionError", () => {
    expect(() => new TransactionError("msg", "0xINVALID" as `0x${string}`)).toThrow(IVXPError);
  });

  it("should reject too-short tx hash in PaymentFailedError", () => {
    expect(() => new PaymentFailedError("msg", "0x123" as `0x${string}`)).toThrow(IVXPError);
  });

  it("should reject invalid tx hash in PartialSuccessError", () => {
    expect(() => new PartialSuccessError("msg", "0x" as `0x${string}`)).toThrow(IVXPError);
  });

  it("should include INVALID_TX_HASH error code on validation failure", () => {
    try {
      new TransactionError("msg", "0xBAD" as `0x${string}`);
    } catch (e) {
      expect(e).toBeInstanceOf(IVXPError);
      expect((e as IVXPError).code).toBe("INVALID_TX_HASH");
    }
  });
});

// ---------------------------------------------------------------------------
// Balance string validation (Review Issue #10)
// ---------------------------------------------------------------------------

describe("Balance string validation", () => {
  it("should reject non-numeric availableBalance", () => {
    expect(() => new InsufficientBalanceError("msg", "invalid", "50")).toThrow(IVXPError);
  });

  it("should reject non-numeric requiredAmount", () => {
    expect(() => new InsufficientBalanceError("msg", "10", "abc")).toThrow(IVXPError);
  });

  it("should accept integer balance strings", () => {
    const error = new InsufficientBalanceError("msg", "10", "50");
    expect(error.availableBalance).toBe("10");
    expect(error.requiredAmount).toBe("50");
  });

  it("should accept decimal balance strings", () => {
    const error = new InsufficientBalanceError("msg", "10.50", "100.00");
    expect(error.availableBalance).toBe("10.50");
    expect(error.requiredAmount).toBe("100.00");
  });

  it("should include INVALID_NUMERIC_STRING error code on validation failure", () => {
    try {
      new InsufficientBalanceError("msg", "not-a-number", "50");
    } catch (e) {
      expect(e).toBeInstanceOf(IVXPError);
      expect((e as IVXPError).code).toBe("INVALID_NUMERIC_STRING");
    }
  });
});
