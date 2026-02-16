import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderInfo } from "./ProviderInfo";
import { renderWithProviders } from "@/test/test-utils";
import type { ServiceDetail } from "@/lib/types/service";

const mockService: ServiceDetail = {
  service_type: "text_echo",
  description: "Echo back your text",
  price_usdc: "0.50",
  provider_address: "0x1234567890abcdef1234567890abcdef12345678",
  provider_name: "Echo Labs",
  provider_reputation: 4.8,
  category: "Demo",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text to echo", required: true },
    },
    required: ["text"],
  },
  output_schema: { type: "string", format: "text/plain" },
};

const mockWriteText = vi.fn().mockResolvedValue(undefined);

describe("ProviderInfo", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });
    mockWriteText.mockClear();
  });

  it("renders provider name", () => {
    renderWithProviders(<ProviderInfo service={mockService} />);
    expect(screen.getByTestId("provider-name")).toHaveTextContent("Echo Labs");
  });

  it("renders truncated provider address", () => {
    renderWithProviders(<ProviderInfo service={mockService} />);
    expect(screen.getByTestId("provider-address")).toHaveTextContent("0x1234...5678");
  });

  it("renders provider reputation", () => {
    renderWithProviders(<ProviderInfo service={mockService} />);
    const reputation = screen.getByTestId("provider-reputation");
    expect(reputation).toHaveTextContent("4.8");
    expect(reputation).toHaveTextContent("/ 5.0");
  });

  it("does not render reputation when not provided", () => {
    const serviceNoRep: ServiceDetail = { ...mockService, provider_reputation: undefined };
    renderWithProviders(<ProviderInfo service={serviceNoRep} />);
    expect(screen.queryByTestId("provider-reputation")).not.toBeInTheDocument();
  });

  it("shows truncated address as name when provider_name is undefined", () => {
    const serviceNoName: ServiceDetail = { ...mockService, provider_name: undefined };
    renderWithProviders(<ProviderInfo service={serviceNoName} />);
    expect(screen.getByTestId("provider-name")).toHaveTextContent("0x1234...5678");
  });

  it("shows check icon after copy button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProviderInfo service={mockService} />);

    const button = screen.getByTestId("copy-address-button");
    await user.click(button);

    // After clicking, the component shows a check icon (copied state becomes true)
    await waitFor(() => {
      const svg = button.querySelector("svg");
      expect(svg).toHaveClass("text-green-500");
    });
  });

  it("renders copy address button with accessible label", () => {
    renderWithProviders(<ProviderInfo service={mockService} />);
    expect(screen.getByRole("button", { name: /copy provider address/i })).toBeInTheDocument();
  });
});
