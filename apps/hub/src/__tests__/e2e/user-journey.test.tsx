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
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";
import type { SearchServiceResultWire } from "@/lib/registry/types";
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
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAccount: () => mockRef.current.useAccount(),
    useConnect: () => mockRef.current.useConnect(),
    useDisconnect: () => mockRef.current.useDisconnect(),
    useChainId: () => mockRef.current.useChainId(),
    useSwitchChain: () => mockRef.current.useSwitchChain(),
  };
});

const mockSearchServices: SearchServiceResultWire[] = [
  {
    service_type: "text_echo",
    name: "Text Echo",
    description:
      "Echo back your text input with optional transformations. Great for testing IVXP protocol integration.",
    price_usdc: "0.50",
    estimated_time_seconds: 5,
    provider_id: "prov-001",
    provider_name: "Echo Labs",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    provider_endpoint_url: "https://echo.example.com",
  },
  {
    service_type: "image_gen",
    name: "Image Generation",
    description:
      "Generate high-quality AI images from text prompts using state-of-the-art diffusion models.",
    price_usdc: "1.50",
    estimated_time_seconds: 10,
    provider_id: "prov-002",
    provider_name: "PixelMind AI",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_endpoint_url: "https://pixelmind.example.com",
  },
];

const mockUseServiceSearch = vi.fn();

vi.mock("@/hooks/use-service-search", () => ({
  useServiceSearch: (...args: unknown[]) => mockUseServiceSearch(...args),
}));

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
    mockUseServiceSearch.mockReturnValue({
      services: mockSearchServices,
      total: mockSearchServices.length,
      page: 1,
      pageSize: 20,
      isLoading: false,
      error: undefined,
      setPage: vi.fn(),
    });
  });

  describe("Journey 1: New visitor browses marketplace and views service", () => {
    it("visitor sees marketplace with services and can view details link", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      // Header is present
      expect(screen.getByRole("banner")).toBeInTheDocument();

      // Connect wallet button is visible (not connected)
      expect(
        screen.getByRole("button", { name: /connect wallet/i }),
      ).toBeInTheDocument();

      // Marketplace content is rendered with search results
      for (const service of mockSearchServices) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }

      // View Details links point to correct service pages
      const viewDetailsLinks = screen.getAllByRole("link", {
        name: /view details/i,
      });
      expect(viewDetailsLinks.length).toBe(mockSearchServices.length);

      // Footer is present
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("visitor can search for a service via search input", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", {
        name: /search services/i,
      });
      expect(searchInput).toBeInTheDocument();
    });

    it("visitor views service detail page with wallet prompt", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/text_echo");

      const textEchoDetail = MOCK_SERVICE_DETAILS.find(
        (s) => s.service_type === "text_echo",
      )!;

      renderPageLayout(<ServiceDetail service={textEchoDetail} />);

      // Service detail is rendered
      expect(screen.getByTestId("service-detail")).toBeInTheDocument();

      // Wallet prompt is shown (not connected)
      expect(screen.getByTestId("wallet-prompt")).toHaveTextContent(
        /connect your wallet/i,
      );

      // Request service button is disabled
      expect(
        screen.getByTestId("request-service-button"),
      ).toBeDisabled();
    });
  });

  describe("Journey 2: Connect wallet, switch network, browse", () => {
    it("user connects wallet and sees address in header", () => {
      applyConnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      // Wallet address is shown instead of connect button
      expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /connect wallet/i }),
      ).not.toBeInTheDocument();
    });

    it("user on wrong network sees warning and can switch", async () => {
      applyWrongNetworkState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      const user = userEvent.setup();
      renderPageLayout(<MarketplaceContent />);

      // Network warning is visible
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(
        within(alert).getByText(/wrong network/i),
      ).toBeInTheDocument();

      // Switch network button is available
      const switchBtn = within(alert).getByRole("button", {
        name: /switch network/i,
      });
      expect(switchBtn).toBeInTheDocument();

      await user.click(switchBtn);
      expect(
        mockRef.current.useSwitchChain().switchChain,
      ).toHaveBeenCalled();
    });

    it("connected user on correct network sees no warning", () => {
      applyConnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      renderPageLayout(<MarketplaceContent />);

      // No network warning
      const alerts = screen.queryAllByRole("alert");
      const networkAlerts = alerts.filter((el) =>
        el.textContent?.includes("Wrong network"),
      );
      expect(networkAlerts).toHaveLength(0);
    });

    it("connected user can view service detail with enabled action button", () => {
      applyConnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/text_echo");

      const textEchoDetail = MOCK_SERVICE_DETAILS.find(
        (s) => s.service_type === "text_echo",
      )!;

      renderPageLayout(<ServiceDetail service={textEchoDetail} />);

      // Request service button is enabled
      expect(
        screen.getByTestId("request-service-button"),
      ).not.toBeDisabled();

      // No wallet prompt
      expect(
        screen.queryByTestId("wallet-prompt"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Journey 3: Search service, view details, navigate back", () => {
    it("user views service detail with full information", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/image_gen");

      const imageGenDetail = MOCK_SERVICE_DETAILS.find(
        (s) => s.service_type === "image_gen",
      )!;

      renderPageLayout(<ServiceDetail service={imageGenDetail} />);

      // Service detail renders with all sections
      expect(screen.getByTestId("service-detail")).toBeInTheDocument();

      // Description is shown
      expect(
        screen.getByTestId("service-description"),
      ).toBeInTheDocument();

      // Price is shown in the action button
      expect(
        screen.getByTestId("request-service-button"),
      ).toHaveTextContent(/1\.50 USDC/);
    });

    it("marketplace navigation link is active on service detail page", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace/text_echo");

      const textEchoDetail = MOCK_SERVICE_DETAILS.find(
        (s) => s.service_type === "text_echo",
      )!;

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
        connectors: [
          { id: "metaMask", name: "MetaMask", type: "injected" },
        ],
        isPending: false,
        error: new Error("User rejected the request"),
      });

      renderWithProviders(<ConnectButton />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Connection request was rejected.",
      );
    });

    it("search with no results shows helpful empty state", () => {
      applyDisconnectedState(mockRef.current);
      mockUsePathname.mockReturnValue("/marketplace");

      // Mock empty search results
      mockUseServiceSearch.mockReturnValue({
        services: [],
        total: 0,
        page: 1,
        pageSize: 20,
        isLoading: false,
        error: undefined,
        setPage: vi.fn(),
      });

      renderPageLayout(<MarketplaceContent />);

      expect(
        screen.getByText(/no services available yet/i),
      ).toBeInTheDocument();
    });
  });
});
