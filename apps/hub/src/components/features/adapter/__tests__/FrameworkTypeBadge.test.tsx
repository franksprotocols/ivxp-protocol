import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FrameworkTypeBadge } from "../FrameworkTypeBadge";

describe("FrameworkTypeBadge", () => {
  it("renders A2A with blue styling", () => {
    render(<FrameworkTypeBadge type="A2A" />);
    const badge = screen.getByTestId("framework-badge");
    expect(badge).toHaveTextContent("A2A");
    expect(badge.className).toContain("blue");
  });

  it("renders LangGraph with green styling", () => {
    render(<FrameworkTypeBadge type="LangGraph" />);
    const badge = screen.getByTestId("framework-badge");
    expect(badge).toHaveTextContent("LangGraph");
    expect(badge.className).toContain("green");
  });

  it("renders MCP with purple styling", () => {
    render(<FrameworkTypeBadge type="MCP" />);
    const badge = screen.getByTestId("framework-badge");
    expect(badge).toHaveTextContent("MCP");
    expect(badge.className).toContain("purple");
  });

  it("renders Other with gray styling", () => {
    render(<FrameworkTypeBadge type="Other" />);
    const badge = screen.getByTestId("framework-badge");
    expect(badge).toHaveTextContent("Other");
    expect(badge.className).toContain("gray");
  });
});
