/**
 * MockPaymentService -- Test implementation of IPaymentService.
 *
 * Provides configurable USDC payment operations for tests.
 * Records all calls for assertion checking.
 */

import type { IPaymentService, PaymentExpectedDetails, HexAddress, HexHash } from "@ivxp/protocol";

// ---------------------------------------------------------------------------
// Call record types
// ---------------------------------------------------------------------------

/**
 * Recorded arguments from a send() call.
 */
export interface SendCall {
  readonly to: `0x${string}`;
  readonly amount: string;
}

/**
 * Recorded arguments from a verify() call.
 */
export interface PaymentVerifyCall {
  readonly txHash: `0x${string}`;
  readonly expected: PaymentExpectedDetails;
}

/**
 * Recorded arguments from a getBalance() call.
 */
export interface GetBalanceCall {
  readonly address: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration options for MockPaymentService.
 */
export interface MockPaymentServiceConfig {
  /** Transaction hash to return from send(). Defaults to a deterministic value. */
  readonly txHashToReturn?: HexHash;
  /** Whether verify() should return true or false. Defaults to true. */
  readonly verifyResult?: boolean;
  /** Default balance to return from getBalance(). Defaults to "1000.000000". */
  readonly defaultBalance?: string;
  /** If set, send() will reject with this error. */
  readonly sendError?: Error;
  /** If set, verify() will reject with this error. */
  readonly verifyError?: Error;
  /** If set, getBalance() will reject with this error. */
  readonly getBalanceError?: Error;
}

// ---------------------------------------------------------------------------
// Default constants
// ---------------------------------------------------------------------------

const DEFAULT_TX_HASH =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as HexHash;

const DEFAULT_BALANCE = "1000.000000";

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Mock implementation of IPaymentService for testing.
 *
 * Features:
 * - Configurable return values and failure modes
 * - Per-address balance tracking via setBalance()
 * - Call recording for assertion checking
 */
export class MockPaymentService implements IPaymentService {
  private readonly config: MockPaymentServiceConfig;

  // Mutable internal state: mocks need mutable fields for test setup
  // (e.g. setBalance) and call recording. This is intentional --
  // immutability applies to domain objects, not test infrastructure.
  private balances: Map<string, string>;
  private sendCalls: SendCall[] = [];
  private verifyCalls: PaymentVerifyCall[] = [];
  private getBalanceCalls: GetBalanceCall[] = [];

  constructor(config: MockPaymentServiceConfig = {}) {
    this.config = config;
    this.balances = new Map();
  }

  async send(to: `0x${string}`, amount: string): Promise<`0x${string}`> {
    this.sendCalls.push({ to, amount });

    if (this.config.sendError) {
      throw this.config.sendError;
    }

    return this.config.txHashToReturn ?? DEFAULT_TX_HASH;
  }

  async verify(txHash: `0x${string}`, expected: PaymentExpectedDetails): Promise<boolean> {
    this.verifyCalls.push({ txHash, expected });

    if (this.config.verifyError) {
      throw this.config.verifyError;
    }

    return this.config.verifyResult ?? true;
  }

  async getBalance(address: `0x${string}`): Promise<string> {
    this.getBalanceCalls.push({ address });

    if (this.config.getBalanceError) {
      throw this.config.getBalanceError;
    }

    const key = address.toLowerCase();
    return this.balances.get(key) ?? this.config.defaultBalance ?? DEFAULT_BALANCE;
  }

  async getTransactionStatus(_txHash: `0x${string}`): Promise<{
    readonly status: "pending" | "success" | "reverted" | "not_found";
    readonly confirmations?: number;
    readonly blockNumber?: bigint;
  }> {
    return { status: "success", confirmations: 1, blockNumber: BigInt(1) };
  }

  // -----------------------------------------------------------------------
  // Test helpers
  // -----------------------------------------------------------------------

  /**
   * Set the balance for a specific address.
   *
   * Mutates internal state for test setup convenience.
   */
  setBalance(address: HexAddress, amount: string): void {
    this.balances.set(address.toLowerCase(), amount);
  }

  /** Get all recorded send() calls. */
  getSendCalls(): readonly SendCall[] {
    return [...this.sendCalls];
  }

  /** Get all recorded verify() calls. */
  getVerifyCalls(): readonly PaymentVerifyCall[] {
    return [...this.verifyCalls];
  }

  /** Get all recorded getBalance() calls. */
  getGetBalanceCalls(): readonly GetBalanceCall[] {
    return [...this.getBalanceCalls];
  }

  /** Get the total number of send() calls. */
  getSendCallCount(): number {
    return this.sendCalls.length;
  }

  /** Reset all recorded calls. */
  resetCalls(): void {
    this.sendCalls = [];
    this.verifyCalls = [];
    this.getBalanceCalls = [];
  }
}
