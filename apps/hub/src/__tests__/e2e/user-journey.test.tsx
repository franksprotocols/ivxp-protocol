import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MarketplaceContent } from "@/components/features/marketplace/MarketplaceContent";
import { ServiceDetail } from "@/components/features/service/ServiceDetail";
import { ConnectButton } from "@/components/features/wallet/ConnectButton";
import { NetworkWarning } from "@/components/features/network/NetworkWarning";
import { MOCK_SERVICES } from "@/lib/mock-data/services";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";
import {
  createWagmiMocks,
  applyDisconnectedState,
  applyConnectedState,
  applyWrongNetworkState,
  type MockRef,
  type WagmiMocks,
} from "./helpers/mocks";

// ── Module mocks ─────────────────────────────────────────────────────

const mockRef: MockRef<WagmiMocks> = vi.hoisted(() => ({
  current: null as unknown as WagmiMocks,
}));
const mockUsePathname = vi.fn().mockReturnValue("/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

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

// ── Helper: render a full page layout ────────────────────────────────

function renderPageLayout(content: React.ReactNode) {
  return renderWithProviders(
    <>
      <Header />
      <NetworkWarning />
      <main>{content}</main>
      <Footer />
    </>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe("E2E User Journeys", () => {
  beforeEach(() => {
    mockRef.current = createWagmiMocks();
    mockUsePathname.mockReturnValue("/");
  });

  describe("Journey 1: New visitor browses marketplace and views service", () => {
    it("visitor sees marketplace with services and can view details link", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      // Header is present
      expect(screen.getByRole("banner")).toBeInTheDocument();

      // Connect wallet button is visible (not connected)
      expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();

      // Marketplace content is rendered
      for (const service of MOCK_SERVICES) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }

      // View Details links point to correct service pages
      const viewDetailsLinks = screen.getAllByRole("link", { name: /view details/i });
      expect(viewDetailsLinks.length).toBe(MOCK_SERVICES.length);

      // Footer is present
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("visitor can search for a service and find it", async () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      const user = userEvent.setup();
      renderPageLayout(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "image");

      // Image gen service should be visible
      expect(screen.getByText(/generate high-quality ai images/i)).toBeInTheDocument();
    });

    it("visitor views service detail page with wallet prompt", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/text_echo");

      const textEchoDetail = MOCK_SERVICE_DETAILS.find((s) => s.service_type === "text_echo")!;

      renderPageLayout(<ServiceDetail service={textEchoDetail} />);

      // Service detail is rendered
      expect(screen.getByTestId("service-detail")).toBeInTheDocument();

      // Wallet prompt is shown (not connected)
      expect(screen.getByTestId("wallet-prompt")).toHaveTextContent(/connect your wallet/i);

      // Request service button is disabled
      expect(screen.getByTestId("request-service-button")).toBeDisabled();
    });
  });

  describe("Journey 2: Connect wallet, switch network, browse", () => {
    it("user connects wallet and sees address in header", () => {
      applyConnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      // Wallet address is shown instead of connect button
      expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /connect wallet/i })).not.toBeInTheDocument();
    });

    it("user on wrong network sees warning and can switch", async () => {
      applyWrongNetworkState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      const user = userEvent.setup();
      renderPageLayout(<MarketplaceContent />);

      // Network warning is visible
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(within(alert).getByText(/wrong network/i)).toBeInTheDocument();

      // Switch network button is available
      const switchBtn = within(alert).getByRole("button", {
        name: /switch network/i,
      });
      expect(switchBtn).toBeInTheDocument();

      await user.click(switchBtn);
      expect(mockRef.current.useSwitchChain().switchChain).toHaveBeenCalled();
    });

    it("connected user on correct network sees no warning", () => {
      applyConnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      // No network warning
      const alerts = screen.queryAllByRole("alert");
      // There should be no alert for network warning
      const networkAlerts = alerts.filter((el) => el.textContent?.includes("Wrong network"));
      expect(networkAlerts).toHaveLength(0);
    });

    it("connected user can view service detail with enabled action button", () => {
      applyConnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/text_echo");

      const textEchoDetail = MOCK_SERVICE_DETAILS.find((s) => s.service_type === "text_echo")!;

      renderPageLayout(<ServiceDetail service={textEchoDetail} />);

      // Request service button is enabled
      expect(screen.getByTestId("request-service-button")).not.toBeDisabled();

      // No wallet prompt
      expect(screen.queryByTestId("wallet-prompt")).not.toBeInTheDocument();
    });
  });

  describe("Journey 3: Search service, view details, navigate back", () => {
    it("user searches, filters, and finds specific service", async () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      const user = userEvent.setup();
      renderPageLayout(<MarketplaceContent />);

      // Filter by AI category
      await user.click(screen.getByRole("button", { name: "AI" }));

      // Search for sentiment
      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "sentiment");

      // Only sentiment analysis should be visible
      expect(screen.getByText(/analyze text sentiment/i)).toBeInTheDocument();

      // Other services should not be visible
      expect(screen.queryByText(/echo back your text/i)).not.toBeInTheDocument();
    });

    it("user views service detail with full information", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/image_gen");

      const imageGenDetail = MOCK_SERVICE_DETAILS.find((s) => s.service_type === "image_gen")!;

      renderPageLayout(<ServiceDetail service={imageGenDetail} />);

      // Service detail renders with all sections
      expect(screen.getByTestId("service-detail")).toBeInTheDocument();

      // Description is shown
      expect(screen.getByTestId("service-description")).toBeInTheDocument();

      // Price is shown in the action button
      expect(screen.getByTestId("request-service-button")).toHaveTextContent(/1\.50 USDC/);
    });

    it("marketplace navigation link is active on service detail page", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/text_echo");

      const textEchoDetail = MOCK_SERVICE_DETAILS.find((s) => s.service_type === "text_echo")!;

      renderPageLayout(<ServiceDetail service={textEchoDetail} />);

      // Marketplace nav link should be active
      const nav = screen.getByRole("navigation", { name: /main/i });
      const marketplaceLink = within(nav).getByText("Marketplace");
      expect(marketplaceLink).toHaveAttribute("data-active", "true");
    });
  });

  describe("Error recovery flows", () => {
    it("user sees error when wallet connection is rejected", () => {
      applyDisconnectedState(mockRef.current);
      mockRef.current.useConnect.mockReturnValue({
        connect: vi.fn(),
        connectors: [{ id: "metaMask", name: "MetaMask", type: "injected" }],
        isPending: false,
        error: new Error("User rejected the request"),
      });

      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("alert")).toHaveTextContent("Connection request was rejected.");
    });

    it("search with no results shows helpful empty state", async () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      const user = userEvent.setup();
      renderPageLayout(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "nonexistentservice12345");

      expect(screen.getByText(/no services match/i)).toBeInTheDocument();
      expect(screen.getByText(/try adjusting your search or filters/i)).toBeInTheDocument();
    });
  });
});
