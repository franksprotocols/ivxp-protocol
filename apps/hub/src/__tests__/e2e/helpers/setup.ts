/**
 * E2E test environment setup and teardown.
 *
 * Provides shared test constants, mock wallet configuration,
 * and environment lifecycle helpers for purchase flow E2E tests.
 */

import { vi } from "vitest";
import type { Address } from "viem";
import { MOCK_ADDRESS, SEPOLIA_CHAIN_ID } from "./mocks";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

export const TEST_WALLET_ADDRESS = "0xUserAddress0000000000000000000000000001" as Address;
/** Re-export from mocks.ts for backward compatibility. */
export const PROVIDER_ADDRESS = MOCK_ADDRESS;
export const FAKE_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;
export const FAKE_SIGNATURE = "0xfakesignature123abc" as `0x${string}`;
/** Re-export from mocks.ts for backward compatibility. */
export const BASE_SEPOLIA_CHAIN_ID = SEPOLIA_CHAIN_ID;

/** Quote expiry window: 15 minutes from creation. */
const QUOTE_EXPIRY_MS = 15 * 60 * 1000;

export const MOCK_QUOTE = {
  order_id: "ord_test_e2e_001",
  price_usdc: "1.00",
  payment_address: PROVIDER_ADDRESS,
  expires_at: new Date(Date.now() + QUOTE_EXPIRY_MS).toISOString(),
  service_type: "text_echo",
} as const;

// ---------------------------------------------------------------------------
// Mock return-value constants (avoid magic numbers)
// ---------------------------------------------------------------------------

/** 10 USDC in 6-decimal raw units (10 * 10^6). */
const MOCK_USDC_BALANCE = 10_000_000n;
/** Sufficient allowance matching the balance. */
const MOCK_USDC_ALLOWANCE = 10_000_000n;
/** Arbitrary block number for receipt stubs. */
const MOCK_BLOCK_NUMBER = 42n;

// ---------------------------------------------------------------------------
// Mock function factories
// ---------------------------------------------------------------------------

export interface PaymentMocks {
  readonly writeContractAsync: ReturnType<typeof vi.fn>;
  readonly readContract: ReturnType<typeof vi.fn>;
  readonly waitForTransactionReceipt: ReturnType<typeof vi.fn>;
  readonly updateOrderPayment: ReturnType<typeof vi.fn>;
}

export function createPaymentMocks(): PaymentMocks {
  const writeContractAsync = vi.fn().mockResolvedValue(FAKE_TX_HASH);
  const readContract = vi.fn().mockImplementation(
    ({ functionName }: { functionName: string }) => {
      if (functionName === "balanceOf") return Promise.resolve(MOCK_USDC_BALANCE);
      if (functionName === "allowance") return Promise.resolve(MOCK_USDC_ALLOWANCE);
      return Promise.resolve(0n);
    },
  );
  const waitForTransactionReceipt = vi.fn().mockResolvedValue({
    blockNumber: MOCK_BLOCK_NUMBER,
    status: "success",
  });
  const updateOrderPayment = vi.fn();

  return { writeContractAsync, readContract, waitForTransactionReceipt, updateOrderPayment };
}

export interface SignatureMocks {
  readonly signMessageAsync: ReturnType<typeof vi.fn>;
  readonly requestDelivery: ReturnType<typeof vi.fn>;
  readonly updateOrderStatus: ReturnType<typeof vi.fn>;
  readonly push: ReturnType<typeof vi.fn>;
}

export function createSignatureMocks(): SignatureMocks {
  const signMessageAsync = vi.fn().mockResolvedValue(FAKE_SIGNATURE);
  const requestDelivery = vi.fn().mockResolvedValue({
    order_id: MOCK_QUOTE.order_id,
    status: "processing",
  });
  const updateOrderStatus = vi.fn();
  const push = vi.fn();

  return { signMessageAsync, requestDelivery, updateOrderStatus, push };
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

/** Reset all mock functions in a PaymentMocks set. */
export function resetPaymentMocks(mocks: PaymentMocks): void {
  mocks.writeContractAsync.mockReset();
  mocks.readContract.mockReset();
  mocks.waitForTransactionReceipt.mockReset();
  mocks.updateOrderPayment.mockReset();
}

/** Reset all mock functions in a SignatureMocks set. */
export function resetSignatureMocks(mocks: SignatureMocks): void {
  mocks.signMessageAsync.mockReset();
  mocks.requestDelivery.mockReset();
  mocks.updateOrderStatus.mockReset();
  mocks.push.mockReset();
}

// ---------------------------------------------------------------------------
// Timeout configuration for E2E tests
// ---------------------------------------------------------------------------

export const E2E_TEST_TIMEOUT = 30_000;
