import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceActions } from "./ServiceActions";
import { renderWithProviders } from "@/test/test-utils";
import type { ServiceDetail } from "@/lib/types/service";
import type { ServiceQuote } from "@/hooks/use-service-request";

vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn(),
  };
});

vi.mock("@/components/features/service-request-form", () => ({
  ServiceRequestForm: ({
    onQuoteReceived,
  }: {
    onQuoteReceived?: (quote: ServiceQuote) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-quote-success"
      onClick={() =>
        onQuoteReceived?.({
          order_id: "ord_123",
          price_usdc: "0.50",
          payment_address: "0x1234567890abcdef1234567890abcdef12345678",
          expires_at: new Date().toISOString(),
          service_type: "text_echo",
        })
      }
    >
      Mock success
    </button>
  ),
}));

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

  it("keeps button clickable when wallet is not connected", () => {
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    expect(screen.getByTestId("request-service-button")).toBeEnabled();
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

  it("opens request sheet when button is clicked while disconnected", async () => {
    const user = userEvent.setup();
    mockUseAccount.mockReturnValue({
      isConnected: false,
      address: undefined,
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(<ServiceActions service={createService()} />);
    await user.click(screen.getByTestId("request-service-button"));

    expect(
      screen.getByText("Fill in the details below to request a quote for this service."),
    ).toBeInTheDocument();
  });

  it("keeps request sheet open after quote is received", async () => {
    const user = userEvent.setup();
    const onQuoteReceived = vi.fn();
    mockUseAccount.mockReturnValue({
      isConnected: true,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    } as unknown as ReturnType<typeof useAccount>);

    renderWithProviders(
      <ServiceActions service={createService()} onQuoteReceived={onQuoteReceived} />,
    );
    await user.click(screen.getByTestId("request-service-button"));
    await user.click(screen.getByTestId("mock-quote-success"));

    expect(onQuoteReceived).toHaveBeenCalledWith(expect.objectContaining({ order_id: "ord_123" }));
    expect(screen.getByText("Request Service")).toBeInTheDocument();
  });
});
