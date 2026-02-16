import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { MarketplaceContent } from "@/components/features/marketplace/MarketplaceContent";
import { ServiceCard } from "@/components/features/marketplace/ServiceCard";
import { MOCK_SERVICES } from "@/lib/mock-data/services";
import type { Service } from "@/lib/types/service";
import {
  createWagmiMocks,
  applyDisconnectedState,
  type MockRef,
  type WagmiMocks,
} from "../e2e/helpers/mocks";

// ── Module mocks ─────────────────────────────────────────────────────

const mockRef: MockRef<WagmiMocks> = vi.hoisted(() => ({
  current: null as unknown as WagmiMocks,
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

// ── Tests ────────────────────────────────────────────────────────────

describe("Marketplace Integration", () => {
  beforeEach(() => {
    mockRef.current = createWagmiMocks();
    applyDisconnectedState(mockRef.current);
  });
  describe("page load", () => {
    it("renders all service cards from mock data", () => {
      renderWithProviders(<MarketplaceContent />);

      for (const service of MOCK_SERVICES) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
    });

    it("renders category filter buttons", () => {
      renderWithProviders(<MarketplaceContent />);

      const filterGroup = screen.getByRole("group", { name: /filter by category/i });
      expect(within(filterGroup).getByText("All")).toBeInTheDocument();
      expect(within(filterGroup).getByText("AI")).toBeInTheDocument();
      expect(within(filterGroup).getByText("Data")).toBeInTheDocument();
      expect(within(filterGroup).getByText("Compute")).toBeInTheDocument();
      expect(within(filterGroup).getByText("Demo")).toBeInTheDocument();
    });

    it("renders search input", () => {
      renderWithProviders(<MarketplaceContent />);

      expect(screen.getByRole("searchbox", { name: /search services/i })).toBeInTheDocument();
    });

    it("shows correct number of service cards", () => {
      renderWithProviders(<MarketplaceContent />);

      const viewDetailsButtons = screen.getAllByText("View Details");
      expect(viewDetailsButtons).toHaveLength(MOCK_SERVICES.length);
    });
  });

  describe("category filtering", () => {
    it("filters services by AI category", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      await user.click(screen.getByRole("button", { name: "AI" }));

      const aiServices = MOCK_SERVICES.filter((s) => s.category === "AI");
      const nonAiServices = MOCK_SERVICES.filter((s) => s.category !== "AI");

      for (const service of aiServices) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
      for (const service of nonAiServices) {
        expect(screen.queryByText(service.description)).not.toBeInTheDocument();
      }
    });

    it("filters services by Data category", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      await user.click(screen.getByRole("button", { name: "Data" }));

      const dataServices = MOCK_SERVICES.filter((s) => s.category === "Data");
      for (const service of dataServices) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
    });

    it("filters services by Demo category", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      await user.click(screen.getByRole("button", { name: "Demo" }));

      const demoServices = MOCK_SERVICES.filter((s) => s.category === "Demo");
      const nonDemoServices = MOCK_SERVICES.filter((s) => s.category !== "Demo");

      for (const service of demoServices) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
      for (const service of nonDemoServices) {
        expect(screen.queryByText(service.description)).not.toBeInTheDocument();
      }
    });

    it("shows all services when All filter is selected", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      // First filter to AI
      await user.click(screen.getByRole("button", { name: "AI" }));
      // Then back to All
      await user.click(screen.getByRole("button", { name: "All" }));

      for (const service of MOCK_SERVICES) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
    });
  });

  describe("search", () => {
    it("filters services by search query matching service type and description", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "echo");

      // "echo" matches text_echo via service_type ("text_echo") and description ("Echo back...")
      expect(screen.getByText(/echo back your text/i)).toBeInTheDocument();

      // Services whose service_type, description, and provider_name don't contain "echo" are hidden
      expect(screen.queryByText(/generate high-quality ai images/i)).not.toBeInTheDocument();
    });

    it("filters services by search query matching provider name", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "PixelMind");

      const pixelMindServices = MOCK_SERVICES.filter((s) => s.provider_name === "PixelMind AI");
      for (const service of pixelMindServices) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
    });

    it("shows empty state when no services match search", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "xyznonexistent");

      expect(screen.getByText(/no services match your search or filters/i)).toBeInTheDocument();
    });

    it("clears search and shows all services", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "echo");
      await user.clear(searchInput);

      for (const service of MOCK_SERVICES) {
        expect(screen.getByText(service.description)).toBeInTheDocument();
      }
    });
  });

  describe("combined filtering", () => {
    it("applies both category and search filters", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      // Filter by AI category
      await user.click(screen.getByRole("button", { name: "AI" }));

      // Then search within AI
      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "sentiment");

      expect(screen.getByText(/analyze text sentiment/i)).toBeInTheDocument();

      // Other AI services should not be visible
      expect(screen.queryByText(/generate high-quality ai images/i)).not.toBeInTheDocument();
    });
  });

  describe("service card", () => {
    const testService: Service = {
      service_type: "text_echo",
      description: "Echo back your text",
      price_usdc: "0.50",
      provider_address: "0x1234567890abcdef1234567890abcdef12345678",
      provider_name: "Echo Labs",
      category: "Demo",
    };

    it("renders service name, description, and price", () => {
      renderWithProviders(<ServiceCard service={testService} />);

      expect(screen.getByText("Text Echo")).toBeInTheDocument();
      expect(screen.getByText("Echo back your text")).toBeInTheDocument();
      expect(screen.getByText("0.50 USDC")).toBeInTheDocument();
    });

    it("renders provider name", () => {
      renderWithProviders(<ServiceCard service={testService} />);

      expect(screen.getByText("Echo Labs")).toBeInTheDocument();
    });

    it("renders category badge", () => {
      renderWithProviders(<ServiceCard service={testService} />);

      expect(screen.getByTestId("service-category")).toHaveTextContent("Demo");
    });

    it("renders View Details as a link when no onViewDetails callback", () => {
      renderWithProviders(<ServiceCard service={testService} />);

      const link = screen.getByRole("link", { name: /view details/i });
      expect(link).toHaveAttribute("href", "/marketplace/text_echo");
      // Should NOT render a button when no callback is provided
      expect(screen.queryByRole("button", { name: /view details/i })).not.toBeInTheDocument();
    });

    it("renders View Details as a button when onViewDetails callback is provided", async () => {
      const onViewDetails = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<ServiceCard service={testService} onViewDetails={onViewDetails} />);

      // Should render a button, NOT a link, when callback is provided
      expect(screen.queryByRole("link", { name: /view details/i })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /view details/i }));

      expect(onViewDetails).toHaveBeenCalledWith(testService);
    });
  });

  describe("empty states", () => {
    it("shows empty message when category has no services", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MarketplaceContent />);

      // Filter by Compute, then search for something that doesn't exist in Compute
      await user.click(screen.getByRole("button", { name: "Compute" }));
      const searchInput = screen.getByRole("searchbox", { name: /search services/i });
      await user.type(searchInput, "xyznonexistent");

      expect(screen.getByText(/no services match your search or filters/i)).toBeInTheDocument();
    });
  });
});
