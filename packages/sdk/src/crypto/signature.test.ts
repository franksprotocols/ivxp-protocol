/**
 * CryptoService unit tests.
 *
 * Tests EIP-191 signature service against known test vectors
 * using Anvil default accounts from @ivxp/test-utils.
 */

import { describe, expect, it } from "vitest";
import { verifyMessage } from "viem";
import { TEST_ACCOUNTS } from "@ivxp/test-utils";
import type { ICryptoService } from "@ivxp/protocol";
import {
  CryptoService,
  createCryptoService,
  formatIVXPMessage,
  type IVXPVerificationResult,
} from "./signature.js";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CLIENT_ACCOUNT = TEST_ACCOUNTS.client;
const PROVIDER_ACCOUNT = TEST_ACCOUNTS.provider;

const TEST_MESSAGE = "hello world";

// ---------------------------------------------------------------------------
// CryptoService constructor
// ---------------------------------------------------------------------------

describe("CryptoService", () => {
  describe("constructor", () => {
    it("should create an instance with a valid private key", () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      expect(service).toBeInstanceOf(CryptoService);
    });

    it("should throw for an invalid hex private key", () => {
      expect(() => new CryptoService("0xinvalid" as `0x${string}`)).toThrow("Invalid private key");
    });

    it("should throw for an empty string", () => {
      expect(() => new CryptoService("" as `0x${string}`)).toThrow("Invalid private key");
    });

    it("should throw for a key that is too short", () => {
      expect(() => new CryptoService("0xabc" as `0x${string}`)).toThrow("Invalid private key");
    });

    it("should throw for a key that is too long", () => {
      const tooLong = `0x${"a".repeat(66)}` as `0x${string}`;
      expect(() => new CryptoService(tooLong)).toThrow("Invalid private key");
    });

    it("should throw for a key without 0x prefix", () => {
      const noPrefix = CLIENT_ACCOUNT.privateKey.slice(2) as `0x${string}`;
      expect(() => new CryptoService(noPrefix)).toThrow("Invalid private key");
    });

    it("should throw for null/undefined passed as private key", () => {
      expect(() => new CryptoService(null as unknown as `0x${string}`)).toThrow(
        "Invalid private key",
      );
      expect(() => new CryptoService(undefined as unknown as `0x${string}`)).toThrow(
        "Invalid private key",
      );
    });
  });

  // -------------------------------------------------------------------------
  // getAddress
  // -------------------------------------------------------------------------

  describe("getAddress", () => {
    it("should return the correct checksummed address for client account", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const address = await service.getAddress();
      expect(address).toBe(CLIENT_ACCOUNT.address);
    });

    it("should return the correct checksummed address for provider account", async () => {
      const service = new CryptoService(PROVIDER_ACCOUNT.privateKey as `0x${string}`);
      const address = await service.getAddress();
      expect(address).toBe(PROVIDER_ACCOUNT.address);
    });

    it("should return a 0x-prefixed hex string", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const address = await service.getAddress();
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  // -------------------------------------------------------------------------
  // sign
  // -------------------------------------------------------------------------

  describe("sign", () => {
    it("should produce a valid EIP-191 signature", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);

      // Verify the signature using viem's verifyMessage
      const isValid = await verifyMessage({
        address: CLIENT_ACCOUNT.address as `0x${string}`,
        message: TEST_MESSAGE,
        signature,
      });
      expect(isValid).toBe(true);
    });

    it("should return a 0x-prefixed hex string", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("should produce a 65-byte signature (130 hex chars + 0x prefix)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      // EIP-191 signatures are 65 bytes = 130 hex chars + "0x" prefix = 132 chars total
      expect(signature.length).toBe(132);
    });

    it("should produce different signatures for different messages", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const sig1 = await service.sign("message one");
      const sig2 = await service.sign("message two");
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different private keys", async () => {
      const service1 = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const service2 = new CryptoService(PROVIDER_ACCOUNT.privateKey as `0x${string}`);
      const sig1 = await service1.sign(TEST_MESSAGE);
      const sig2 = await service2.sign(TEST_MESSAGE);
      expect(sig1).not.toBe(sig2);
    });

    it("should produce deterministic signatures for the same message and key", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const sig1 = await service.sign(TEST_MESSAGE);
      const sig2 = await service.sign(TEST_MESSAGE);
      expect(sig1).toBe(sig2);
    });

    it("should handle empty message string", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign("");
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);

      const isValid = await verifyMessage({
        address: CLIENT_ACCOUNT.address as `0x${string}`,
        message: "",
        signature,
      });
      expect(isValid).toBe(true);
    });

    it("should handle long messages", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const longMessage = "a".repeat(10000);
      const signature = await service.sign(longMessage);

      const isValid = await verifyMessage({
        address: CLIENT_ACCOUNT.address as `0x${string}`,
        message: longMessage,
        signature,
      });
      expect(isValid).toBe(true);
    });

    it("should handle unicode messages", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const unicodeMessage = "Hello World";
      const signature = await service.sign(unicodeMessage);

      const isValid = await verifyMessage({
        address: CLIENT_ACCOUNT.address as `0x${string}`,
        message: unicodeMessage,
        signature,
      });
      expect(isValid).toBe(true);
    });

    it("should throw for non-string message", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      await expect(service.sign(123 as unknown as string)).rejects.toThrow(
        "Invalid message: must be a string",
      );
    });

    it("should throw for null message", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      await expect(service.sign(null as unknown as string)).rejects.toThrow(
        "Invalid message: must be a string",
      );
    });
  });

  // -------------------------------------------------------------------------
  // verify
  // -------------------------------------------------------------------------

  describe("verify", () => {
    it("should return true for a valid signature from the expected address", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(
        TEST_MESSAGE,
        signature,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(true);
    });

    it("should return false when expected address does not match signer", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(
        TEST_MESSAGE,
        signature,
        PROVIDER_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should return false for a tampered message", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(
        "tampered message",
        signature,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should handle verification with a different service instance", async () => {
      const signer = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const verifier = new CryptoService(PROVIDER_ACCOUNT.privateKey as `0x${string}`);

      const signature = await signer.sign(TEST_MESSAGE);
      const isValid = await verifier.verify(
        TEST_MESSAGE,
        signature,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(true);
    });

    // AC #2: Case-insensitive address comparison
    it("should verify with all-lowercase expected address", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      const lowerAddress = CLIENT_ACCOUNT.address.toLowerCase() as `0x${string}`;
      const isValid = await service.verify(TEST_MESSAGE, signature, lowerAddress);
      expect(isValid).toBe(true);
    });

    it("should verify with all-uppercase expected address (hex part)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      const upperAddress = ("0x" + CLIENT_ACCOUNT.address.slice(2).toUpperCase()) as `0x${string}`;
      const isValid = await service.verify(TEST_MESSAGE, signature, upperAddress);
      expect(isValid).toBe(true);
    });

    it("should verify with checksummed (mixed-case) expected address", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const signature = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(
        TEST_MESSAGE,
        signature,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(true);
    });

    // AC #3: Invalid signatures return false (not throw)
    it("should return false for malformed signature (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const isValid = await service.verify(
        TEST_MESSAGE,
        "0xshort" as `0x${string}`,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should return false for null signature (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const isValid = await service.verify(
        TEST_MESSAGE,
        null as unknown as `0x${string}`,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should return false for undefined signature (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const isValid = await service.verify(
        TEST_MESSAGE,
        undefined as unknown as `0x${string}`,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should return false for empty string signature (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const isValid = await service.verify(
        TEST_MESSAGE,
        "" as `0x${string}`,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should return false for malformed address (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const sig = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(TEST_MESSAGE, sig, "0xshort" as `0x${string}`);
      expect(isValid).toBe(false);
    });

    it("should return false for null address (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const sig = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(TEST_MESSAGE, sig, null as unknown as `0x${string}`);
      expect(isValid).toBe(false);
    });

    it("should return false for non-string message (not throw)", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const sig = await service.sign(TEST_MESSAGE);
      const isValid = await service.verify(
        123 as unknown as string,
        sig,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });

    it("should return false for a cryptographically invalid but well-formed signature", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      // 130 hex chars (65 bytes) but not a valid signature for this message
      const fakeSignature = `0x${"ab".repeat(65)}` as `0x${string}`;
      const isValid = await service.verify(
        TEST_MESSAGE,
        fakeSignature,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // signIVXPMessage
  // -------------------------------------------------------------------------

  describe("signIVXPMessage", () => {
    const orderId = "ivxp-550e8400-e29b-41d4-a716-446655440000";
    const txHash = "0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234";
    const timestamp = "2026-02-05T12:30:00Z";

    it("should sign an IVXP-formatted message", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const result = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      expect(result.message).toBe(
        `Order: ${orderId} | Payment: ${txHash} | Timestamp: ${timestamp}`,
      );
      expect(result.signature).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it("should produce a verifiable signature", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const result = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const isValid = await verifyMessage({
        address: CLIENT_ACCOUNT.address as `0x${string}`,
        message: result.message,
        signature: result.signature,
      });
      expect(isValid).toBe(true);
    });

    it("should use ISO 8601 timestamp when not provided", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const result = await service.signIVXPMessage({
        orderId,
        txHash,
      });

      // Verify the message contains an ISO timestamp
      const isoPattern = /Timestamp: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(result.message).toMatch(isoPattern);
    });

    it("should follow the IVXP/1.0 message format exactly", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const result = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const expectedFormat = `Order: ${orderId} | Payment: ${txHash} | Timestamp: ${timestamp}`;
      expect(result.message).toBe(expectedFormat);
    });

    it("should throw for empty orderId", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      await expect(service.signIVXPMessage({ orderId: "", txHash, timestamp })).rejects.toThrow(
        "Invalid orderId: must be a non-empty string",
      );
    });

    it("should throw for whitespace-only orderId", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      await expect(service.signIVXPMessage({ orderId: "   ", txHash, timestamp })).rejects.toThrow(
        "Invalid orderId: must be a non-empty string",
      );
    });

    it("should throw for empty txHash", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      await expect(service.signIVXPMessage({ orderId, txHash: "", timestamp })).rejects.toThrow(
        "Invalid txHash: must be a non-empty string",
      );
    });

    it("should throw for invalid timestamp format", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      await expect(
        service.signIVXPMessage({ orderId, txHash, timestamp: "not-a-date" }),
      ).rejects.toThrow("Invalid timestamp: must be ISO 8601 format");
    });
  });

  // -------------------------------------------------------------------------
  // verifyIVXPMessage
  // -------------------------------------------------------------------------

  describe("verifyIVXPMessage", () => {
    const orderId = "ivxp-550e8400-e29b-41d4-a716-446655440000";
    const txHash = "0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234";
    const timestamp = "2026-02-05T12:30:00Z";

    it("should verify a valid IVXP signed message and extract fields", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const { message, signature } = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const result: IVXPVerificationResult = await service.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.orderId).toBe(orderId);
        expect(result.txHash).toBe(txHash);
      }
    });

    it("should return valid: false for wrong signer address", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const { message, signature } = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const result = await service.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: PROVIDER_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect("orderId" in result).toBe(false);
        expect("txHash" in result).toBe(false);
      }
    });

    it("should return valid: false for invalid signature", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const message = formatIVXPMessage({ orderId, txHash, timestamp });

      const result = await service.verifyIVXPMessage({
        signedMessage: message,
        signature: "0xbad" as `0x${string}`,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(false);
    });

    it("should return valid: false for non-IVXP format message", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const nonIvxpMessage = "This is not an IVXP message";
      const signature = await service.sign(nonIvxpMessage);

      const result = await service.verifyIVXPMessage({
        signedMessage: nonIvxpMessage,
        signature,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect("orderId" in result).toBe(false);
        expect("txHash" in result).toBe(false);
      }
    });

    it("should verify with case-insensitive address", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const { message, signature } = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const lowerAddress = CLIENT_ACCOUNT.address.toLowerCase() as `0x${string}`;
      const result = await service.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: lowerAddress,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.orderId).toBe(orderId);
        expect(result.txHash).toBe(txHash);
      }
    });

    it("should handle tampered message content", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const { signature } = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      // Create a different IVXP message with different orderId
      const tamperedMessage = formatIVXPMessage({
        orderId: "ivxp-tampered-id",
        txHash,
        timestamp,
      });

      const result = await service.verifyIVXPMessage({
        signedMessage: tamperedMessage,
        signature,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(false);
    });

    // Fix #4: Signature from a completely different IVXP message (cross-message replay)
    it("should return valid: false when signature is from a different IVXP message", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);

      // Sign one IVXP message
      const { signature: signatureA } = await service.signIVXPMessage({
        orderId: "ivxp-order-A",
        txHash: "0xaaaa1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
        timestamp,
      });

      // Create a different well-formed IVXP message
      const messageB = formatIVXPMessage({
        orderId: "ivxp-order-B",
        txHash: "0xbbbb1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
        timestamp,
      });

      // Attempt to verify messageB with signatureA (cross-message replay)
      const result = await service.verifyIVXPMessage({
        signedMessage: messageB,
        signature: signatureA,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(false);
    });

    // Fix #5: Missing Payment field edge case
    it("should return valid: false for message missing Payment field", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const malformedMessage = "Order: ivxp-123 | Timestamp: 2026-01-01T00:00:00Z";
      const signature = await service.sign(malformedMessage);

      const result = await service.verifyIVXPMessage({
        signedMessage: malformedMessage,
        signature,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(false);
    });

    // Fix #5: Verify extraction trims whitespace properly
    it("should trim extracted orderId and txHash", async () => {
      const service = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const { message, signature } = await service.signIVXPMessage({
        orderId,
        txHash,
        timestamp,
      });

      const result = await service.verifyIVXPMessage({
        signedMessage: message,
        signature,
        expectedAddress: CLIENT_ACCOUNT.address as `0x${string}`,
      });

      expect(result.valid).toBe(true);
      if (result.valid) {
        // Verify the extracted values contain no leading/trailing whitespace
        expect(result.orderId).toBe(result.orderId.trim());
        expect(result.txHash).toBe(result.txHash.trim());
        expect(result.orderId).toBe(orderId);
        expect(result.txHash).toBe(txHash);
      }
    });
  });

  // -------------------------------------------------------------------------
  // ICryptoService interface compliance
  // -------------------------------------------------------------------------

  describe("ICryptoService compliance", () => {
    it("should satisfy the ICryptoService interface", () => {
      const service: ICryptoService = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      expect(service.sign).toBeTypeOf("function");
      expect(service.verify).toBeTypeOf("function");
      expect(service.getAddress).toBeTypeOf("function");
    });

    it("should return false (not throw) for invalid signature through ICryptoService interface", async () => {
      const service: ICryptoService = new CryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
      const isValid = await service.verify(
        TEST_MESSAGE,
        "0xbadbadbad" as `0x${string}`,
        CLIENT_ACCOUNT.address as `0x${string}`,
      );
      expect(isValid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// formatIVXPMessage
// ---------------------------------------------------------------------------

describe("formatIVXPMessage", () => {
  it("should format an IVXP message with all parameters", () => {
    const message = formatIVXPMessage({
      orderId: "ivxp-123",
      txHash: "0xabc",
      timestamp: "2026-01-01T00:00:00Z",
    });
    expect(message).toBe("Order: ivxp-123 | Payment: 0xabc | Timestamp: 2026-01-01T00:00:00Z");
  });

  it("should auto-generate timestamp if not provided", () => {
    const message = formatIVXPMessage({
      orderId: "ivxp-123",
      txHash: "0xabc",
    });
    expect(message).toMatch(/^Order: ivxp-123 \| Payment: 0xabc \| Timestamp: .+$/);
  });

  it("should throw for empty orderId", () => {
    expect(() => formatIVXPMessage({ orderId: "", txHash: "0xabc" })).toThrow(
      "Invalid orderId: must be a non-empty string",
    );
  });

  it("should throw for empty txHash", () => {
    expect(() => formatIVXPMessage({ orderId: "ivxp-123", txHash: "" })).toThrow(
      "Invalid txHash: must be a non-empty string",
    );
  });

  it("should throw for invalid timestamp format", () => {
    expect(() =>
      formatIVXPMessage({
        orderId: "ivxp-123",
        txHash: "0xabc",
        timestamp: "2026-01-01",
      }),
    ).toThrow("Invalid timestamp: must be ISO 8601 format");
  });

  it("should accept timestamp with milliseconds", () => {
    const message = formatIVXPMessage({
      orderId: "ivxp-123",
      txHash: "0xabc",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(message).toContain("Timestamp: 2026-01-01T00:00:00.000Z");
  });

  it("should accept timestamp with timezone offset", () => {
    const message = formatIVXPMessage({
      orderId: "ivxp-123",
      txHash: "0xabc",
      timestamp: "2026-01-01T08:00:00+08:00",
    });
    expect(message).toContain("Timestamp: 2026-01-01T08:00:00+08:00");
  });

  // Fix #3: Pipe injection prevention
  it("should throw for orderId containing pipe character", () => {
    expect(() => formatIVXPMessage({ orderId: "ivxp-123|injected", txHash: "0xabc" })).toThrow(
      "must not contain pipe character",
    );
  });

  it("should throw for txHash containing pipe character", () => {
    expect(() => formatIVXPMessage({ orderId: "ivxp-123", txHash: "0xabc|injected" })).toThrow(
      "must not contain pipe character",
    );
  });
});

// ---------------------------------------------------------------------------
// createCryptoService factory
// ---------------------------------------------------------------------------

describe("createCryptoService", () => {
  it("should create a service that implements ICryptoService", async () => {
    const service: ICryptoService = createCryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
    expect(service.sign).toBeTypeOf("function");
    expect(service.verify).toBeTypeOf("function");
    expect(service.getAddress).toBeTypeOf("function");
  });

  it("should return the correct address", async () => {
    const service = createCryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
    const address = await service.getAddress();
    expect(address).toBe(CLIENT_ACCOUNT.address);
  });

  it("should produce valid signatures", async () => {
    const service = createCryptoService(CLIENT_ACCOUNT.privateKey as `0x${string}`);
    const signature = await service.sign(TEST_MESSAGE);

    const isValid = await verifyMessage({
      address: CLIENT_ACCOUNT.address as `0x${string}`,
      message: TEST_MESSAGE,
      signature,
    });
    expect(isValid).toBe(true);
  });

  it("should throw for an invalid private key", () => {
    expect(() => createCryptoService("0xbad" as `0x${string}`)).toThrow("Invalid private key");
  });
});
