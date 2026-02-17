import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaygroundContent } from "./playground-content";

// Radix Select uses pointer capture APIs not available in jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock wagmi hooks
const mockUseAccount = vi.fn();
const mockUseChainId = vi.fn();

vi.mock("wagmi", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAccount: () => mockUseAccount(),
    useChainId: () => mockUseChainId(),
  };
});

describe("PlaygroundContent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ services: [] }), { status: 200 }),
    );
    mockUseAccount.mockReturnValue({ isConnected: false });
    mockUseChainId.mockReturnValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the playground content", () => {
    render(<PlaygroundContent />);
    expect(screen.getByTestId("playground-content")).toBeInTheDocument();
  });

  it("renders the quick start guide", () => {
    render(<PlaygroundContent />);
    expect(screen.getByTestId("quick-start-guide")).toBeInTheDocument();
  });

  it("renders faucet links", () => {
    render(<PlaygroundContent />);
    expect(screen.getByTestId("faucet-links")).toBeInTheDocument();
  });

  it("renders demo provider info", () => {
    render(<PlaygroundContent />);
    expect(screen.getByTestId("demo-provider-info")).toBeInTheDocument();
  });

  it("renders service tester", () => {
    render(<PlaygroundContent />);
    expect(screen.getByTestId("service-tester")).toBeInTheDocument();
  });

  it("renders protocol inspector", () => {
    render(<PlaygroundContent />);
    expect(screen.getByTestId("protocol-inspector")).toBeInTheDocument();
  });

  it("shows wallet not connected prompt when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    render(<PlaygroundContent />);
    expect(screen.getByTestId("connect-wallet-prompt")).toBeInTheDocument();
    expect(screen.getByText("Wallet Not Connected")).toBeInTheDocument();
  });

  it("shows wallet connected badge when connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: true });
    mockUseChainId.mockReturnValue(84532);
    render(<PlaygroundContent />);
    expect(screen.getByText("Wallet Connected")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-wallet-prompt")).not.toBeInTheDocument();
  });

  it("shows wrong network prompt when on wrong chain", () => {
    mockUseAccount.mockReturnValue({ isConnected: true });
    mockUseChainId.mockReturnValue(1);
    render(<PlaygroundContent />);
    expect(screen.getByTestId("switch-network-prompt")).toBeInTheDocument();
    expect(screen.getAllByText("Wrong Network").length).toBeGreaterThan(0);
  });

  it("shows correct network badge on Base Sepolia", () => {
    mockUseAccount.mockReturnValue({ isConnected: true });
    mockUseChainId.mockReturnValue(84532);
    render(<PlaygroundContent />);
    expect(screen.getByText("Base Sepolia")).toBeInTheDocument();
    expect(screen.queryByTestId("switch-network-prompt")).not.toBeInTheDocument();
  });
});
