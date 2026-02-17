import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { ServiceActions } from "./ServiceActions";
import { renderWithProviders } from "@/test/test-utils";
import type { ServiceDetail } from "@/lib/types/service";

vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn(),
  };
});

import { useAccount } from "wagmi";

const mockUseAccount = vi.mocked(useAccount);

const mockService: ServiceDetail = {
  service_type: "text_echo",
  description: "Echo back your text",
  price_usdc: "0.50",
  provider_address: "0x1234567890abcdef1234567890abcdef12345678",
  provider_name: "Echo Labs",
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
  output_schema: { type: "string", format: "text/plain" },
};

function createService(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return { ...mockService, ...overrides };
}

describe("ServiceActions", () => {
  it("renders request service button with price", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    const button = screen.getByTestId("request-service-button");
    expect(button).toHaveTextContent("Request Service - 0.50 USDC");
  });

  it("enables button when wallet is connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    expect(screen.getByTestId("request-service-button")).toBeEnabled();
  });

  it("disables button when wallet is not connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    expect(screen.getByTestId("request-service-button")).toBeDisabled();
  });

  it("shows wallet prompt when not connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    expect(screen.getByTestId("wallet-prompt")).toHaveTextContent(
      "Connect your wallet to request this service",
    );
  });

  it("does not show wallet prompt when connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    expect(screen.queryByTestId("wallet-prompt")).not.toBeInTheDocument();
  });

  it("formats price correctly in button text", () => {
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService({ price_usdc: "3" })} />);
    expect(screen.getByTestId("request-service-button")).toHaveTextContent("3.00 USDC");
  });
});
