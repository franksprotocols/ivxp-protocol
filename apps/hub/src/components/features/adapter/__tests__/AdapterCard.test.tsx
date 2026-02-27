import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdapterCard } from "../AdapterCard";
import type { AdapterEntry } from "@/lib/adapter-store";
import type * as UtilsModule from "@/lib/utils";

vi.mock("@/lib/utils", async (importOriginal: () => Promise<typeof UtilsModule>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    copyToClipboard: vi.fn().mockResolvedValue(true),
  };
});

const mockAdapter: AdapterEntry = {
  id: "adapter-1",
  name: "IVXP MCP Adapter",
  framework: "Model Context Protocol",
  version: "1.0.0",
  npmPackage: "@ivxp/adapter-mcp",
  repositoryUrl: "https://github.com/example/adapter-mcp",
  description: "MCP adapter for IVXP protocol",
  frameworkType: "MCP",
  status: "published",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("AdapterCard", () => {
  it("renders adapter name", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    expect(screen.getByText("IVXP MCP Adapter")).toBeInTheDocument();
  });

  it("renders framework type badge", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    expect(screen.getByText("MCP")).toBeInTheDocument();
  });

  it("renders version", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    expect(screen.getByText("MCP adapter for IVXP protocol")).toBeInTheDocument();
  });

  it("renders npm install command", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    expect(screen.getByText("npm install @ivxp/adapter-mcp")).toBeInTheDocument();
  });

  it("links to adapter detail page", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/adapters/adapter-1");
  });

  it("renders copy button for install command", () => {
    render(<AdapterCard adapter={mockAdapter} />);
    expect(screen.getByRole("button", { name: /copy install command/i })).toBeInTheDocument();
  });
});
