import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ServiceDetail } from "./ServiceDetail";
import { renderWithProviders } from "@/test/test-utils";
import type { ServiceDetail as ServiceDetailType } from "@/lib/types/service";

vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn().mockReturnValue({ isConnected: false, address: undefined }),
  };
});

const mockService: ServiceDetailType = {
  service_type: "text_echo",
  description: "Echo back your text",
  long_description: "Full description of the echo service with more details.",
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
      text: {
        type: "string",
        description: "The text to echo back",
        required: true,
        example: "Hello IVXP!",
      },
    },
    required: ["text"],
  },
  output_schema: {
    type: "string",
    format: "text/plain",
    example: "HELLO IVXP!",
  },
  examples: [
    {
      input: { text: "Hello", transform: "uppercase" },
      output: "HELLO",
      description: "Uppercase transformation",
    },
  ],
};

describe("ServiceDetail", () => {
  it("renders the service detail container", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("service-detail")).toBeInTheDocument();
  });

  it("renders the service name heading", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Text Echo");
  });

  it("renders the long description when available", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("service-description")).toHaveTextContent(
      "Full description of the echo service with more details.",
    );
  });

  it("falls back to short description when long_description is absent", () => {
    const serviceShortDesc: ServiceDetailType = {
      ...mockService,
      long_description: undefined,
    };
    renderWithProviders(<ServiceDetail service={serviceShortDesc} />);
    expect(screen.getByTestId("service-description")).toHaveTextContent("Echo back your text");
  });

  it("renders provider info section", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("provider-name")).toHaveTextContent("Echo Labs");
  });

  it("renders input schema section", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("input-schema")).toBeInTheDocument();
  });

  it("renders output schema section", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("output-schema")).toBeInTheDocument();
  });

  it("renders service actions section", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("service-actions")).toBeInTheDocument();
  });

  it("renders examples section when examples are provided", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByText("Examples")).toBeInTheDocument();
    expect(screen.getByText("Uppercase transformation")).toBeInTheDocument();
  });

  it("does not render examples section when no examples", () => {
    const serviceNoExamples: ServiceDetailType = {
      ...mockService,
      examples: undefined,
    };
    renderWithProviders(<ServiceDetail service={serviceNoExamples} />);
    expect(screen.queryByText("Examples")).not.toBeInTheDocument();
  });

  it("renders price in the header", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("service-price")).toHaveTextContent("0.50 USDC");
  });
});
