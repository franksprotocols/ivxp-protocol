import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { ServiceGrid } from "./ServiceGrid";
import { renderWithProviders } from "@/test/test-utils";
import type { Service } from "@/lib/types/service";

const mockServices: Service[] = [
  {
    service_type: "text_echo",
    description: "Echo back your text",
    price_usdc: "0.50",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    provider_name: "Echo Labs",
    category: "Demo",
  },
  {
    service_type: "image_gen",
    description: "Generate images from text",
    price_usdc: "1.50",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_name: "PixelMind AI",
    category: "AI",
  },
];

describe("ServiceGrid", () => {
  it("renders service cards for each service", () => {
    renderWithProviders(<ServiceGrid services={mockServices} isLoading={false} />);
    expect(screen.getByText("Text Echo")).toBeInTheDocument();
    expect(screen.getByText("Image Gen")).toBeInTheDocument();
  });

  it("renders loading skeletons when isLoading is true", () => {
    renderWithProviders(<ServiceGrid services={[]} isLoading={true} />);
    const skeletons = screen.getAllByTestId("skeleton-card");
    expect(skeletons.length).toBe(4);
  });

  it("renders empty state when no services", () => {
    renderWithProviders(<ServiceGrid services={[]} isLoading={false} />);
    expect(screen.getByText("No services found")).toBeInTheDocument();
  });

  it("renders custom empty message", () => {
    renderWithProviders(
      <ServiceGrid services={[]} isLoading={false} emptyMessage="No results for your search" />,
    );
    expect(screen.getByText("No results for your search")).toBeInTheDocument();
  });

  it("shows suggestion text in empty state", () => {
    renderWithProviders(<ServiceGrid services={[]} isLoading={false} />);
    expect(screen.getByText("Try adjusting your search or filters.")).toBeInTheDocument();
  });

  it("does not show empty state when loading", () => {
    renderWithProviders(<ServiceGrid services={[]} isLoading={true} />);
    expect(screen.queryByText("No services found")).not.toBeInTheDocument();
  });
});
