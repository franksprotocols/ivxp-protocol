/**
 * E2E test environment setup and teardown.
 *
 * Provides shared test constants, deterministic mock chain/provider fixtures,
 * and environment lifecycle helpers for purchase-flow E2E tests.
 */

import { vi } from "vitest";
import { createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  createTestChain,
  TEST_ACCOUNTS,
  ANVIL_RPC_URL,
  MockProvider,
  MockUSDC,
} from "@ivxp/test-utils";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

export const TEST_WALLET_ADDRESS = TEST_ACCOUNTS.client.address as Address;
export const TEST_WALLET_PRIVATE_KEY = TEST_ACCOUNTS.client.privateKey;
export const PROVIDER_ADDRESS = TEST_ACCOUNTS.provider.address as Address;
export const FAKE_TX_HASH =
  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`;
export const FAKE_SIGNATURE = "0xfakesignature123abc" as `0x${string}`;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

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
// E2E infrastructure
// ---------------------------------------------------------------------------

interface MockUSDCAdapter {
  readonly address: Address;
  mint(to: Address, amount: bigint): Promise<`0x${string}`>;
  balanceOf(account: Address): Promise<bigint>;
  transferFromPrivateKey(
    fromPrivateKey: `0x${string}`,
    to: Address,
    amount: bigint,
  ): Promise<`0x${string}`>;
  verifyTransfer(
    txHash: `0x${string}`,
    expectedTo: Address,
    expectedAmount: bigint,
  ): Promise<boolean>;
}

class InMemoryMockUSDC implements MockUSDCAdapter {
  readonly address = "0x0000000000000000000000000000000000000001" as Address;
  private readonly balances = new Map<string, bigint>();
  private readonly transfers = new Map<string, { to: string; amount: bigint }>();
  private txNonce = 1n;

  private nextTxHash(): `0x${string}` {
    const hex = this.txNonce.toString(16).padStart(64, "0");
    this.txNonce += 1n;
    return `0x${hex}` as `0x${string}`;
  }

  async mint(to: Address, amount: bigint): Promise<`0x${string}`> {
    const key = to.toLowerCase();
    const current = this.balances.get(key) ?? 0n;
    this.balances.set(key, current + amount);
    return this.nextTxHash();
  }

  async balanceOf(account: Address): Promise<bigint> {
    return this.balances.get(account.toLowerCase()) ?? 0n;
  }

  async transferFromPrivateKey(
    fromPrivateKey: `0x${string}`,
    to: Address,
    amount: bigint,
  ): Promise<`0x${string}`> {
    const from = privateKeyToAccount(fromPrivateKey).address.toLowerCase();
    const toKey = to.toLowerCase();
    const fromBalance = this.balances.get(from) ?? 0n;
    if (fromBalance < amount) {
      throw new Error("insufficient");
    }

    this.balances.set(from, fromBalance - amount);
    this.balances.set(toKey, (this.balances.get(toKey) ?? 0n) + amount);

    const txHash = this.nextTxHash();
    this.transfers.set(txHash, { to: toKey, amount });
    return txHash;
  }

  async verifyTransfer(
    txHash: `0x${string}`,
    expectedTo: Address,
    expectedAmount: bigint,
  ): Promise<boolean> {
    const transfer = this.transfers.get(txHash);
    if (!transfer) return false;
    return transfer.to === expectedTo.toLowerCase() && transfer.amount === expectedAmount;
  }
}

async function isAnvilAvailable(rpcUrl: string): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { result?: string };
    return payload.result === "0x7a69";
  } catch {
    return false;
  }
}

export interface E2ETestEnvironment {
  readonly testClient: ReturnType<typeof createTestChain>;
  readonly clientWallet: ReturnType<typeof createWalletClient>;
  readonly providerWallet: ReturnType<typeof createWalletClient>;
  readonly mockUsdc: MockUSDCAdapter;
  readonly mockProvider: MockProvider;
  readonly accounts: {
    readonly client: typeof TEST_ACCOUNTS.client;
    readonly provider: typeof TEST_ACCOUNTS.provider;
  };
}

/**
 * Set up E2E test environment with deterministic test fixtures.
 *
 * Includes:
 * - Anvil-compatible viem test client
 * - Wallet clients using hardcoded TEST_ACCOUNTS keys
 * - Mock USDC contract deployed from @ivxp/test-utils
 * - Mock provider from @ivxp/test-utils implementing IVXP/1.0 messages
 */
export async function setupTestEnvironment(): Promise<E2ETestEnvironment> {
  const testClient = createTestChain();
  const hasAnvil = await isAnvilAvailable(ANVIL_RPC_URL);

  const clientAccount = privateKeyToAccount(TEST_ACCOUNTS.client.privateKey as `0x${string}`);
  const providerAccount = privateKeyToAccount(TEST_ACCOUNTS.provider.privateKey as `0x${string}`);

  const clientWallet = createWalletClient({
    account: clientAccount,
    chain: foundry,
    transport: http(ANVIL_RPC_URL),
  });

  const providerWallet = createWalletClient({
    account: providerAccount,
    chain: foundry,
    transport: http(ANVIL_RPC_URL),
  });

  const mockUsdc = hasAnvil ? await MockUSDC.deploy(testClient) : new InMemoryMockUSDC();
  await mockUsdc.mint(TEST_WALLET_ADDRESS, 1_000_000_000n); // 1000 USDC (6 decimals)

  const mockProvider = await MockProvider.start({
    providerAddress: PROVIDER_ADDRESS,
    baseUrl: "http://localhost:3001",
  });

  return {
    testClient,
    clientWallet,
    providerWallet,
    mockUsdc,
    mockProvider,
    accounts: {
      client: TEST_ACCOUNTS.client,
      provider: TEST_ACCOUNTS.provider,
    },
  };
}

export async function teardownTestEnvironment(env: E2ETestEnvironment): Promise<void> {
  await env.mockProvider.stop();
}

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
  const readContract = vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === "balanceOf") return Promise.resolve(MOCK_USDC_BALANCE);
    if (functionName === "allowance") return Promise.resolve(MOCK_USDC_ALLOWANCE);
    return Promise.resolve(0n);
  });
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
  readonly updateOrderSignature: ReturnType<typeof vi.fn>;
  readonly push: ReturnType<typeof vi.fn>;
}

export function createSignatureMocks(): SignatureMocks {
  const signMessageAsync = vi.fn().mockResolvedValue(FAKE_SIGNATURE);
  const requestDelivery = vi.fn().mockResolvedValue({
    order_id: MOCK_QUOTE.order_id,
    status: "processing",
  });
  const updateOrderSignature = vi.fn();
  const push = vi.fn();

  return { signMessageAsync, requestDelivery, updateOrderSignature, push };
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
  mocks.updateOrderSignature.mockReset();
  mocks.push.mockReset();
}

// ---------------------------------------------------------------------------
// Timeout configuration for E2E tests
// ---------------------------------------------------------------------------

export const E2E_TEST_TIMEOUT = 60_000;

// ---------------------------------------------------------------------------
// Shared test utilities
// ---------------------------------------------------------------------------

/** Convert a string to an ArrayBuffer for deliverable content testing. */
export function textToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}
