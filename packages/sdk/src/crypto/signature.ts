/**
 * CryptoService -- EIP-191 signature service implementation.
 *
 * Uses viem for all Ethereum cryptographic operations.
 * Implements the ICryptoService interface from @ivxp/protocol.
 *
 * Features:
 * - EIP-191 personal_sign message signing
 * - Signature verification against expected signer addresses
 * - IVXP/1.0 protocol message formatting and signing
 * - Factory function for convenient instantiation
 */

import { verifyMessage } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { ICryptoService } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Regex for a valid 0x-prefixed 32-byte hex private key (66 chars total). */
const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** Regex for a valid 0x-prefixed 65-byte hex signature (132 chars total). */
const HEX_SIGNATURE_REGEX = /^0x[0-9a-fA-F]{130}$/;

/** Regex for a valid 0x-prefixed 20-byte hex address (42 chars total). */
const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/**
 * Regex for a basic ISO 8601 timestamp.
 * Supports formats like: 2026-02-05T12:30:00Z, 2026-02-05T12:30:00.000Z,
 * 2026-02-05T12:30:00+00:00
 */
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// ---------------------------------------------------------------------------
// IVXP message format
// ---------------------------------------------------------------------------

/**
 * Parameters for formatting an IVXP protocol message.
 */
export interface IVXPMessageParams {
  /** The IVXP order identifier. */
  readonly orderId: string;
  /** The payment transaction hash. */
  readonly txHash: string;
  /** Optional ISO 8601 timestamp. Defaults to current time. */
  readonly timestamp?: string;
}

/**
 * Result from signing an IVXP protocol message.
 */
export interface IVXPSignedMessage {
  /** The formatted IVXP message that was signed. */
  readonly message: string;
  /** The EIP-191 signature of the message. */
  readonly signature: `0x${string}`;
}

/**
 * Format an IVXP/1.0 protocol message.
 *
 * Format: "Order: {order_id} | Payment: {tx_hash} | Timestamp: {ISO8601}"
 *
 * @param params - The message parameters
 * @returns The formatted message string
 * @throws If orderId or txHash is empty, or if timestamp is invalid ISO 8601
 */
export function formatIVXPMessage(params: IVXPMessageParams): string {
  if (!params.orderId || params.orderId.trim().length === 0) {
    throw new Error("Invalid orderId: must be a non-empty string");
  }
  if (!params.txHash || params.txHash.trim().length === 0) {
    throw new Error("Invalid txHash: must be a non-empty string");
  }
  if (params.timestamp !== undefined && !ISO_8601_REGEX.test(params.timestamp)) {
    throw new Error(
      "Invalid timestamp: must be ISO 8601 format (e.g. 2026-02-05T12:30:00Z)",
    );
  }

  const timestamp = params.timestamp ?? new Date().toISOString();
  return `Order: ${params.orderId} | Payment: ${params.txHash} | Timestamp: ${timestamp}`;
}

// ---------------------------------------------------------------------------
// CryptoService
// ---------------------------------------------------------------------------

/**
 * EIP-191 cryptographic signing and verification service.
 *
 * Wraps a viem PrivateKeyAccount to provide:
 * - Message signing with personal_sign (EIP-191)
 * - Signature verification against expected addresses
 * - IVXP protocol message formatting and signing
 *
 * Implements the ICryptoService interface for use throughout the SDK.
 */
export class CryptoService implements ICryptoService {
  private readonly account: PrivateKeyAccount;

  /**
   * Create a new CryptoService instance.
   *
   * @param privateKey - A 0x-prefixed hex-encoded private key (32 bytes / 64 hex chars)
   * @throws If the private key format is invalid
   */
  constructor(privateKey: `0x${string}`) {
    if (!privateKey || !PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new Error(
        "Invalid private key: must be a 0x-prefixed 64-character hex string (32 bytes)",
      );
    }
    this.account = privateKeyToAccount(privateKey);
  }

  /**
   * Sign a message using EIP-191 personal_sign.
   *
   * @param message - The plaintext message to sign
   * @returns Hex-encoded signature string (0x-prefixed, 65 bytes)
   * @throws If message is not a string
   */
  async sign(message: string): Promise<`0x${string}`> {
    if (typeof message !== "string") {
      throw new Error("Invalid message: must be a string");
    }
    return this.account.signMessage({ message });
  }

  /**
   * Verify that a signature was produced by the expected address.
   *
   * Uses viem's verifyMessage to recover the signer address from the
   * signature and compare it against the expected address.
   *
   * Returns false for signature mismatches. Rethrows unexpected errors
   * (type errors, null references, etc.) that indicate programming mistakes.
   *
   * @param message - The original plaintext message
   * @param signature - The hex-encoded signature to verify (65 bytes)
   * @param expectedAddress - The expected signer's wallet address (20 bytes)
   * @returns true if the recovered address matches expectedAddress
   * @throws If inputs are malformed or an unexpected error occurs
   */
  async verify(
    message: string,
    signature: `0x${string}`,
    expectedAddress: `0x${string}`,
  ): Promise<boolean> {
    if (typeof message !== "string") {
      throw new Error("Invalid message: must be a string");
    }
    if (!signature || !HEX_SIGNATURE_REGEX.test(signature)) {
      throw new Error(
        "Invalid signature: must be a 0x-prefixed 130-character hex string (65 bytes)",
      );
    }
    if (!expectedAddress || !HEX_ADDRESS_REGEX.test(expectedAddress)) {
      throw new Error(
        "Invalid address: must be a 0x-prefixed 40-character hex string (20 bytes)",
      );
    }

    try {
      return await verifyMessage({
        address: expectedAddress,
        message,
        signature,
      });
    } catch (error: unknown) {
      // Signature recovery failures from viem are expected when a
      // signature is cryptographically invalid for the given message.
      // These manifest as errors during ecrecover. Return false.
      if (error instanceof Error && error.message.includes("Signature")) {
        return false;
      }
      // Rethrow unexpected errors (programming mistakes, null refs, etc.)
      throw error;
    }
  }

  /**
   * Get the wallet address associated with this crypto service instance.
   *
   * @returns The hex-encoded wallet address (0x-prefixed, checksummed)
   */
  getAddress(): Promise<`0x${string}`> {
    return Promise.resolve(this.account.address);
  }

  /**
   * Sign an IVXP/1.0 protocol-formatted message.
   *
   * Convenience method that formats the message according to the IVXP
   * protocol specification and signs it with EIP-191.
   *
   * Format: "Order: {order_id} | Payment: {tx_hash} | Timestamp: {ISO8601}"
   *
   * @param params - The IVXP message parameters
   * @returns The formatted message and its EIP-191 signature
   * @throws If orderId or txHash is empty, or if timestamp is invalid
   */
  async signIVXPMessage(params: IVXPMessageParams): Promise<IVXPSignedMessage> {
    const message = formatIVXPMessage(params);
    const signature = await this.sign(message);
    return { message, signature };
  }
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new CryptoService instance.
 *
 * Factory function that returns an ICryptoService-typed instance,
 * hiding the concrete CryptoService class behind the interface.
 *
 * @param privateKey - A 0x-prefixed hex-encoded private key
 * @returns An ICryptoService implementation
 */
export function createCryptoService(privateKey: `0x${string}`): ICryptoService {
  return new CryptoService(privateKey);
}
