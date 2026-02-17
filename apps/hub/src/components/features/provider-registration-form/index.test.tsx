import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderRegistrationForm } from "./index";

const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

// Mock wagmi hooks
const mockUseAccount = vi.fn();
const mockConnect = vi.fn();
const mockConnectors = [{ id: "mock", name: "Mock Wallet" }];
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useConnect: () => ({
    connect: mockConnect,
    connectors: mockConnectors,
    isPending: false,
    error: null,
  }),
  useSignMessage: () => ({
    signMessageAsync: vi.fn(),
  }),
  useDisconnect: () => ({
    disconnect: vi.fn(),
  }),
}));

// Mock the registration hook
const mockRegister = vi.fn();
const mockReset = vi.fn();
const mockUseProviderRegistration = vi.fn();
vi.mock("@/hooks/use-provider-registration", () => ({
  useProviderRegistration: () => mockUseProviderRegistration(),
}));

// Mock next/navigation
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

describe("ProviderRegistrationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccount.mockReturnValue({
      address: MOCK_ADDRESS,
      isConnected: true,
    });
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "idle",
      error: null,
      reset: mockReset,
    });
    mockRegister.mockResolvedValue(undefined);
  });

  // AC-1: Form displays with all required fields and auto-populated wallet address
  it("renders all required fields when wallet is connected", () => {
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("registration-form")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-address-field")).toHaveValue(MOCK_ADDRESS);
    expect(screen.getByTestId("provider-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("description-input")).toBeInTheDocument();
    expect(screen.getByTestId("endpoint-url-input")).toBeInTheDocument();
    expect(screen.getByTestId("service-entry-0")).toBeInTheDocument();
    expect(screen.getByTestId("add-service-button")).toBeInTheDocument();
    expect(screen.getByTestId("submit-button")).toBeInTheDocument();
  });

  it("displays required field markers", () => {
    render(<ProviderRegistrationForm />);

    expect(screen.getByText("Provider Name *")).toBeInTheDocument();
    expect(screen.getByText("Description *")).toBeInTheDocument();
    expect(screen.getByText("Endpoint URL *")).toBeInTheDocument();
    expect(screen.getByText("Services *")).toBeInTheDocument();
  });

  // AC-2: Form disabled when wallet not connected with connect prompt
  it("shows wallet connect prompt when disconnected", () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false, isConnecting: false });
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("wallet-required-alert")).toBeInTheDocument();
    expect(screen.getByText("Wallet Required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.queryByTestId("registration-form")).not.toBeInTheDocument();
  });

  it("triggers wallet connect on button click", async () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false, isConnecting: false });
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    // ConnectButton renders a dropdown menu trigger
    const connectButton = screen.getByRole("button", { name: /connect wallet/i });
    await user.click(connectButton);

    // The dropdown should show connector options
    await waitFor(() => {
      expect(screen.getByText("Mock Wallet")).toBeInTheDocument();
    });
  });

  // AC-5: Inline validation errors for invalid/missing data
  it("shows validation errors for empty required fields on submit", async () => {
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
    });

    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("shows name too short validation error", async () => {
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    await user.type(screen.getByTestId("provider-name-input"), "AB");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it("shows invalid URL validation error", async () => {
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    await user.type(screen.getByTestId("provider-name-input"), "Test Provider");
    await user.type(screen.getByTestId("description-input"), "A valid description for testing");
    await user.type(screen.getByTestId("endpoint-url-input"), "not-a-url");
    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(screen.getByText(/valid URL/i)).toBeInTheDocument();
    });
  });

  // AC-3: EIP-191 signature prompt with clear explanation on submit
  it("shows signing explanation when state is signing", () => {
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "signing",
      error: null,
      reset: mockReset,
    });
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("signing-alert")).toBeInTheDocument();
    expect(screen.getByText(/free and requires no gas/i)).toBeInTheDocument();
  });

  it("shows 'Waiting for Signature...' on submit button during signing", () => {
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "signing",
      error: null,
      reset: mockReset,
    });
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("submit-button")).toHaveTextContent("Waiting for Signature...");
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("shows 'Registering...' on submit button during submission", () => {
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "submitting",
      error: null,
      reset: mockReset,
    });
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("submit-button")).toHaveTextContent("Registering...");
    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  // AC-6: User-friendly error messages for API errors with preserved form data
  it("displays error alert on registration failure", () => {
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "error",
      error: {
        code: "PROVIDER_ALREADY_REGISTERED",
        message: "A provider with this wallet address is already registered.",
      },
      reset: mockReset,
    });
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("registration-error")).toBeInTheDocument();
    expect(screen.getByText(/already registered/i)).toBeInTheDocument();
  });

  it("preserves form data after error", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ProviderRegistrationForm />);

    await user.type(screen.getByTestId("provider-name-input"), "My Provider");
    await user.type(screen.getByTestId("description-input"), "A great provider for testing");
    await user.type(screen.getByTestId("endpoint-url-input"), "https://example.com");

    // Verify data is entered
    expect(screen.getByTestId("provider-name-input")).toHaveValue("My Provider");
    expect(screen.getByTestId("description-input")).toHaveValue("A great provider for testing");
    expect(screen.getByTestId("endpoint-url-input")).toHaveValue("https://example.com");

    // Simulate error state by changing the mock
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "error",
      error: { code: "NETWORK_ERROR", message: "Network error" },
      reset: mockReset,
    });

    // Rerender to apply the new mock state
    rerender(<ProviderRegistrationForm />);

    // Form data should still be present after error
    expect(screen.getByTestId("provider-name-input")).toHaveValue("My Provider");
    expect(screen.getByTestId("description-input")).toHaveValue("A great provider for testing");
    expect(screen.getByTestId("endpoint-url-input")).toHaveValue("https://example.com");
  });

  // AC-7: Signature rejection shows error with retry button
  it("shows retry button on signature rejection", () => {
    mockUseProviderRegistration.mockReturnValue({
      register: mockRegister,
      state: "error",
      error: {
        code: "SIGNATURE_REJECTED",
        message: "Signature rejected. Please try again.",
      },
      reset: mockReset,
    });
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("registration-error")).toBeInTheDocument();
    expect(screen.getByText(/Signature rejected/i)).toBeInTheDocument();
    expect(screen.getByTestId("retry-button")).toBeInTheDocument();
  });

  // Service entry add/remove
  it("adds a new service entry when 'Add Service' is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    expect(screen.getByTestId("service-entry-0")).toBeInTheDocument();
    expect(screen.queryByTestId("service-entry-1")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("add-service-button"));

    expect(screen.getByTestId("service-entry-1")).toBeInTheDocument();
  });

  it("removes a service entry when 'Remove' is clicked (minimum 1 enforced)", async () => {
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    // With only 1 service, no remove button
    expect(screen.queryByTestId("remove-service-0")).not.toBeInTheDocument();

    // Add a second service
    await user.click(screen.getByTestId("add-service-button"));
    expect(screen.getByTestId("service-entry-1")).toBeInTheDocument();

    // Now remove buttons should appear
    expect(screen.getByTestId("remove-service-0")).toBeInTheDocument();
    expect(screen.getByTestId("remove-service-1")).toBeInTheDocument();

    // Remove the second service
    await user.click(screen.getByTestId("remove-service-1"));
    expect(screen.queryByTestId("service-entry-1")).not.toBeInTheDocument();
  });

  // Form submission
  it("calls register on valid form submission", async () => {
    const user = userEvent.setup();
    render(<ProviderRegistrationForm />);

    await user.type(screen.getByTestId("provider-name-input"), "Test Provider");
    await user.type(
      screen.getByTestId("description-input"),
      "A valid description for testing purposes",
    );
    await user.type(screen.getByTestId("endpoint-url-input"), "https://provider.example.com");

    // Fill service fields
    const serviceTypeInput = screen.getByPlaceholderText("text_echo");
    const serviceNameInput = screen.getByPlaceholderText("Text Echo Service");
    const serviceDescInput = screen.getByPlaceholderText("Describe what this service does...");
    const priceInput = screen.getByPlaceholderText("1.50");

    await user.type(serviceTypeInput, "text_echo");
    await user.type(serviceNameInput, "Text Echo");
    await user.type(serviceDescInput, "Echoes text back");
    await user.type(priceInput, "1.50");

    await user.click(screen.getByTestId("submit-button"));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Provider",
          description: "A valid description for testing purposes",
          endpointUrl: "https://provider.example.com",
          services: expect.arrayContaining([
            expect.objectContaining({
              serviceType: "text_echo",
              name: "Text Echo",
            }),
          ]),
        }),
      );
    });
  });
});
