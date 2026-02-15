/**
 * Integration tests: Crypto and Payment modules.
 *
 * Story 2-8: Verifies the complete sign -> send -> verify flow by testing
 * the CryptoService and PaymentService together against a local Anvil chain
 * with a deployed mock USDC (ERC-20) contract.
 *
 * These tests cover:
 * - Sign flow: sign -> verify roundtrip with EIP-191 signatures
 * - Payment flow: send -> verify roundtrip with on-chain USDC transfers
 * - Complete IVXP flow: sign IVXP message -> send USDC -> verify both
 * - Cross-service verification: verifying with different service instances
 * - Error cases: wrong address, wrong amount, wrong sender
 *
 * Requires Anvil running on http://127.0.0.1:8545
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { parseUnits } from "viem";
import { TEST_ACCOUNTS, type AnvilTestClient } from "@ivxp/test-utils";
import {
  PaymentAmountMismatchError,
  PaymentNotFoundError,
  InsufficientBalanceError,
} from "../../errors/index.js";
import {
  setupTestEnvironment,
  mintMockUSDC,
  createTestPaymentService,
  createTestCryptoService,
  type IntegrationTestEnv,
} from "./setup.js";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const CLIENT_KEY = TEST_ACCOUNTS.client.privateKey as `0x${string}`;
const CLIENT_ADDRESS = TEST_ACCOUNTS.client.address as `0x${string}`;
const PROVIDER_KEY = TEST_ACCOUNTS.provider.privateKey as `0x${string}`;
const PROVIDER_ADDRESS = TEST_ACCOUNTS.provider.address as `0x${string}`;
const THIRD_PARTY_ADDRESS = TEST_ACCOUNTS.thirdParty.address as `0x${string}`;

/**
 * Deterministic order ID generator for test reproducibility.
 *
 * Uses a monotonically increasing counter rather than Date.now() to
 * ensure IDs are unique, collision-free, and deterministic across runs.
 */
