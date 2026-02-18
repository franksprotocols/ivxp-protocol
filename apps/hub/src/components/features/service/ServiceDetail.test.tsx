import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceDetail } from "./ServiceDetail";
import { renderWithProviders } from "@/test/test-utils";
import type { ServiceDetail as ServiceDetailType } from "@/lib/types/service";
import type { ServiceQuote } from "@/hooks/use-service-request";
import type { Quote } from "@/components/features/quote-dialog";

vi.mock("wagmi", async () => {
  const actual = await vi.importActual("wagmi");
  return {
    ...actual,
    useAccount: vi.fn().mockReturnValue({ isConnected: false, address: undefined }),
  };
});

vi.mock("./ServiceActions", () => ({
  ServiceActions: ({
    onQuoteReceived,
  }: {
    onQuoteReceived?: (quote: ServiceQuote) => void;
  }) => (
    <div data-testid="service-actions">
      <button
        type="button"
        data-testid="emit-quote"
        onClick={() =>
          onQuoteReceived?.({
            order_id: "ord_123",
            service_type: "text_echo",
            price_usdc: "0.50",
            payment_address: "0x1234567890abcdef1234567890abcdef12345678",
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            provider_id: "prov-echo",
            provider_endpoint_url: "http://provider.custom:3001",
          })
        }
      >
        emit quote
      </button>
    </div>
  ),
}));

vi.mock("@/components/features/quote-dialog", () => ({
  QuoteDialog: ({
    open,
    quote,
    onConfirm,
  }: {
    open: boolean;
    quote: Quote;
    onConfirm: (quote: Quote) => void;
  }) =>
    open ? (
      <div data-testid="quote-dialog">
        <span data-testid="quote-provider-id">{quote.providerId}</span>
        <span data-testid="quote-provider-endpoint">{quote.providerEndpointUrl}</span>
        <button type="button" data-testid="confirm-quote" onClick={() => onConfirm(quote)}>
          confirm
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/features/payment-dialog", () => ({
  PaymentDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="payment-dialog">payment</div> : null,
}));

const mockService: ServiceDetailType = {
  service_type: "text_echo",
  description: "Echo back your text",
  long_description: "Full description of the echo service with more details.",
  price_usdc: "0.50",
  provider_address: "0x1234567890abcdef1234567890abcdef12345678",
  provider_id: "prov-echo",
  provider_endpoint_url: "http://provider.custom:3001",
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
  it("renders base content blocks", () => {
    renderWithProviders(<ServiceDetail service={mockService} />);
    expect(screen.getByTestId("service-detail")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Text Echo");
    expect(screen.getByTestId("service-description")).toHaveTextContent(
      "Full description of the echo service with more details.",
    );
    expect(screen.getByTestId("service-actions")).toBeInTheDocument();
  });

  it("opens quote dialog from action callback and transitions to payment dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ServiceDetail service={mockService} />);

    await user.click(screen.getByTestId("emit-quote"));
    expect(screen.getByTestId("quote-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("quote-provider-id")).toHaveTextContent("prov-echo");
    expect(screen.getByTestId("quote-provider-endpoint")).toHaveTextContent(
      "http://provider.custom:3001",
    );

    await user.click(screen.getByTestId("confirm-quote"));
    expect(screen.getByTestId("payment-dialog")).toBeInTheDocument();
  });
});
