import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { ServiceCard } from "@/components/features/marketplace/ServiceCard";
import type { Service } from "@/lib/types/service";
import type { SearchServiceResultWire } from "@/lib/registry/types";
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
    description: "Echo back your text input",
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
    description: "Generate high-quality AI images",
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

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/marketplace",
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("Marketplace Integration", () => {
  beforeEach(() => {
    mockRef.current = createWagmiMocks();
    applyDisconnectedState(mockRef.current);
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
      expect(screen.queryByRole("button", { name: /view details/i })).not.toBeInTheDocument();
    });

    it("renders View Details as a button when onViewDetails callback is provided", async () => {
      const onViewDetails = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<ServiceCard service={testService} onViewDetails={onViewDetails} />);

      expect(screen.queryByRole("link", { name: /view details/i })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /view details/i }));

      expect(onViewDetails).toHaveBeenCalledWith(testService);
    });
  });
});
