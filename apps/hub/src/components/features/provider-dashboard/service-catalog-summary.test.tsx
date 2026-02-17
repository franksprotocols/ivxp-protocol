import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceCatalogSummary } from "./service-catalog-summary";
import type { ProviderServiceWire } from "@/lib/registry/types";

const mockServices: ProviderServiceWire[] = [
  {
    service_type: "text_echo",
    name: "Text Echo",
    description: "Echoes text back",
    price_usdc: "0.10",
    estimated_time_seconds: 5,
  },
  {
    service_type: "image_gen",
    name: "Image Generation",
    description: "Generates images from text",
    price_usdc: "1.50",
    estimated_time_seconds: 30,
  },
];

describe("ServiceCatalogSummary", () => {
  it("renders service count badge", () => {
    render(<ServiceCatalogSummary services={mockServices} />);
    expect(screen.getByText("2 services")).toBeInTheDocument();
  });

  it("renders singular service count", () => {
    render(<ServiceCatalogSummary services={[mockServices[0]]} />);
    expect(screen.getByText("1 service")).toBeInTheDocument();
  });

  it("renders service names", () => {
    render(<ServiceCatalogSummary services={mockServices} />);
    expect(screen.getByText("Text Echo")).toBeInTheDocument();
    expect(screen.getByText("Image Generation")).toBeInTheDocument();
  });

  it("renders service types", () => {
    render(<ServiceCatalogSummary services={mockServices} />);
    expect(screen.getByText("text_echo")).toBeInTheDocument();
    expect(screen.getByText("image_gen")).toBeInTheDocument();
  });

  it("renders service prices", () => {
    render(<ServiceCatalogSummary services={mockServices} />);
    expect(screen.getByText("$0.10")).toBeInTheDocument();
    expect(screen.getByText("$1.50")).toBeInTheDocument();
  });

  it("renders estimated times", () => {
    render(<ServiceCatalogSummary services={mockServices} />);
    expect(screen.getByText("5s")).toBeInTheDocument();
    expect(screen.getByText("30s")).toBeInTheDocument();
  });

  it("shows empty state when no services", () => {
    render(<ServiceCatalogSummary services={[]} />);
    expect(screen.getByText(/No services registered/)).toBeInTheDocument();
  });

  it("renders Service Catalog title", () => {
    render(<ServiceCatalogSummary services={mockServices} />);
    expect(screen.getByText("Service Catalog")).toBeInTheDocument();
  });
});
