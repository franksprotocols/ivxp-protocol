import { vi } from "vitest";
import type { Mock } from "vitest";
import type { Address } from "viem";

// ── Shared test constants (single source of truth) ──────────────────

export const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as const satisfies Address;
export const BASE_CHAIN_ID = 8453;
export const SEPOLIA_CHAIN_ID = 84532;
export const WRONG_CHAIN_ID = 1; // Ethereum mainnet (unsupported)

// ── Wagmi mock types ────────────────────────────────────────────────

/** Return type of wagmi's useAccount hook (subset used in tests). */
interface UseAccountReturn {
  address: Address | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;
  isReconnecting: boolean;
  status: string;
  chain: { id: number; name: string } | undefined;
  chainId: number | undefined;
  connector: { id: string; name: string; type: string } | undefined;
}

/** Return type of wagmi's useConnect hook (subset used in tests). */
interface UseConnectReturn {
  connect: Mock;
  connectors: ReadonlyArray<{ id: string; name: string; type: string }>;
  isPending: boolean;
  error: Error | null;
}

/** Return type of wagmi's useDisconnect hook (subset used in tests). */
interface UseDisconnectReturn {
  disconnect: Mock;
}

/** Return type of wagmi's useSwitchChain hook (subset used in tests). */
interface UseSwitchChainReturn {
  switchChain: Mock;
  isPending: boolean;
  error: Error | null;
}

export interface WagmiMocks {
  readonly useAccount: Mock<() => UseAccountReturn>;
  readonly useConnect: Mock<() => UseConnectReturn>;
  readonly useDisconnect: Mock<() => UseDisconnectReturn>;
  readonly useChainId: Mock<() => number>;
  readonly useSwitchChain: Mock<() => UseSwitchChainReturn>;
}

/**
 * Stable reference wrapper so vi.mock() closures always read the
 * latest mock set via `ref.current`, even after reassignment in beforeEach.
 */
export interface MockRef<T> {
  current: T;
}

export function createMockRef(): MockRef<WagmiMocks> {
  return { current: createWagmiMocks() };
}

export function createWagmiMocks(): WagmiMocks {
  return {
    useAccount: vi.fn<() => UseAccountReturn>(),
    useConnect: vi.fn<() => UseConnectReturn>(),
    useDisconnect: vi.fn<() => UseDisconnectReturn>(),
    useChainId: vi.fn<() => number>(),
    useSwitchChain: vi.fn<() => UseSwitchChainReturn>(),
  };
}

// ── State presets ────────────────────────────────────────────────────

export function applyDisconnectedState(mocks: WagmiMocks) {
  mocks.useAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    isReconnecting: false,
    status: "disconnected",
    chain: undefined,
    chainId: undefined,
    connector: undefined,
  });
  mocks.useConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [
      { id: "metaMask", name: "MetaMask", type: "injected" },
      { id: "coinbaseWallet", name: "Coinbase Wallet", type: "coinbaseWallet" },
    ],
    isPending: false,
    error: null,
  });
  mocks.useDisconnect.mockReturnValue({ disconnect: vi.fn() });
  mocks.useChainId.mockReturnValue(BASE_CHAIN_ID);
  mocks.useSwitchChain.mockReturnValue({
    switchChain: vi.fn(),
    isPending: false,
    error: null,
  });
}

export function applyConnectedState(
  mocks: WagmiMocks,
  address: string = MOCK_ADDRESS,
  chainId: number = BASE_CHAIN_ID,
) {
  const disconnectFn = vi.fn();
  const connectFn = vi.fn();

  mocks.useAccount.mockReturnValue({
    address,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: "connected",
    chain: { id: chainId, name: chainId === BASE_CHAIN_ID ? "Base" : "Unknown" },
    chainId,
    connector: { id: "metaMask", name: "MetaMask", type: "injected" },
  });
  mocks.useConnect.mockReturnValue({
    connect: connectFn,
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: false,
    error: null,
  });
  mocks.useDisconnect.mockReturnValue({ disconnect: disconnectFn });
  mocks.useChainId.mockReturnValue(chainId);
  mocks.useSwitchChain.mockReturnValue({
    switchChain: vi.fn(),
    isPending: false,
    error: null,
  });

  return { disconnectFn, connectFn };
}

export function applyConnectingState(mocks: WagmiMocks) {
  mocks.useAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: true,
    isDisconnected: false,
    isReconnecting: false,
    status: "connecting",
    chain: undefined,
    chainId: undefined,
    connector: undefined,
  });
  mocks.useConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: true,
    error: null,
  });
  mocks.useDisconnect.mockReturnValue({ disconnect: vi.fn() });
  mocks.useChainId.mockReturnValue(BASE_CHAIN_ID);
  mocks.useSwitchChain.mockReturnValue({
    switchChain: vi.fn(),
    isPending: false,
    error: null,
  });
}

export function applyWrongNetworkState(mocks: WagmiMocks, address: string = MOCK_ADDRESS) {
  const switchChainFn = vi.fn();

  mocks.useAccount.mockReturnValue({
    address,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
    isReconnecting: false,
    status: "connected",
    chain: { id: WRONG_CHAIN_ID, name: "Ethereum" },
    chainId: WRONG_CHAIN_ID,
    connector: { id: "metaMask", name: "MetaMask", type: "injected" },
  });
  mocks.useConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: false,
    error: null,
  });
  mocks.useDisconnect.mockReturnValue({ disconnect: vi.fn() });
  mocks.useChainId.mockReturnValue(WRONG_CHAIN_ID);
  mocks.useSwitchChain.mockReturnValue({
    switchChain: switchChainFn,
    isPending: false,
    error: null,
  });

  return { switchChainFn };
}

/**
 * Returns a vi.mock factory for "wagmi" that delegates to a MockRef.
 * Use with: `vi.mock("wagmi", createWagmiModuleMock(ref));`
 *
 * The ref-based indirection ensures the closure always reads the
 * latest mocks even after `ref.current` is reassigned in beforeEach.
 */
export function createWagmiModuleMock(ref: MockRef<WagmiMocks>) {
  return async (importOriginal: () => Promise<typeof import("wagmi")>) => {
    const actual = await importOriginal();
    return {
      ...actual,
      useAccount: (...args: unknown[]) => ref.current.useAccount(...args),
      useConnect: (...args: unknown[]) => ref.current.useConnect(...args),
      useDisconnect: (...args: unknown[]) => ref.current.useDisconnect(...args),
      useChainId: (...args: unknown[]) => ref.current.useChainId(...args),
      useSwitchChain: (...args: unknown[]) => ref.current.useSwitchChain(...args),
    };
  };
}

export function applyConnectionErrorState(mocks: WagmiMocks, errorMessage: string) {
  mocks.useAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    isReconnecting: false,
    status: "disconnected",
    chain: undefined,
    chainId: undefined,
    connector: undefined,
  });
  mocks.useConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: false,
    error: new Error(errorMessage),
  });
  mocks.useDisconnect.mockReturnValue({ disconnect: vi.fn() });
  mocks.useChainId.mockReturnValue(BASE_CHAIN_ID);
  mocks.useSwitchChain.mockReturnValue({
    switchChain: vi.fn(),
    isPending: false,
    error: null,
  });
}
