import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { Header } from "./Header";
import { renderWithProviders } from "@/test/test-utils";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock wagmi hooks for ConnectButton
const mockUseAccount = vi.fn();
const mockUseConnect = vi.fn();
const mockUseDisconnect = vi.fn();
const mockUseSwitchChain = vi.fn();
const mockUseChainId = vi.fn();

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: (...args: unknown[]) => mockUseAccount(...args),
    useConnect: (...args: unknown[]) => mockUseConnect(...args),
    useDisconnect: (...args: unknown[]) => mockUseDisconnect(...args),
    useSwitchChain: (...args: unknown[]) => mockUseSwitchChain(...args),
    useChainId: (...args: unknown[]) => mockUseChainId(...args),
  };
});

function setupWagmiMocks() {
  mockUseAccount.mockReturnValue({
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
  });
  mockUseConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
    isPending: false,
    error: null,
  });
  mockUseDisconnect.mockReturnValue({ disconnect: vi.fn() });
  mockUseSwitchChain.mockReturnValue({
    switchChain: vi.fn(),
    isPending: false,
    error: null,
  });
  mockUseChainId.mockReturnValue(8453);
}

describe("Header", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    setupWagmiMocks();
  });

  it("renders the header element", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders the IVXP logo/brand", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("link", { name: /ivxp/i })).toBeInTheDocument();
  });

  it("renders the wallet connect button", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("renders desktop navigation links", () => {
    renderWithProviders(<Header />);
    // Desktop nav should be present (hidden on mobile via CSS)
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
  });

  it("renders mobile menu button", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("has sticky positioning", () => {
    renderWithProviders(<Header />);
    const header = screen.getByRole("banner");
    expect(header.className).toContain("sticky");
  });
});
