import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntegrationCodeSnippet } from "../IntegrationCodeSnippet";

describe("IntegrationCodeSnippet", () => {
  it("renders A2A snippet with correct import and getCatalog call", () => {
    render(<IntegrationCodeSnippet frameworkType="A2A" packageName="@ivxp/adapter-a2a" />);
    const code = screen.getByTestId("integration-code").textContent ?? "";
    expect(code).toContain('import { IVXPAdapter } from "@ivxp/adapter-a2a"');
    expect(code).toContain("getCatalog");
  });

  it("renders LangGraph snippet with correct import", () => {
    render(
      <IntegrationCodeSnippet frameworkType="LangGraph" packageName="@ivxp/adapter-langgraph" />,
    );
    const code = screen.getByTestId("integration-code").textContent ?? "";
    expect(code).toContain('import { IVXPLangGraphAdapter } from "@ivxp/adapter-langgraph"');
  });

  it("renders MCP snippet with correct import", () => {
    render(<IntegrationCodeSnippet frameworkType="MCP" packageName="@ivxp/adapter-mcp" />);
    const code = screen.getByTestId("integration-code").textContent ?? "";
    expect(code).toContain('import { IVXPMCPAdapter } from "@ivxp/adapter-mcp"');
  });

  it("renders explicit Other snippet with generic IVXPAdapter import", () => {
    render(<IntegrationCodeSnippet frameworkType="Other" packageName="@ivxp/adapter-custom" />);
    const code = screen.getByTestId("integration-code").textContent ?? "";
    expect(code).toContain('import { IVXPAdapter } from "@ivxp/adapter-custom"');
    expect(code).not.toContain("LangGraph");
    expect(code).not.toContain("MCP");
  });

  it("renders Quick Start heading", () => {
    render(<IntegrationCodeSnippet frameworkType="MCP" packageName="@ivxp/adapter-mcp" />);
    expect(screen.getByText("Quick Start")).toBeInTheDocument();
  });

  it("replaces all packageName placeholders", () => {
    render(<IntegrationCodeSnippet frameworkType="A2A" packageName="my-pkg" />);
    const code = screen.getByTestId("integration-code").textContent ?? "";
    expect(code).not.toContain("{packageName}");
    expect(code).toContain("my-pkg");
  });
});
