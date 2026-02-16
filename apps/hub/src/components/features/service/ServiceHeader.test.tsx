import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { ServiceHeader } from "./ServiceHeader";
import { renderWithProviders } from "@/test/test-utils";
import type { ServiceDetail } from "@/lib/types/service";

const mockService: ServiceDetail = {
  service_type: "text_echo",
  description: "Echo back your text",
  long_description: "Full description of the echo service",
  price_usdc: "0.50",
  provider_address: "0x1234567890abcdef1234567890abcdef12345678",
  provider_name: "Echo Labs",
  provider_reputation: 4.8,
  category: "Demo",
  tags: ["text", "echo"],
  estimated_time: "< 1 second",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text to echo", required: true },
    },
    required: ["text"],
  },
  output_schema: { type: "string", format: "text/plain" },
};

describe("ServiceHeader", () => {
  it("renders the service name as a heading", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Text Echo");
  });

  it("renders the price", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    expect(screen.getByTestId("service-price")).toHaveTextContent("0.50 USDC");
  });

  it("renders category badge", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    expect(screen.getByTestId("service-category")).toHaveTextContent("Demo");
  });

  it("renders tags", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    const tags = screen.getAllByTestId("service-tag");
    expect(tags).toHaveLength(2);
    expect(tags[0]).toHaveTextContent("text");
    expect(tags[1]).toHaveTextContent("echo");
  });

  it("renders estimated time", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    expect(screen.getByText("< 1 second")).toBeInTheDocument();
  });

  it("renders breadcrumb navigation", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByText("Marketplace")).toBeInTheDocument();
  });

  it("renders back link to marketplace", () => {
    renderWithProviders(<ServiceHeader service={mockService} />);
    const link = screen.getByRole("link", { name: /marketplace/i });
    expect(link).toHaveAttribute("href", "/marketplace");
  });

  it("does not render category badge when category is undefined", () => {
    const serviceNoCategory: ServiceDetail = { ...mockService, category: undefined };
    renderWithProviders(<ServiceHeader service={serviceNoCategory} />);
    expect(screen.queryByTestId("service-category")).not.toBeInTheDocument();
  });

  it("does not render tags when tags are undefined", () => {
    const serviceNoTags: ServiceDetail = { ...mockService, tags: undefined };
    renderWithProviders(<ServiceHeader service={serviceNoTags} />);
    expect(screen.queryByTestId("service-tag")).not.toBeInTheDocument();
  });

  it("does not render tags when tags array is empty", () => {
    const serviceEmptyTags: ServiceDetail = { ...mockService, tags: [] };
    renderWithProviders(<ServiceHeader service={serviceEmptyTags} />);
    expect(screen.queryByTestId("service-tag")).not.toBeInTheDocument();
  });

  it("does not render estimated time when not provided", () => {
    const serviceNoTime: ServiceDetail = { ...mockService, estimated_time: undefined };
    renderWithProviders(<ServiceHeader service={serviceNoTime} />);
    expect(screen.queryByText("< 1 second")).not.toBeInTheDocument();
  });
});
