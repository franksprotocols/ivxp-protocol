import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceCard } from "./ServiceCard";
import { renderWithProviders } from "@/test/test-utils";
import type { Service } from "@/lib/types/service";

const mockService: Service = {
  service_type: "image_gen",
  description: "Generate AI images from text prompts",
  price_usdc: "1.50",
  provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
  provider_name: "PixelMind AI",
  category: "AI",
};

describe("ServiceCard", () => {
  it("renders service name formatted from service_type", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    expect(screen.getByText("Image Gen")).toBeInTheDocument();
  });

  it("renders service description", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    expect(screen.getByText("Generate AI images from text prompts")).toBeInTheDocument();
  });

  it("renders price in USDC", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    expect(screen.getByText("1.50 USDC")).toBeInTheDocument();
  });

  it("renders provider name when available", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    expect(screen.getByText("PixelMind AI")).toBeInTheDocument();
  });

  it("renders truncated address when no provider name", () => {
    const serviceWithoutName: Service = {
      ...mockService,
      provider_name: undefined,
    };
    renderWithProviders(<ServiceCard service={serviceWithoutName} />);
    expect(screen.getByText("0xabcd...ef12")).toBeInTheDocument();
  });

  it("renders category badge", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    expect(screen.getByTestId("service-category")).toHaveTextContent("AI");
  });

  it("renders View Details as a link when no callback provided", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    const link = screen.getByRole("link", { name: /view details/i });
    expect(link).toHaveAttribute("href", "/marketplace/image_gen");
  });

  it("renders View Details button as enabled when callback provided", () => {
    renderWithProviders(<ServiceCard service={mockService} onViewDetails={vi.fn()} />);
    expect(screen.getByRole("button", { name: /view details/i })).toBeEnabled();
  });

  it("calls onViewDetails with service when button clicked", async () => {
    const onViewDetails = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ServiceCard service={mockService} onViewDetails={onViewDetails} />);

    await user.click(screen.getByRole("button", { name: /view details/i }));

    expect(onViewDetails).toHaveBeenCalledWith(mockService);
  });

  it("renders service name as a heading element", () => {
    renderWithProviders(<ServiceCard service={mockService} />);
    expect(screen.getByRole("heading", { name: "Image Gen" })).toBeInTheDocument();
  });

  it("does not render category badge when category is undefined", () => {
    const serviceNoCategory: Service = {
      ...mockService,
      category: undefined,
    };
    renderWithProviders(<ServiceCard service={serviceNoCategory} />);
    expect(screen.queryByTestId("service-category")).not.toBeInTheDocument();
  });

  it("handles empty service_type gracefully", () => {
    const emptyService: Service = { ...mockService, service_type: "" };
    renderWithProviders(<ServiceCard service={emptyService} />);
    // Should render without crashing; heading exists but is empty
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("handles consecutive underscores in service_type", () => {
    const weirdService: Service = {
      ...mockService,
      service_type: "text__echo",
    };
    renderWithProviders(<ServiceCard service={weirdService} />);
    expect(screen.getByText("Text Echo")).toBeInTheDocument();
  });
});
