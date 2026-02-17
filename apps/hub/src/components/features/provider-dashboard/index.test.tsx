import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderDashboardContent } from "./index";
import { useProviderDashboard } from "@/hooks/use-provider-dashboard";

vi.mock("@/hooks/use-provider-dashboard", () => ({
  useProviderDashboard: vi.fn(),
}));

// Mock sub-components to avoid their internal hook dependencies
vi.mock("./provider-status-card", () => ({
  ProviderStatusCard: ({ provider }: { provider: { name: string } }) => (
    <div data-testid="provider-status-card">{provider.name}</div>
  ),
}));

vi.mock("./service-catalog-summary", () => ({
  ServiceCatalogSummary: ({ services }: { services: unknown[] }) => (
    <div data-testid="service-catalog-summary">{services.length} services</div>
  ),
}));

vi.mock("./provider-update-form", () => ({
  ProviderUpdateForm: () => <div data-testid="provider-update-form">Update Form</div>,
}));

const mockedUseProviderDashboard = vi.mocked(useProviderDashboard);

describe("ProviderDashboardContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows wallet connect prompt when disconnected", () => {
    mockedUseProviderDashboard.mockReturnValue({
      provider: null,
      state: "disconnected",
      error: null,
      refetch: vi.fn(),
    });

    render(<ProviderDashboardContent />);
    expect(screen.getByText("Wallet Required")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    mockedUseProviderDashboard.mockReturnValue({
      provider: null,
      state: "loading",
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<ProviderDashboardContent />);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error alert on error state", () => {
    mockedUseProviderDashboard.mockReturnValue({
      provider: null,
      state: "error",
      error: "Something went wrong",
      refetch: vi.fn(),
    });

    render(<ProviderDashboardContent />);
    expect(screen.getByText("Error Loading Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders dashboard with provider data when loaded", () => {
    mockedUseProviderDashboard.mockReturnValue({
      provider: {
        provider_id: "prov-001",
        provider_address: "0x1234567890abcdef1234567890abcdef12345678",
        name: "Test Provider",
        description: "A test provider",
        endpoint_url: "https://test.example.com",
        services: [
          {
            service_type: "text_echo",
            name: "Text Echo",
            description: "Echoes text",
            price_usdc: "0.10",
            estimated_time_seconds: 5,
          },
        ],
        status: "active",
        verification_status: "verified",
        last_verified_at: "2026-02-01T00:00:00Z",
        last_check_at: "2026-02-01T00:00:00Z",
        consecutive_failures: 0,
        registered_at: "2026-01-15T00:00:00Z",
        updated_at: "2026-01-15T00:00:00Z",
      },
      state: "loaded",
      error: null,
      refetch: vi.fn(),
    });

    render(<ProviderDashboardContent />);
    expect(screen.getByText("Provider Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Test Provider")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Edit Provider")).toBeInTheDocument();
  });

  it("renders nothing for not-found state (redirect handled by hook)", () => {
    mockedUseProviderDashboard.mockReturnValue({
      provider: null,
      state: "not-found",
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<ProviderDashboardContent />);
    expect(container.innerHTML).toBe("");
  });
});