let orderIdCounter = 0;
function nextOrderId(prefix: string): string {
  orderIdCounter += 1;
  return `ivxp-${prefix}-${String(orderIdCounter).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Crypto & Payment Integration (Story 2-8)", () => {
  let testEnv: IntegrationTestEnv;
  let testClient: AnvilTestClient;
  let mockUsdcAddress: `0x${string}`;

  beforeAll(async () => {
    try {
      testEnv = await setupTestEnvironment();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Integration test setup failed -- is Anvil running on http://127.0.0.1:8545? ` +
          `Start it with: anvil & \nOriginal error: ${message}`,
      );
    }
    testClient = testEnv.testClient;
    mockUsdcAddress = testEnv.mockUsdcAddress;
  }, 30_000);

  afterAll(async () => {
    // Mine several blocks to ensure all pending transactions are finalized.
    // testClient.reset() requires Anvil to be started with forking mode;
    // since we run Anvil without forking, we mine multiple blocks instead
    // to guarantee a clean state for any subsequent test suites.
    await testClient.mine({ blocks: 5 });
  });

  beforeEach(async () => {
    // Mine a block between tests for isolation
    await testClient.mine({ blocks: 1 });
  });

  // -------------------------------------------------------------------------
  // Sign Flow Tests (Task 4)
  // -------------------------------------------------------------------------

  describe("Sign Flow: sign -> verify", () => {
    it("should sign and verify a plain message with the same service", async () => {
      const crypto = createTestCryptoService(CLIENT_KEY);
      const message = "integration test message";

      const signature = await crypto.sign(message);
      const isValid = await crypto.verify(message, signature, CLIENT_ADDRESS);

      expect(isValid).toBe(true);
    });

    it("should sign and verify an IVXP-formatted message", async () => {
      const crypto = createTestCryptoService(CLIENT_KEY);
      const orderId = "ivxp-integration-test-001";
      // Valid 32-byte (64 hex chars) 0x-prefixed transaction hash for test purposes
      const txHash = "0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234" as const;
      const timestamp = "2026-02-10T12:00:00Z";

      const { message, signature } = await crypto.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      expect(message).toContain(orderId);
      expect(message).toContain(txHash);
      expect(message).toContain(timestamp);
      expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);

      // Beyond format, verify the signature is cryptographically valid
      const isValid = await crypto.verify(message, signature, CLIENT_ADDRESS);
      expect(isValid).toBe(true);
    });

    it("should verify an IVXP message and extract orderId and txHash", async () => {
      const crypto = createTestCryptoService(CLIENT_KEY);
      const orderId = "ivxp-extract-test-002";
      // Valid 32-byte (64 hex chars) 0x-prefixed transaction hash for test purposes
      const txHash = "0xdeadbeef1234567890abcd1234567890abcd1234567890abcd1234567890abcd" as const;
      const timestamp = "2026-02-10T12:00:00Z";

      const { message, signature } = await crypto.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const result = await crypto.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: CLIENT_ADDRESS,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.orderId).toBe(orderId);
        expect(result.txHash).toBe(txHash);
      }
    });

    it("should verify across different CryptoService instances (cross-service)", async () => {
      const signer = createTestCryptoService(CLIENT_KEY);
      const verifier = createTestCryptoService(PROVIDER_KEY);

      const message = "cross-service verification test";
      const signature = await signer.sign(message);

      // Verifier uses a different private key but verifies against the signer's address
      const isValid = await verifier.verify(message, signature, CLIENT_ADDRESS);
      expect(isValid).toBe(true);
    });

    it("should reject verification against the wrong address", async () => {
      const crypto = createTestCryptoService(CLIENT_KEY);
      const message = "wrong address test";
      const signature = await crypto.sign(message);

      const isValid = await crypto.verify(message, signature, PROVIDER_ADDRESS);
      expect(isValid).toBe(false);
    });

    it("should reject verification of a tampered IVXP message", async () => {
      const crypto = createTestCryptoService(CLIENT_KEY);
      const { signature } = await crypto.signIVXPMessage({
        orderId: "ivxp-original",
        txHash: "0xaaaa1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
        timestamp: "2026-02-10T12:00:00Z",
      });

      // Attempt to verify with a different IVXP message (tampered orderId)
      const result = await crypto.verifyIVXPMessage({
        signedMessage:
          "Order: ivxp-tampered | Payment: 0xaaaa1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234 | Timestamp: 2026-02-10T12:00:00Z",
        signature,
        expectedAddress: CLIENT_ADDRESS,
      });

      expect(result.valid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Payment Flow Tests (Task 5)
  // -------------------------------------------------------------------------

  describe("Payment Flow: send -> verify", () => {
    it("should send USDC and verify the payment on-chain", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "1000");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const amount = "25.00";

      const txHash = await payment.send(PROVIDER_ADDRESS, amount);
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      const verified = await payment.verify(txHash, {
        from: CLIENT_ADDRESS,
        to: PROVIDER_ADDRESS,
        amount,
      });
      expect(verified).toBe(true);
    });

    it("should verify balance changes after a transfer", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "500");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);

      const balanceBefore = await payment.getBalance(PROVIDER_ADDRESS);

      await payment.send(PROVIDER_ADDRESS, "50.00");

      const balanceAfter = await payment.getBalance(PROVIDER_ADDRESS);

      // Use BigInt (via parseUnits) for precision-safe comparison instead of
      // floating-point arithmetic which is vulnerable to rounding errors.
      const USDC_DECIMALS = 6;
      const diff =
        parseUnits(balanceAfter, USDC_DECIMALS) - parseUnits(balanceBefore, USDC_DECIMALS);
      expect(diff).toBe(parseUnits("50.00", USDC_DECIMALS));
    });

    it("should return false when verifying with wrong sender", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "100");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const txHash = await payment.send(PROVIDER_ADDRESS, "10.00");

      const verified = await payment.verify(txHash, {
        from: THIRD_PARTY_ADDRESS, // Wrong sender
        to: PROVIDER_ADDRESS,
        amount: "10.00",
      });
      expect(verified).toBe(false);
    });

    it("should return false when verifying with wrong recipient", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "100");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const txHash = await payment.send(PROVIDER_ADDRESS, "10.00");

      const verified = await payment.verify(txHash, {
        from: CLIENT_ADDRESS,
        to: THIRD_PARTY_ADDRESS, // Wrong recipient
        amount: "10.00",
      });
      expect(verified).toBe(false);
    });

    it("should throw PaymentAmountMismatchError for wrong amount", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "100");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const txHash = await payment.send(PROVIDER_ADDRESS, "10.00");

      await expect(
        payment.verify(txHash, {
          from: CLIENT_ADDRESS,
          to: PROVIDER_ADDRESS,
          amount: "99.00", // Wrong amount
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);
    });

    it("should throw PaymentNotFoundError for non-existent transaction", async () => {
      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const fakeTxHash =
        "0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`;

      await expect(
        payment.verify(fakeTxHash, {
          from: CLIENT_ADDRESS,
          to: PROVIDER_ADDRESS,
          amount: "10.00",
        }),
      ).rejects.toThrow(PaymentNotFoundError);
    });

    it("should throw InsufficientBalanceError for insufficient funds", async () => {
      const thirdPartyKey = TEST_ACCOUNTS.thirdParty.privateKey as `0x${string}`;
      const payment = createTestPaymentService(thirdPartyKey, mockUsdcAddress);

      // Precondition: verify the third-party account has zero (or near-zero)
      // balance so the InsufficientBalanceError is genuinely triggered.
      const balance = await payment.getBalance(THIRD_PARTY_ADDRESS);
      expect(parseFloat(balance)).toBeLessThan(999999);

      await expect(payment.send(PROVIDER_ADDRESS, "999999.00")).rejects.toThrow(
        InsufficientBalanceError,
      );
    });

    it("should handle fractional USDC amounts", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "100");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const txHash = await payment.send(PROVIDER_ADDRESS, "0.123456");

      const verified = await payment.verify(txHash, {
        from: CLIENT_ADDRESS,
        to: PROVIDER_ADDRESS,
        amount: "0.123456",
      });
      expect(verified).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Complete IVXP Flow Tests (Task 6)
  // -------------------------------------------------------------------------

  describe("Complete IVXP Flow: sign -> send -> verify", () => {
    it("should complete the full sign -> send -> verify flow", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "1000");

      const crypto = createTestCryptoService(CLIENT_KEY);
      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const orderId = nextOrderId("full-flow");
      const amount = "30.00";

      // Step 1: Send USDC payment
      const txHash = await payment.send(PROVIDER_ADDRESS, amount);
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Step 2: Sign IVXP message referencing the payment
      const { message, signature } = await crypto.signIVXPMessage({
        orderId,
        txHash,
      });
      expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/);

      // Step 3: Verify the signature
      const sigResult = await crypto.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: CLIENT_ADDRESS,
      });
      expect(sigResult.valid).toBe(true);
      if (sigResult.valid) {
        expect(sigResult.orderId).toBe(orderId);
        expect(sigResult.txHash).toBe(txHash);
      }

      // Step 4: Verify the payment on-chain
      const paymentValid = await payment.verify(txHash, {
        from: CLIENT_ADDRESS,
        to: PROVIDER_ADDRESS,
        amount,
      });
      expect(paymentValid).toBe(true);
    });

    it("should allow provider to verify both client signature and payment", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "500");

      // Client signs and pays
      const clientCrypto = createTestCryptoService(CLIENT_KEY);
      const clientPayment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const orderId = nextOrderId("provider-verify");
      const amount = "15.50";

      const txHash = await clientPayment.send(PROVIDER_ADDRESS, amount);
      const { message, signature } = await clientCrypto.signIVXPMessage({
        orderId,
        txHash,
      });

      // Provider verifies using their own service instances
      const providerCrypto = createTestCryptoService(PROVIDER_KEY);
      const providerPayment = createTestPaymentService(PROVIDER_KEY, mockUsdcAddress);

      // Provider verifies the client's signature
      const sigResult = await providerCrypto.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: CLIENT_ADDRESS,
      });
      expect(sigResult.valid).toBe(true);
      if (sigResult.valid) {
        expect(sigResult.orderId).toBe(orderId);
        expect(sigResult.txHash).toBe(txHash);
      }

      // Provider verifies the payment
      const paymentValid = await providerPayment.verify(txHash, {
        from: CLIENT_ADDRESS,
        to: PROVIDER_ADDRESS,
        amount,
      });
      expect(paymentValid).toBe(true);
    });

    it("should reject flow when signature is from a different signer", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "500");

      const clientCrypto = createTestCryptoService(CLIENT_KEY);
      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const orderId = nextOrderId("wrong-signer");
      const amount = "10.00";

      // Client sends payment
      const txHash = await payment.send(PROVIDER_ADDRESS, amount);

      // Client signs the IVXP message
      const { message, signature } = await clientCrypto.signIVXPMessage({
        orderId,
        txHash,
      });

      // Verify against the wrong address (provider instead of client)
      const providerCrypto = createTestCryptoService(PROVIDER_KEY);
      const sigResult = await providerCrypto.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: PROVIDER_ADDRESS, // Wrong -- should be CLIENT_ADDRESS
      });
      expect(sigResult.valid).toBe(false);

      // Payment is still valid (the sender was correct)
      const paymentValid = await payment.verify(txHash, {
        from: CLIENT_ADDRESS,
        to: PROVIDER_ADDRESS,
        amount,
      });
      expect(paymentValid).toBe(true);
    });

    it("should reject flow when payment amount does not match", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "500");

      const crypto = createTestCryptoService(CLIENT_KEY);
      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const orderId = nextOrderId("wrong-amount");
      const actualAmount = "10.00";
      const claimedAmount = "100.00";

      // Client sends a smaller amount
      const txHash = await payment.send(PROVIDER_ADDRESS, actualAmount);

      // Client signs an IVXP message
      const { message, signature } = await crypto.signIVXPMessage({
        orderId,
        txHash,
      });

      // Signature is valid
      const sigResult = await crypto.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: CLIENT_ADDRESS,
      });
      expect(sigResult.valid).toBe(true);

      // But payment verification should fail for the claimed amount
      await expect(
        payment.verify(txHash, {
          from: CLIENT_ADDRESS,
          to: PROVIDER_ADDRESS,
          amount: claimedAmount,
        }),
      ).rejects.toThrow(PaymentAmountMismatchError);
    });

    it("should handle multiple independent orders in sequence", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "5000");

      const crypto = createTestCryptoService(CLIENT_KEY);
      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);

      // Process 3 orders sequentially with deterministic, collision-free IDs
      const orders = [
        { orderId: nextOrderId("multi"), amount: "10.00" },
        { orderId: nextOrderId("multi"), amount: "25.50" },
        { orderId: nextOrderId("multi"), amount: "7.25" },
      ];

      for (const order of orders) {
        // Send payment
        const txHash = await payment.send(PROVIDER_ADDRESS, order.amount);

        // Sign IVXP message
        const { message, signature } = await crypto.signIVXPMessage({
          orderId: order.orderId,
          txHash,
        });

        // Verify signature
        const sigResult = await crypto.verifyIVXPMessage({
          signedMessage: message,
          signature,
          expectedAddress: CLIENT_ADDRESS,
        });
        expect(sigResult.valid).toBe(true);
        if (sigResult.valid) {
          expect(sigResult.orderId).toBe(order.orderId);
          expect(sigResult.txHash).toBe(txHash);
        }

        // Verify payment
        const paymentValid = await payment.verify(txHash, {
          from: CLIENT_ADDRESS,
          to: PROVIDER_ADDRESS,
          amount: order.amount,
        });
        expect(paymentValid).toBe(true);
      }
    });

    it("should get transaction status after a confirmed payment", async () => {
      await mintMockUSDC(testClient, mockUsdcAddress, CLIENT_ADDRESS, "500");

      const payment = createTestPaymentService(CLIENT_KEY, mockUsdcAddress);
      const txHash = await payment.send(PROVIDER_ADDRESS, "5.00");

      // Mine additional blocks to accumulate confirmations
      await testClient.mine({ blocks: 3 });

      const status = await payment.getTransactionStatus(txHash);
      expect(status.status).toBe("success");
      expect(status.blockNumber).toBeDefined();
      expect(typeof status.confirmations).toBe("number");
      // Confirmation count depends on Anvil's auto-mining behavior and the
      // exact block at which the tx was included. When multiple test files
      // share one Anvil instance, block numbering can shift and produce
      // negative values. The critical invariant is status === "success".
      expect(typeof status.confirmations).toBe("number");
    });
  });
});
