import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceRequestForm } from "./index";
import type { ServiceDetail } from "@/lib/types/service";

// Mock wagmi hooks
const mockUseAccount = vi.fn();
const mockConnect = vi.fn();
const mockConnectors = [{ id: "mock", name: "Mock Wallet" }];
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useConnect: () => ({ connect: mockConnect, connectors: mockConnectors }),
}));

// Mock the service request hook
const mockSubmitRequest = vi.fn();
const mockReset = vi.fn();
const mockUseServiceRequest = vi.fn();
vi.mock("@/hooks/use-service-request", () => ({
  useServiceRequest: () => mockUseServiceRequest(),
}));

const textEchoService: ServiceDetail = {
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
      transform: {
        type: "string",
        description: "Optional transformation",
        required: false,
        example: "uppercase",
      },
    },
    required: ["text"],
  },
  output_schema: {
    type: "string",
    format: "text/plain",
  },
};

const enumService: ServiceDetail = {
  service_type: "formatter",
  description: "Format data",
  price_usdc: "1.00",
  provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
  input_schema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        description: "Output format",
        required: true,
        enum: ["json", "csv", "xml"],
      },
    },
    required: ["format"],
  },
  output_schema: { type: "string" },
};

describe("ServiceRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccount.mockReturnValue({ isConnected: true });
    mockSubmitRequest.mockResolvedValue({
      order_id: "ord_123",
      price_usdc: "0.50",
      payment_address: "0x1234",
      expires_at: new Date().toISOString(),
      service_type: "text_echo",
    });
    mockUseServiceRequest.mockReturnValue({
      submitRequest: mockSubmitRequest,
      isLoading: false,
      error: null,
      reset: mockReset,
    });
  });

  // AC #1: Form displays fields matching service input_schema
  it("renders form fields matching the service input_schema", () => {
    render(<ServiceRequestForm service={textEchoService} />);

    expect(screen.getByTestId("field-text")).toBeInTheDocument();
    expect(screen.getByTestId("field-transform")).toBeInTheDocument();
    expect(screen.getByTestId("input-text")).toBeInTheDocument();
  });

  it("marks required fields and optional fields correctly", () => {
    render(<ServiceRequestForm service={textEchoService} />);

    // The optional field should have "(optional)" text
    const transformField = screen.getByTestId("field-transform");
    expect(transformField).toHaveTextContent("(optional)");

    // The required field should NOT have "(optional)"
    const textField = screen.getByTestId("field-text");
    expect(textField).not.toHaveTextContent("(optional)");
  });

  // AC #3: Invalid submission shows inline validation errors
  it("shows validation errors for empty required fields on submit", async () => {
    const user = userEvent.setup();
    render(<ServiceRequestForm service={textEchoService} />);

    const submitButton = screen.getByTestId("submit-request-button");
    await user.click(submitButton);

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
    });

    // Form should NOT have been submitted
    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });

  // AC #2: Valid submission calls requestQuote
  it("calls submitRequest on valid form submission", async () => {
    const user = userEvent.setup();
    render(<ServiceRequestForm service={textEchoService} />);

    const textInput = screen.getByTestId("input-text");
    await user.type(textInput, "Hello world");

    const submitButton = screen.getByTestId("submit-request-button");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitRequest).toHaveBeenCalledWith(
        "text_echo",
        expect.any(String),
        expect.objectContaining({ text: "Hello world" }),
      );
    });
  });

  // AC #4: Wallet not connected shows connect prompt
  it("shows wallet connect prompt when wallet is not connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    render(<ServiceRequestForm service={textEchoService} />);

    expect(screen.getByTestId("wallet-connect-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId("submit-request-button")).not.toBeInTheDocument();
  });

  it("shows the form when wallet is connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: true });
    render(<ServiceRequestForm service={textEchoService} />);

    expect(screen.queryByTestId("wallet-connect-prompt")).not.toBeInTheDocument();
    expect(screen.getByTestId("submit-request-button")).toBeInTheDocument();
  });

  // AC #5: Failed requestQuote shows error with retry
  it("displays error message when submission fails", async () => {
    mockUseServiceRequest.mockReturnValue({
      submitRequest: mockSubmitRequest,
      isLoading: false,
      error: { message: "Provider unreachable", code: "REQUEST_FAILED" },
      reset: mockReset,
    });

    render(<ServiceRequestForm service={textEchoService} />);

    // The error alert should be visible
    expect(screen.getByTestId("request-error")).toBeInTheDocument();
    expect(screen.getByText("Provider unreachable")).toBeInTheDocument();
  });

  it("renders enum fields as select dropdowns", () => {
    render(<ServiceRequestForm service={enumService} />);

    expect(screen.getByTestId("field-format")).toBeInTheDocument();
    expect(screen.getByTestId("select-format")).toBeInTheDocument();
  });

  // AC #4: Wallet connect button triggers connect
  it("shows connect wallet button when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    render(<ServiceRequestForm service={textEchoService} />);

    expect(screen.getByTestId("wallet-connect-button")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-connect-button")).toHaveTextContent("Connect Wallet");
  });

  it("triggers wallet connect on button click", async () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    const user = userEvent.setup();
    render(<ServiceRequestForm service={textEchoService} />);

    await user.click(screen.getByTestId("wallet-connect-button"));
    expect(mockConnect).toHaveBeenCalledWith({ connector: mockConnectors[0] });
  });

  // AC #2: onQuoteReceived callback is called on success
  it("calls onQuoteReceived with quote data on successful submission", async () => {
    const onQuoteReceived = vi.fn();
    const user = userEvent.setup();
    render(<ServiceRequestForm service={textEchoService} onQuoteReceived={onQuoteReceived} />);

    await user.type(screen.getByTestId("input-text"), "Hello world");
    await user.click(screen.getByTestId("submit-request-button"));

    await waitFor(() => {
      expect(onQuoteReceived).toHaveBeenCalledWith(
        expect.objectContaining({ order_id: "ord_123" }),
      );
    });

    expect(screen.getByTestId("request-success")).toHaveTextContent("Quote Received");
    expect(screen.getByTestId("request-success")).toHaveTextContent("ord_123");
  });

  // AC #2: Uses provider_url from service when available
  it("uses service.provider_url when available", async () => {
    const serviceWithUrl: ServiceDetail = {
      ...textEchoService,
      provider_url: "https://echo-labs.ivxp.io",
    };
    const user = userEvent.setup();
    render(<ServiceRequestForm service={serviceWithUrl} />);

    await user.type(screen.getByTestId("input-text"), "test");
    await user.click(screen.getByTestId("submit-request-button"));

    await waitFor(() => {
      expect(mockSubmitRequest).toHaveBeenCalledWith(
        "text_echo",
        "https://echo-labs.ivxp.io",
        expect.any(Object),
      );
    });
  });

  // AC #5: Dismiss button calls reset to clear error
  it("calls reset when dismiss button is clicked", async () => {
    mockUseServiceRequest.mockReturnValue({
      submitRequest: mockSubmitRequest,
      isLoading: false,
      error: { message: "Provider unreachable", code: "REQUEST_FAILED" },
      reset: mockReset,
    });
    const user = userEvent.setup();
    render(<ServiceRequestForm service={textEchoService} />);

    await user.click(screen.getByTestId("retry-button"));
    expect(mockReset).toHaveBeenCalled();
  });

  // AC #2: Loading state shows spinner and disables submit
  it("shows loading spinner and disables submit when loading", () => {
    mockUseServiceRequest.mockReturnValue({
      submitRequest: mockSubmitRequest,
      isLoading: true,
      error: null,
      reset: mockReset,
    });
    render(<ServiceRequestForm service={textEchoService} />);

    const submitButton = screen.getByTestId("submit-request-button");
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Requesting Quote...");
    expect(screen.getByTestId("request-pending")).toHaveTextContent(
      "Waiting for provider response...",
    );
  });
});
