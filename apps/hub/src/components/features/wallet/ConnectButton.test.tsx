import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectButton } from "./ConnectButton";
import { renderWithProviders } from "@/test/test-utils";

// Mock wagmi hooks
const mockUseAccount = vi.fn();
const mockUseConnect = vi.fn();
const mockUseDisconnect = vi.fn();

vi.mock("wagmi", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAccount: () => mockUseAccount(),
    useConnect: () => mockUseConnect(),
    useDisconnect: () => mockUseDisconnect(),
  };
});

function setupDisconnected() {
  mockUseAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
  });
  mockUseConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [
      { id: "metaMask", name: "MetaMask", type: "injected" },
      { id: "coinbaseWallet", name: "Coinbase Wallet", type: "coinbaseWallet" },
    ],
    isPending: false,
    error: null,
  });
  mockUseDisconnect.mockReturnValue({
    disconnect: vi.fn(),
  });
}

function setupConnected(address = "0x1234567890abcdef1234567890abcdef12345678") {
  const disconnectFn = vi.fn();
  mockUseAccount.mockReturnValue({
    address,
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
  });
  mockUseConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: false,
    error: null,
  });
  mockUseDisconnect.mockReturnValue({
    disconnect: disconnectFn,
  });
  return { disconnectFn };
}

function setupConnecting() {
  mockUseAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: true,
    isDisconnected: false,
  });
  mockUseConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: true,
    error: null,
  });
  mockUseDisconnect.mockReturnValue({
    disconnect: vi.fn(),
  });
}

describe("ConnectButton", () => {
  it("renders 'Connect Wallet' when disconnected", () => {
    setupDisconnected();
    renderWithProviders(<ConnectButton />);
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("shows wallet options when clicked in disconnected state", async () => {
    setupDisconnected();
    const user = userEvent.setup();
    renderWithProviders(<ConnectButton />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    expect(screen.getByText("MetaMask")).toBeInTheDocument();
    expect(screen.getByText("Coinbase Wallet")).toBeInTheDocument();
  });

  it("calls connect when a wallet option is selected", async () => {
    const connectFn = vi.fn();
    setupDisconnected();
    mockUseConnect.mockReturnValue({
      connect: connectFn,
      connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
      isPending: false,
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<ConnectButton />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await user.click(screen.getByText("MetaMask"));

    expect(connectFn).toHaveBeenCalledWith({
      connector: expect.objectContaining({ id: "metaMask" }),
    });
  });

  it("shows loading state when connecting", () => {
    setupConnecting();
    renderWithProviders(<ConnectButton />);
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it("shows truncated address when connected", () => {
    setupConnected("0x1234567890abcdef1234567890abcdef12345678");
    renderWithProviders(<ConnectButton />);
    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
  });

  it("shows disconnect option when connected and menu opened", async () => {
    setupConnected();
    const user = userEvent.setup();
    renderWithProviders(<ConnectButton />);

    await user.click(screen.getByText("0x1234...5678"));

    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
  });

  it("calls disconnect when disconnect option is clicked", async () => {
    const { disconnectFn } = setupConnected();
    const user = userEvent.setup();
    renderWithProviders(<ConnectButton />);

    await user.click(screen.getByText("0x1234...5678"));
    await user.click(screen.getByText(/disconnect/i));

    expect(disconnectFn).toHaveBeenCalled();
  });

  it("shows copy address option when connected", async () => {
    setupConnected();
    const user = userEvent.setup();
    renderWithProviders(<ConnectButton />);

    await user.click(screen.getByText("0x1234...5678"));

    expect(screen.getByText(/copy address/i)).toBeInTheDocument();
  });

  it("displays error message when connection fails", () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      isConnecting: false,
      isDisconnected: true,
    });
    mockUseConnect.mockReturnValue({
      connect: vi.fn(),
      connectors: [],
      isPending: false,
      error: new Error("User rejected the request"),
    });
    mockUseDisconnect.mockReturnValue({
      disconnect: vi.fn(),
    });

    renderWithProviders(<ConnectButton />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  describe("error message transformation", () => {
    function setupWithError(message: string) {
      mockUseAccount.mockReturnValue({
        address: undefined,
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
      });
      mockUseConnect.mockReturnValue({
        connect: vi.fn(),
        connectors: [],
        isPending: false,
        error: new Error(message),
      });
      mockUseDisconnect.mockReturnValue({
        disconnect: vi.fn(),
      });
    }

    it("shows rejection message for 'rejected' errors", () => {
      setupWithError("User rejected the request");
      renderWithProviders(<ConnectButton />);
      expect(screen.getByRole("alert")).toHaveTextContent("Connection request was rejected.");
    });

    it("shows rejection message for 'denied' errors", () => {
      setupWithError("Request denied by user");
      renderWithProviders(<ConnectButton />);
      expect(screen.getByRole("alert")).toHaveTextContent("Connection request was rejected.");
    });

    it("shows not-found message for 'not found' errors", () => {
      setupWithError("Connector not found");
      renderWithProviders(<ConnectButton />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Wallet not found. Please install a wallet extension.",
      );
    });

    it("shows not-found message for 'not installed' errors", () => {
      setupWithError("MetaMask not installed");
      renderWithProviders(<ConnectButton />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Wallet not found. Please install a wallet extension.",
      );
    });

    it("shows generic message for unknown errors", () => {
      setupWithError("Something unexpected happened");
      renderWithProviders(<ConnectButton />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to connect wallet. Please try again.",
      );
    });
  });
});
