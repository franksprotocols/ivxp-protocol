import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ConnectButton } from "@/components/features/wallet/ConnectButton";
import { NetworkWarning } from "@/components/features/network/NetworkWarning";
import {
  createWagmiMocks,
  applyDisconnectedState,
  applyConnectedState,
  applyConnectingState,
  applyWrongNetworkState,
  applyConnectionErrorState,
  MOCK_ADDRESS,
  type MockRef,
  type WagmiMocks,
} from "../e2e/helpers/mocks";

// ── Module mocks ─────────────────────────────────────────────────────

// vi.hoisted runs before vi.mock hoisting, so the ref is available
// when the vi.mock factory executes.
const mockRef: MockRef<WagmiMocks> = vi.hoisted(() => {
  // Minimal stub -- real mocks are assigned in beforeEach via createWagmiMocks()
  const noop = () => ({}) as never;
  return {
    current: {
      useAccount: Object.assign(noop, { mockReturnValue: noop }),
      useConnect: Object.assign(noop, { mockReturnValue: noop }),
      useDisconnect: Object.assign(noop, { mockReturnValue: noop }),
      useChainId: Object.assign(noop, { mockReturnValue: noop }),
      useSwitchChain: Object.assign(noop, { mockReturnValue: noop }),
    } as unknown as WagmiMocks,
  };
});

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: (...args: unknown[]) => mockRef.current.useAccount(...args),
    useConnect: (...args: unknown[]) => mockRef.current.useConnect(...args),
    useDisconnect: (...args: unknown[]) => mockRef.current.useDisconnect(...args),
    useChainId: (...args: unknown[]) => mockRef.current.useChainId(...args),
    useSwitchChain: (...args: unknown[]) => mockRef.current.useSwitchChain(...args),
  };
});

// ── Tests ────────────────────────────────────────────────────────────

describe("Wallet Connection Integration", () => {
  beforeEach(() => {
    mockRef.current = createWagmiMocks();
  });

  describe("connect flow", () => {
    it("shows Connect Wallet button when disconnected", () => {
      applyDisconnectedState(mockRef.current);
      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    });

    it("opens connector list on click and triggers connect", async () => {
      applyDisconnectedState(mockRef.current);
      const connectFn = vi.fn();
      mockRef.current.useConnect.mockReturnValue({
        connect: connectFn,
        connectors: [
          { id: "metaMask", name: "MetaMask", type: "injected" },
          { id: "coinbaseWallet", name: "Coinbase Wallet", type: "coinbaseWallet" },
        ],
        isPending: false,
        error: null,
      });

      const user = userEvent.setup();
      renderWithProviders(<ConnectButton />);

      await user.click(screen.getByRole("button", { name: /connect wallet/i }));

      expect(screen.getByText("MetaMask")).toBeInTheDocument();
      expect(screen.getByText("Coinbase Wallet")).toBeInTheDocument();

      await user.click(screen.getByText("MetaMask"));

      expect(connectFn).toHaveBeenCalledWith(
        expect.objectContaining({
          connector: expect.objectContaining({ id: "metaMask" }),
        }),
      );
    });

    it("shows loading spinner while connecting", () => {
      applyConnectingState(mockRef.current);
      renderWithProviders(<ConnectButton />);

      expect(screen.getByText(/connecting/i)).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("shows truncated address after successful connection", () => {
      applyConnectedState(mockRef.current, MOCK_ADDRESS);
      renderWithProviders(<ConnectButton />);

      expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
    });
  });

  describe("disconnect flow", () => {
    it("shows disconnect option in wallet menu", async () => {
      applyConnectedState(mockRef.current);
      const user = userEvent.setup();
      renderWithProviders(<ConnectButton />);

      await user.click(screen.getByText("0x1234...5678"));

      expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
    });

    it("calls disconnect when option is clicked", async () => {
      const { disconnectFn } = applyConnectedState(mockRef.current);
      const user = userEvent.setup();
      renderWithProviders(<ConnectButton />);

      await user.click(screen.getByText("0x1234...5678"));
      await user.click(screen.getByText(/disconnect/i));

      expect(disconnectFn).toHaveBeenCalled();
    });

    it("shows copy address option in wallet menu", async () => {
      applyConnectedState(mockRef.current);
      const user = userEvent.setup();
      renderWithProviders(<ConnectButton />);

      await user.click(screen.getByText("0x1234...5678"));

      expect(screen.getByText(/copy address/i)).toBeInTheDocument();
    });
  });

  describe("network switching", () => {
    it("shows network warning when on wrong network", () => {
      applyWrongNetworkState(mockRef.current);
      renderWithProviders(<NetworkWarning />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
    });

    it("shows switch network button", () => {
      applyWrongNetworkState(mockRef.current);
      renderWithProviders(<NetworkWarning />);

      expect(screen.getByRole("button", { name: /switch network/i })).toBeInTheDocument();
    });

    it("calls switchChain when switch button is clicked", async () => {
      const { switchChainFn } = applyWrongNetworkState(mockRef.current);
      const user = userEvent.setup();
      renderWithProviders(<NetworkWarning />);

      await user.click(screen.getByRole("button", { name: /switch network/i }));

      expect(switchChainFn).toHaveBeenCalled();
    });

    it("does not show warning when on correct network", () => {
      applyConnectedState(mockRef.current);
      renderWithProviders(<NetworkWarning />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not show warning when disconnected", () => {
      applyDisconnectedState(mockRef.current);
      renderWithProviders(<NetworkWarning />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("shows rejection error message", () => {
      applyConnectionErrorState(mockRef.current, "User rejected the request");
      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("alert")).toHaveTextContent("Connection request was rejected.");
    });

    it("shows wallet not found error message", () => {
      applyConnectionErrorState(mockRef.current, "Connector not found");
      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Wallet not found. Please install a wallet extension.",
      );
    });

    it("shows generic error for unknown failures", () => {
      applyConnectionErrorState(mockRef.current, "Something went wrong");
      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to connect wallet. Please try again.",
      );
    });

    it("shows not-installed error message", () => {
      applyConnectionErrorState(mockRef.current, "MetaMask not installed");
      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Wallet not found. Please install a wallet extension.",
      );
    });
  });

  describe("wallet state transitions", () => {
    it("transitions from disconnected to connecting to connected", () => {
      // Phase 1: Disconnected
      applyDisconnectedState(mockRef.current);
      const { rerender } = renderWithProviders(<ConnectButton />);
      expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();

      // Phase 2: Connecting (rerender same component instance with new mock state)
      applyConnectingState(mockRef.current);
      rerender(<ConnectButton />);
      expect(screen.getByText(/connecting/i)).toBeInTheDocument();

      // Phase 3: Connected (rerender same component instance with new mock state)
      applyConnectedState(mockRef.current);
      rerender(<ConnectButton />);
      expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
    });
  });
});
