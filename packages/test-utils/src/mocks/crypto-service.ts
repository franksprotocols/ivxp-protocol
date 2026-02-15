/**
 * MockCryptoService -- Test implementation of ICryptoService.
 *
 * Provides configurable cryptographic signing and verification for tests.
 * Records all calls for assertion checking.
 */

import type { ICryptoService, HexAddress } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Call record types
// ---------------------------------------------------------------------------

/**
 * Recorded arguments from a sign() call.
 */
export interface SignCall {
  readonly message: string;
}

/**
 * Recorded arguments from a verify() call.
 */
export interface VerifyCall {
  readonly message: string;
  readonly signature: `0x${string}`;
  readonly expectedAddress: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for MockCryptoService.
 */
export interface MockCryptoServiceConfig {
  /** The wallet address to return from getAddress(). */
  readonly address: HexAddress;
  /** The signature to return from sign(). Defaults to a deterministic value. */
  readonly signatureToReturn?: `0x${string}`;
  /** Whether verify() should return true or false. Defaults to true. */
  readonly verifyResult?: boolean;
  /** If set, sign() will reject with this error. */
  readonly signError?: Error;
  /** If set, verify() will reject with this error. */
  readonly verifyError?: Error;
}

// ---------------------------------------------------------------------------
// Default signature constant
// ---------------------------------------------------------------------------

const DEFAULT_MOCK_SIGNATURE =
  "0xabababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab01" as `0x${string}`;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Mock implementation of ICryptoService for testing.
 *
 * Features:
 * - Configurable return values and failure modes
 * - Call recording for assertion checking
 * - Immutable configuration (create new instances for different configs)
 */
export class MockCryptoService implements ICryptoService {
  private readonly config: MockCryptoServiceConfig;

  // Mutable internal state: mocks need mutable fields for call recording.
  // This is intentional -- immutability applies to domain objects, not
  // test infrastructure that must track invocations.
  private signCalls: SignCall[] = [];
  private verifyCalls: VerifyCall[] = [];

  constructor(config: MockCryptoServiceConfig) {
    this.config = config;
  }

  async sign(message: string): Promise<`0x${string}`> {
    this.signCalls.push({ message });

    if (this.config.signError) {
      throw this.config.signError;
    }

    return this.config.signatureToReturn ?? DEFAULT_MOCK_SIGNATURE;
  }

  async verify(
    message: string,
    signature: `0x${string}`,
    expectedAddress: `0x${string}`,
  ): Promise<boolean> {
    this.verifyCalls.push({ message, signature, expectedAddress });

    if (this.config.verifyError) {
      throw this.config.verifyError;
    }

    return this.config.verifyResult ?? true;
  }

  async getAddress(): Promise<`0x${string}`> {
    return this.config.address;
  }

  // -----------------------------------------------------------------------
  // Test helpers (call inspection)
  // -----------------------------------------------------------------------

  /** Get all recorded sign() calls. */
  getSignCalls(): readonly SignCall[] {
    return [...this.signCalls];
  }

  /** Get all recorded verify() calls. */
  getVerifyCalls(): readonly VerifyCall[] {
    return [...this.verifyCalls];
  }

  /** Get the total number of sign() calls. */
  getSignCallCount(): number {
    return this.signCalls.length;
  }

  /** Get the total number of verify() calls. */
  getVerifyCallCount(): number {
    return this.verifyCalls.length;
  }

  /** Reset all recorded calls. */
  resetCalls(): void {
    this.signCalls = [];
    this.verifyCalls = [];
  }
}
