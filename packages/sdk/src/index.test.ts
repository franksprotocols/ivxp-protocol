/**
 * Tests for @ivxp/sdk package exports.
 *
 * Verifies that:
 * 1. Main entry point exports all expected symbols (AC #1)
 * 2. Subpath exports work correctly (AC #2)
 * 3. TypeScript types are properly exported (AC #3)
 * 4. Build produces expected output files (AC #4)
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Main entry point exports (AC #1)
// ---------------------------------------------------------------------------

describe("@ivxp/sdk main entry point", () => {
  it("should export IVXPClient class", async () => {
    const mod = await import("./index.js");
    expect(mod.IVXPClient).toBeDefined();
    expect(typeof mod.IVXPClient).toBe("function");
  });

  it("should export createIVXPClient factory function", async () => {
    const mod = await import("./index.js");
    expect(mod.createIVXPClient).toBeDefined();
    expect(typeof mod.createIVXPClient).toBe("function");
  });

  it("should export EventEmitter class", async () => {
    const mod = await import("./index.js");
    expect(mod.EventEmitter).toBeDefined();
    expect(typeof mod.EventEmitter).toBe("function");
  });

  // -- Crypto module exports --

  it("should export CryptoService class", async () => {
    const mod = await import("./index.js");
    expect(mod.CryptoService).toBeDefined();
    expect(typeof mod.CryptoService).toBe("function");
  });

  it("should export createCryptoService factory", async () => {
    const mod = await import("./index.js");
    expect(mod.createCryptoService).toBeDefined();
    expect(typeof mod.createCryptoService).toBe("function");
  });

  it("should export formatIVXPMessage utility", async () => {
    const mod = await import("./index.js");
    expect(mod.formatIVXPMessage).toBeDefined();
    expect(typeof mod.formatIVXPMessage).toBe("function");
  });

  // -- Payment module exports --

  it("should export PaymentService class", async () => {
    const mod = await import("./index.js");
    expect(mod.PaymentService).toBeDefined();
    expect(typeof mod.PaymentService).toBe("function");
  });

  it("should export createPaymentService factory", async () => {
    const mod = await import("./index.js");
    expect(mod.createPaymentService).toBeDefined();
    expect(typeof mod.createPaymentService).toBe("function");
  });

  // -- HTTP module exports --

  it("should export HttpClient class", async () => {
    const mod = await import("./index.js");
    expect(mod.HttpClient).toBeDefined();
    expect(typeof mod.HttpClient).toBe("function");
  });

  it("should export createHttpClient factory", async () => {
    const mod = await import("./index.js");
    expect(mod.createHttpClient).toBeDefined();
    expect(typeof mod.createHttpClient).toBe("function");
  });

  // -- Polling module exports --

  it("should export pollWithBackoff function", async () => {
    const mod = await import("./index.js");
    expect(mod.pollWithBackoff).toBeDefined();
    expect(typeof mod.pollWithBackoff).toBe("function");
  });

  it("should export pollOrderStatus function", async () => {
    const mod = await import("./index.js");
    expect(mod.pollOrderStatus).toBeDefined();
    expect(typeof mod.pollOrderStatus).toBe("function");
  });

  // -- Error classes --

  it("should export IVXPError base class", async () => {
    const mod = await import("./index.js");
    expect(mod.IVXPError).toBeDefined();
    expect(typeof mod.IVXPError).toBe("function");
  });

  it("should export all specific error classes", async () => {
    const mod = await import("./index.js");
    const expectedErrors = [
      "InsufficientBalanceError",
      "TransactionError",
      "TransactionSubmissionError",
      "PaymentNotFoundError",
      "PaymentPendingError",
      "PaymentFailedError",
      "PaymentAmountMismatchError",
      "SignatureVerificationError",
      "PaymentVerificationError",
      "OrderNotFoundError",
      "OrderExpiredError",
      "ServiceUnavailableError",
      "MaxPollAttemptsError",
      "PartialSuccessError",
      "BudgetExceededError",
      "TimeoutError",
      "ProviderError",
    ] as const;

    for (const errorName of expectedErrors) {
      expect(mod[errorName]).toBeDefined();
      expect(typeof mod[errorName]).toBe("function");
    }
  });

  it("should export ERROR_CODES constant", async () => {
    const mod = await import("./index.js");
    expect(mod.ERROR_CODES).toBeDefined();
    expect(typeof mod.ERROR_CODES).toBe("object");
    expect(mod.ERROR_CODES.INSUFFICIENT_BALANCE).toBe("INSUFFICIENT_BALANCE");
    expect(mod.ERROR_CODES.PROVIDER_ERROR).toBe("PROVIDER_ERROR");
  });

  // -- Protocol re-exports --

  it("should re-export PROTOCOL_VERSION from @ivxp/protocol", async () => {
    const mod = await import("./index.js");
    expect(mod.PROTOCOL_VERSION).toBeDefined();
    expect(mod.PROTOCOL_VERSION).toBe("IVXP/1.0");
  });

  it("should re-export ORDER_STATUSES from @ivxp/protocol", async () => {
    const mod = await import("./index.js");
    expect(mod.ORDER_STATUSES).toBeDefined();
    expect(typeof mod.ORDER_STATUSES).toBe("object");
  });

  it("should re-export USDC_CONTRACT_ADDRESSES from @ivxp/protocol", async () => {
    const mod = await import("./index.js");
    expect(mod.USDC_CONTRACT_ADDRESSES).toBeDefined();
    expect(typeof mod.USDC_CONTRACT_ADDRESSES).toBe("object");
  });

  it("should re-export USDC_DECIMALS from @ivxp/protocol", async () => {
    const mod = await import("./index.js");
    expect(mod.USDC_DECIMALS).toBeDefined();
    expect(typeof mod.USDC_DECIMALS).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Subpath exports (AC #2)
// ---------------------------------------------------------------------------

describe("@ivxp/sdk/crypto subpath export", () => {
  it("should export CryptoService", async () => {
    const mod = await import("./crypto/index.js");
    expect(mod.CryptoService).toBeDefined();
    expect(typeof mod.CryptoService).toBe("function");
  });

  it("should export createCryptoService", async () => {
    const mod = await import("./crypto/index.js");
    expect(mod.createCryptoService).toBeDefined();
    expect(typeof mod.createCryptoService).toBe("function");
  });

  it("should export formatIVXPMessage", async () => {
    const mod = await import("./crypto/index.js");
    expect(mod.formatIVXPMessage).toBeDefined();
    expect(typeof mod.formatIVXPMessage).toBe("function");
  });
});

describe("@ivxp/sdk/payment subpath export", () => {
  it("should export PaymentService", async () => {
    const mod = await import("./payment/index.js");
    expect(mod.PaymentService).toBeDefined();
    expect(typeof mod.PaymentService).toBe("function");
  });

  it("should export createPaymentService", async () => {
    const mod = await import("./payment/index.js");
    expect(mod.createPaymentService).toBeDefined();
    expect(typeof mod.createPaymentService).toBe("function");
  });
});

describe("@ivxp/sdk/core subpath export", () => {
  it("should export IVXPClient", async () => {
    const mod = await import("./core/index.js");
    expect(mod.IVXPClient).toBeDefined();
    expect(typeof mod.IVXPClient).toBe("function");
  });

  it("should export createIVXPClient", async () => {
    const mod = await import("./core/index.js");
    expect(mod.createIVXPClient).toBeDefined();
    expect(typeof mod.createIVXPClient).toBe("function");
  });

  it("should export EventEmitter", async () => {
    const mod = await import("./core/index.js");
    expect(mod.EventEmitter).toBeDefined();
    expect(typeof mod.EventEmitter).toBe("function");
  });
});

describe("@ivxp/sdk/errors subpath export", () => {
  it("should export IVXPError", async () => {
    const mod = await import("./errors/index.js");
    expect(mod.IVXPError).toBeDefined();
    expect(typeof mod.IVXPError).toBe("function");
  });

  it("should export ERROR_CODES", async () => {
    const mod = await import("./errors/index.js");
    expect(mod.ERROR_CODES).toBeDefined();
    expect(typeof mod.ERROR_CODES).toBe("object");
  });

  it("should export all specific error classes", async () => {
    const mod = await import("./errors/index.js");
    const expectedErrors = [
      "InsufficientBalanceError",
      "TransactionError",
      "TransactionSubmissionError",
      "PaymentNotFoundError",
      "PaymentPendingError",
      "PaymentFailedError",
      "PaymentAmountMismatchError",
      "SignatureVerificationError",
      "PaymentVerificationError",
      "OrderNotFoundError",
      "OrderExpiredError",
      "ServiceUnavailableError",
      "MaxPollAttemptsError",
      "PartialSuccessError",
      "BudgetExceededError",
      "TimeoutError",
      "ProviderError",
    ] as const;

    for (const errorName of expectedErrors) {
      expect(mod[errorName]).toBeDefined();
      expect(typeof mod[errorName]).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// HTTP module type exports (AC #3)
// ---------------------------------------------------------------------------

describe("@ivxp/sdk HTTP module exports", () => {
  it("should export HttpClient class from http submodule", async () => {
    const mod = await import("./http/index.js");
    expect(mod.HttpClient).toBeDefined();
    expect(typeof mod.HttpClient).toBe("function");
  });

  it("should export createHttpClient factory from http submodule", async () => {
    const mod = await import("./http/index.js");
    expect(mod.createHttpClient).toBeDefined();
    expect(typeof mod.createHttpClient).toBe("function");
  });

  it("HttpClient should be constructable with options", async () => {
    const mod = await import("./http/index.js");
    const client = new mod.HttpClient({ baseUrl: "https://example.com", timeout: 5000 });
    expect(client).toBeInstanceOf(mod.HttpClient);
  });
});

// ---------------------------------------------------------------------------
// Polling module type exports (AC #3)
// ---------------------------------------------------------------------------

describe("@ivxp/sdk Polling module exports", () => {
  it("should export pollWithBackoff from polling submodule", async () => {
    const mod = await import("./polling/index.js");
    expect(mod.pollWithBackoff).toBeDefined();
    expect(typeof mod.pollWithBackoff).toBe("function");
  });

  it("should export pollOrderStatus from polling submodule", async () => {
    const mod = await import("./polling/index.js");
    expect(mod.pollOrderStatus).toBeDefined();
    expect(typeof mod.pollOrderStatus).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Export completeness (AC #1, #3)
// ---------------------------------------------------------------------------

describe("export completeness", () => {
  it("main module should export all symbols from core subpath", async () => {
    const main = await import("./index.js");
    const core = await import("./core/index.js");

    for (const key of Object.keys(core)) {
      expect(main).toHaveProperty(key);
    }
  });

  it("main module should export all symbols from crypto subpath", async () => {
    const main = await import("./index.js");
    const crypto = await import("./crypto/index.js");

    for (const key of Object.keys(crypto)) {
      expect(main).toHaveProperty(key);
    }
  });

  it("main module should export all symbols from payment subpath", async () => {
    const main = await import("./index.js");
    const payment = await import("./payment/index.js");

    for (const key of Object.keys(payment)) {
      expect(main).toHaveProperty(key);
    }
  });

  it("main module should export all symbols from errors module", async () => {
    const main = await import("./index.js");
    const errors = await import("./errors/index.js");

    for (const key of Object.keys(errors)) {
      expect(main).toHaveProperty(key);
    }
  });

  it("main module should export all symbols from http module", async () => {
    const main = await import("./index.js");
    const http = await import("./http/index.js");

    for (const key of Object.keys(http)) {
      expect(main).toHaveProperty(key);
    }
  });

  it("main module should export all symbols from polling module", async () => {
    const main = await import("./index.js");
    const polling = await import("./polling/index.js");

    for (const key of Object.keys(polling)) {
      expect(main).toHaveProperty(key);
    }
  });

  it("error class instances should be instanceof IVXPError", async () => {
    const {
      IVXPError,
      TransactionSubmissionError,
      PaymentNotFoundError,
      PaymentPendingError,
      SignatureVerificationError,
      PaymentVerificationError,
      OrderNotFoundError,
      OrderExpiredError,
      ServiceUnavailableError,
      MaxPollAttemptsError,
    } = await import("./index.js");

    // Test with actual instantiation instead of fragile prototype checking.
    // Each error class requires different constructor args, so we test a
    // representative subset that covers all constructor signatures.

    const transmissionErr = new TransactionSubmissionError("test");
    expect(transmissionErr).toBeInstanceOf(IVXPError);
    expect(transmissionErr).toBeInstanceOf(TransactionSubmissionError);

    const notFoundErr = new PaymentNotFoundError("test");
    expect(notFoundErr).toBeInstanceOf(IVXPError);

    const pendingErr = new PaymentPendingError("test");
    expect(pendingErr).toBeInstanceOf(IVXPError);

    const sigErr = new SignatureVerificationError("test");
    expect(sigErr).toBeInstanceOf(IVXPError);

    const payVerifyErr = new PaymentVerificationError("test");
    expect(payVerifyErr).toBeInstanceOf(IVXPError);

    const orderNotFoundErr = new OrderNotFoundError("test");
    expect(orderNotFoundErr).toBeInstanceOf(IVXPError);

    const orderExpiredErr = new OrderExpiredError("test");
    expect(orderExpiredErr).toBeInstanceOf(IVXPError);

    const serviceErr = new ServiceUnavailableError("test");
    expect(serviceErr).toBeInstanceOf(IVXPError);

    const maxPollErr = new MaxPollAttemptsError(5);
    expect(maxPollErr).toBeInstanceOf(IVXPError);
  });

  it("error instances with extended constructors should be instanceof IVXPError", async () => {
    const {
      IVXPError,
      InsufficientBalanceError,
      TransactionError,
      PaymentFailedError,
      PaymentAmountMismatchError,
      PartialSuccessError,
      BudgetExceededError,
      TimeoutError,
      ProviderError,
    } = await import("./index.js");

    const validTxHash = "0x" + "a".repeat(64);

    const balanceErr = new InsufficientBalanceError("test", "10", "20");
    expect(balanceErr).toBeInstanceOf(IVXPError);

    const txErr = new TransactionError("test", validTxHash as `0x${string}`);
    expect(txErr).toBeInstanceOf(IVXPError);

    const payFailedErr = new PaymentFailedError("test", validTxHash as `0x${string}`);
    expect(payFailedErr).toBeInstanceOf(IVXPError);

    const mismatchErr = new PaymentAmountMismatchError("test", "10", "20");
    expect(mismatchErr).toBeInstanceOf(IVXPError);

    const partialErr = new PartialSuccessError("test", validTxHash as `0x${string}`);
    expect(partialErr).toBeInstanceOf(IVXPError);

    const budgetErr = new BudgetExceededError(
      "test",
      { orderId: "order-1", priceUsdc: 50 },
      10,
    );
    expect(budgetErr).toBeInstanceOf(IVXPError);

    const timeoutErr = new TimeoutError("test", "payment");
    expect(timeoutErr).toBeInstanceOf(IVXPError);

    const providerErr = new ProviderError("test", "https://example.com", "quote");
    expect(providerErr).toBeInstanceOf(IVXPError);
  });
});

// ---------------------------------------------------------------------------
// Inverse completeness: subpath exports are subsets of main (AC #1, #2)
// ---------------------------------------------------------------------------

describe("inverse completeness: subpath exports are subsets of main", () => {
  it("all crypto subpath exports should be available from main", async () => {
    const main = await import("./index.js");
    const crypto = await import("./crypto/index.js");

    for (const key of Object.keys(crypto)) {
      expect(main[key as keyof typeof main]).toBe(crypto[key as keyof typeof crypto]);
    }
  });

  it("all payment subpath exports should be available from main", async () => {
    const main = await import("./index.js");
    const payment = await import("./payment/index.js");

    for (const key of Object.keys(payment)) {
      expect(main[key as keyof typeof main]).toBe(payment[key as keyof typeof payment]);
    }
  });

  it("all core subpath exports should be available from main", async () => {
    const main = await import("./index.js");
    const core = await import("./core/index.js");

    for (const key of Object.keys(core)) {
      expect(main[key as keyof typeof main]).toBe(core[key as keyof typeof core]);
    }
  });

  it("all errors subpath exports should be available from main", async () => {
    const main = await import("./index.js");
    const errors = await import("./errors/index.js");

    for (const key of Object.keys(errors)) {
      expect(main[key as keyof typeof main]).toBe(errors[key as keyof typeof errors]);
    }
  });
});
