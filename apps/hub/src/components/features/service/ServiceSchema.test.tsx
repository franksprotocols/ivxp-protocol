import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { ServiceSchema } from "./ServiceSchema";
import { renderWithProviders } from "@/test/test-utils";
import type { InputSchema, OutputSchema } from "@/lib/types/service";

const mockInputSchema: InputSchema = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description: "The text to echo back",
      example: "Hello IVXP!",
    },
    transform: {
      type: "string",
      description: "Optional transformation",
      example: "uppercase",
    },
  },
  required: ["text"],
};

const mockOutputSchema: OutputSchema = {
  type: "string",
  format: "text/plain",
  example: "HELLO IVXP!",
};

describe("ServiceSchema", () => {
  it("renders input parameters section", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByText("Input Parameters")).toBeInTheDocument();
  });

  it("renders output format section", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByText("Output Format")).toBeInTheDocument();
  });

  it("renders each input parameter", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByTestId("param-text")).toBeInTheDocument();
    expect(screen.getByTestId("param-transform")).toBeInTheDocument();
  });

  it("shows required badge for required parameters", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    const textParam = screen.getByTestId("param-text");
    expect(textParam).toHaveTextContent("required");
  });

  it("does not show required badge for optional parameters", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    const transformParam = screen.getByTestId("param-transform");
    expect(transformParam).not.toHaveTextContent("required");
  });

  it("renders parameter descriptions", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByText("The text to echo back")).toBeInTheDocument();
    expect(screen.getByText("Optional transformation")).toBeInTheDocument();
  });

  it("renders parameter examples", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByText("Hello IVXP!")).toBeInTheDocument();
    expect(screen.getByText("uppercase")).toBeInTheDocument();
  });

  it("renders output type", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    const outputSection = screen.getByTestId("output-schema");
    expect(outputSection).toHaveTextContent("string");
  });

  it("renders output format", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByText("text/plain")).toBeInTheDocument();
  });

  it("renders output example", () => {
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={mockOutputSchema} />,
    );
    expect(screen.getByText("HELLO IVXP!")).toBeInTheDocument();
  });

  it("handles empty properties gracefully", () => {
    const emptyInput: InputSchema = { type: "object", properties: {} };
    renderWithProviders(<ServiceSchema inputSchema={emptyInput} outputSchema={mockOutputSchema} />);
    expect(screen.getByText("No input parameters required.")).toBeInTheDocument();
  });

  it("handles output schema without format or example", () => {
    const minimalOutput: OutputSchema = { type: "object" };
    renderWithProviders(
      <ServiceSchema inputSchema={mockInputSchema} outputSchema={minimalOutput} />,
    );
    expect(screen.queryByText("Format:")).not.toBeInTheDocument();
    expect(screen.queryByText("Example output:")).not.toBeInTheDocument();
  });
});
