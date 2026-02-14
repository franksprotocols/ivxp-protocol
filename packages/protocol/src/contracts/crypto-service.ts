/**
 * ICryptoService — Interface for EIP-191 cryptographic signing and verification.
 *
 * Provides wallet-based message signing, signature verification, and
 * address retrieval. All implementations must support EIP-191 personal_sign.
 *
 * Designed for dependency injection: SDK consumers can provide their own
 * implementation (e.g., using viem, ethers.js, or hardware wallets).
 */

/**
 * Service interface for cryptographic operations.
 *
 * Responsibilities:
 * - Sign messages using EIP-191 personal_sign
 * - Verify signatures against expected signer addresses
 * - Expose the wallet address of this service instance
 */
export interface ICryptoService {
  /**
   * Sign a message using EIP-191 personal_sign.
   *
   * @param message - The plaintext message to sign
   * @returns Hex-encoded signature string (0x-prefixed)
   */
  sign(message: string): Promise<`0x${string}`>;

  /**
   * Verify that a signature was produced by the expected address.
   *
   * @param message - The original plaintext message
   * @param signature - The hex-encoded signature to verify
   * @param expectedAddress - The expected signer's wallet address
   * @returns true if the recovered address matches expectedAddress
   */
  verify(
    message: string,
    signature: `0x${string}`,
    expectedAddress: `0x${string}`,
  ): Promise<boolean>;

  /**
   * Get the wallet address associated with this crypto service instance.
   *
   * This method is async to support wallet-switching scenarios where
   * the active address may need to be resolved from a provider or
   * hardware wallet at call time.
   *
   * @returns The hex-encoded wallet address (0x-prefixed, checksummed)
   */
  getAddress(): Promise<`0x${string}`>;
}
