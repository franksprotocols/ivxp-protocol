import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceTester, validateInputs } from "./service-tester";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";

const testServices = Array.from(
  new Map(MOCK_SERVICE_DETAILS.map((service) => [service.service_type, service])).values(),
).slice(0, 2);

// Radix Select uses pointer capture APIs not available in jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("ServiceTester", () => {
  it("renders the service tester card", () => {
    render(<ServiceTester services={testServices} providerUrl="https://test" />);
    expect(screen.getByTestId("service-tester")).toBeInTheDocument();
    expect(screen.getByTestId("simulation-note")).toBeInTheDocument();
  });

  it("renders the service select dropdown", () => {
    render(<ServiceTester services={testServices} providerUrl="https://test" />);
    expect(screen.getByTestId("service-select")).toBeInTheDocument();
  });

  it("renders the execute button disabled when no service selected", () => {
    render(<ServiceTester services={testServices} providerUrl="https://test" />);
    const button = screen.getByTestId("execute-button");
    expect(button).toBeDisabled();
  });

  it("shows dynamic input fields after selecting a service", async () => {
    const user = userEvent.setup();
    render(<ServiceTester services={testServices} providerUrl="https://test" />);

    await user.click(screen.getByTestId("service-select"));

    const option = await screen.findByText(
      `${testServices[0].service_type} (${testServices[0].price_usdc} USDC)`,
    );
    await user.click(option);

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-input-fields")).toBeInTheDocument();
    });
  });

  it("executes service and shows result", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ServiceTester services={testServices} providerUrl="https://test" onResult={onResult} />,
    );

    await user.click(screen.getByTestId("service-select"));
    const option = await screen.findByText(
      `${testServices[0].service_type} (${testServices[0].price_usdc} USDC)`,
    );
    await user.click(option);

    const executeButton = screen.getByTestId("execute-button");
    await user.click(executeButton);

    await waitFor(
      () => {
        expect(screen.getByTestId("execution-result")).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    expect(onResult).toHaveBeenCalled();
    expect(screen.getByTestId("real-flow-cta")).toHaveAttribute("href", "/marketplace");
  });

  it("emits protocol events during execution", async () => {
    const user = userEvent.setup();
    const onEvent = vi.fn();
    render(<ServiceTester services={testServices} providerUrl="https://test" onEvent={onEvent} />);

    await user.click(screen.getByTestId("service-select"));
    const option = await screen.findByText(
      `${testServices[0].service_type} (${testServices[0].price_usdc} USDC)`,
    );
    await user.click(option);

    await user.click(screen.getByTestId("execute-button"));

    // Wait for the full flow to complete (result appears)
    await waitFor(
      () => {
        expect(screen.getByTestId("execution-result")).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );

    const eventTypes = onEvent.mock.calls.map(
      (call: unknown[]) => (call[0] as { type: string }).type,
    );
    expect(eventTypes).toContain("order.quoted");
    expect(eventTypes).toContain("payment.sent");
    expect(eventTypes).toContain("order.delivered");
  });

  it("shows validation errors when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<ServiceTester services={testServices} providerUrl="https://test" />);

    // Select service
    await user.click(screen.getByTestId("service-select"));
    const option = await screen.findByText(
      `${testServices[0].service_type} (${testServices[0].price_usdc} USDC)`,
    );
    await user.click(option);

    // Clear the required "text" field
    const textInput = screen.getByTestId("input-text");
    await user.clear(textInput);

    // Click execute
    await user.click(screen.getByTestId("execute-button"));

    // Validation errors should appear
    await waitFor(() => {
      expect(screen.getByTestId("validation-errors")).toBeInTheDocument();
    });

    // Should NOT start execution
    expect(screen.queryByTestId("execution-result")).not.toBeInTheDocument();
  });

  it("clears validation errors when a new service is selected", async () => {
    const user = userEvent.setup();
    render(<ServiceTester services={testServices} providerUrl="https://test" />);

    // Select first service
    await user.click(screen.getByTestId("service-select"));
    const option1 = await screen.findByText(
      `${testServices[0].service_type} (${testServices[0].price_usdc} USDC)`,
    );
    await user.click(option1);

    // Clear required field and trigger validation
    await user.clear(screen.getByTestId("input-text"));
    await user.click(screen.getByTestId("execute-button"));

    await waitFor(() => {
      expect(screen.getByTestId("validation-errors")).toBeInTheDocument();
    });

    // Select a different service -- validation errors should clear
    await user.click(screen.getByTestId("service-select"));
    const option2 = await screen.findByText(
      `${testServices[1].service_type} (${testServices[1].price_usdc} USDC)`,
    );
    await user.click(option2);

    expect(screen.queryByTestId("validation-errors")).not.toBeInTheDocument();
  });
});

describe("validateInputs", () => {
  const service = MOCK_SERVICE_DETAILS[0]; // text_echo: requires "text"

  it("returns empty array when all required fields are filled", () => {
    const errors = validateInputs(service, { text: "hello" });
    expect(errors).toHaveLength(0);
  });

  it("returns error for missing required field", () => {
    const errors = validateInputs(service, { text: "" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("required");
  });

  it("returns error when required field is only whitespace", () => {
    const errors = validateInputs(service, { text: "   " });
    expect(errors).toHaveLength(1);
  });

  it("returns empty array when optional fields are empty", () => {
    const errors = validateInputs(service, { text: "hello", transform: "" });
    expect(errors).toHaveLength(0);
  });

  it("returns empty array for service with no required fields", () => {
    const pingService = MOCK_SERVICE_DETAILS.find((s) => s.service_type === "ping_test")!;
    const errors = validateInputs(pingService, {});
    expect(errors).toHaveLength(0);
  });
});
