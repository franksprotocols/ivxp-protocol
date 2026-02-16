import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NetworkWarning } from "./NetworkWarning";
import { renderWithProviders } from "@/test/test-utils";
import type { NetworkStatus } from "./use-network-status";

// Mock the hook
const mockUseNetworkStatus = vi.fn<() => NetworkStatus>();

vi.mock("./use-network-status", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

function createMockStatus(overrides: Partial<NetworkStatus> = {}): NetworkStatus {
  return {
    isConnected: true,
    isWrongNetwork: true,
    currentChainId: 1,
    currentChainName: "Ethereum",
    targetChainName: "Base Sepolia",
    targetChainId: 84532,
    isSwitching: false,
    switchError: null,
    switchToTarget: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

describe("NetworkWarning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when wallet is not connected", () => {
    mockUseNetworkStatus.mockReturnValue(
      createMockStatus({ isConnected: false, isWrongNetwork: false }),
    );
    const { container } = renderWithProviders(<NetworkWarning />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when on correct network", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ isWrongNetwork: false }));
    const { container } = renderWithProviders(<NetworkWarning />);
    expect(container.firstChild).toBeNull();
  });

  it("shows warning banner when on wrong network", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus());
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/wrong network/i)).toBeInTheDocument();
  });

  it("displays current network name", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ currentChainName: "Ethereum" }));
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByText(/ethereum/i)).toBeInTheDocument();
  });

  it("displays target network name", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ targetChainName: "Base Sepolia" }));
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByText(/base sepolia/i)).toBeInTheDocument();
  });

  it("shows switch network button", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus());
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByRole("button", { name: /switch.*network/i })).toBeInTheDocument();
  });

  it("calls switchToTarget when switch button clicked", async () => {
    const switchFn = vi.fn();
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ switchToTarget: switchFn }));
    const user = userEvent.setup();
    renderWithProviders(<NetworkWarning />);

    await user.click(screen.getByRole("button", { name: /switch.*network/i }));
    expect(switchFn).toHaveBeenCalledOnce();
  });

  it("shows loading state while switching", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ isSwitching: true }));
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByText(/switching/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /switching/i })).toBeDisabled();
  });

  it("shows user rejection error message", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ switchError: "user-rejected" }));
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByText(/rejected/i)).toBeInTheDocument();
  });

  it("shows unsupported wallet error with manual instructions", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ switchError: "unsupported" }));
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByText(/manually/i)).toBeInTheDocument();
  });

  it("shows generic error for unknown errors", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ switchError: "unknown" }));
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it("has accessible alert role", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus());
    renderWithProviders(<NetworkWarning />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("error message has aria-live polite for screen readers", () => {
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ switchError: "unknown" }));
    renderWithProviders(<NetworkWarning />);
    const errorEl = screen.getByRole("status");
    expect(errorEl).toHaveAttribute("aria-live", "polite");
  });

  it("switch button can be activated with Enter key", async () => {
    const switchFn = vi.fn();
    mockUseNetworkStatus.mockReturnValue(createMockStatus({ switchToTarget: switchFn }));
    const user = userEvent.setup();
    renderWithProviders(<NetworkWarning />);

    const button = screen.getByRole("button", { name: /switch.*network/i });
    button.focus();
    await user.keyboard("{Enter}");
    expect(switchFn).toHaveBeenCalledOnce();
  });
});
