import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdapterDetailPage from "../page";
import {
  resetStore,
  createAdapter,
  updateAdapterStatus,
} from "@/lib/adapter-store";
import { VALID_ADAPTER_INPUT } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const mockCopyToClipboard = vi.fn().mockResolvedValue(true);

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
  };
});

beforeEach(() => {
  resetStore();
  mockCopyToClipboard.mockClear();
});

function seedPublishedAdapter(overrides: Record<string, unknown> = {}) {
  const entry = createAdapter({ ...VALID_ADAPTER_INPUT, ...overrides });
  updateAdapterStatus(entry.id, "published", { auditResult: true });
  return entry;
}

describe("AdapterDetailPage", () => {
  it("renders all adapter fields for a published adapter", async () => {
    const entry = seedPublishedAdapter({
      name: "IVXP MCP Adapter",
      framework: "Model Context Protocol",
      version: "2.1.0",
      npmPackage: "@ivxp/adapter-mcp",
      repositoryUrl: "https://github.com/example/adapter-mcp",
      description: "MCP adapter for IVXP protocol",
      frameworkType: "MCP",
    });

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "IVXP MCP Adapter" })).toBeInTheDocument();
    expect(screen.getByText("MCP adapter for IVXP protocol")).toBeInTheDocument();
    expect(screen.getByText("v2.1.0")).toBeInTheDocument();
    expect(screen.getByText("npm install @ivxp/adapter-mcp")).toBeInTheDocument();
    expect(screen.getByTestId("framework-badge")).toHaveTextContent("MCP");
  });

  it("renders npm and GitHub links with correct attributes", async () => {
    const entry = seedPublishedAdapter({
      npmPackage: "@ivxp/adapter-mcp",
      repositoryUrl: "https://github.com/example/adapter-mcp",
    });

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    const npmLink = screen.getByRole("link", { name: "npm" });
    expect(npmLink).toHaveAttribute(
      "href",
      `https://www.npmjs.com/package/${encodeURIComponent("@ivxp/adapter-mcp")}`,
    );
    expect(npmLink).toHaveAttribute("target", "_blank");
    expect(npmLink).toHaveAttribute("rel", "noopener noreferrer");

    const ghLink = screen.getByRole("link", { name: "GitHub" });
    expect(ghLink).toHaveAttribute(
      "href",
      "https://github.com/example/adapter-mcp",
    );
    expect(ghLink).toHaveAttribute("target", "_blank");
    expect(ghLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render GitHub link for unsafe repositoryUrl", async () => {
    const entry = seedPublishedAdapter({
      repositoryUrl: "javascript:alert(1)",
    });

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    expect(screen.getByRole("link", { name: "npm" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "GitHub" })).not.toBeInTheDocument();
  });

  it("renders integration code snippet", async () => {
    const entry = seedPublishedAdapter({
      frameworkType: "MCP",
      npmPackage: "@ivxp/adapter-mcp",
    });

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    expect(screen.getByText("Quick Start")).toBeInTheDocument();
    const code = screen.getByTestId("integration-code").textContent ?? "";
    expect(code).toContain("IVXPMCPAdapter");
    expect(code).toContain("@ivxp/adapter-mcp");
  });

  it("renders ecosystem note with framework type", async () => {
    const entry = seedPublishedAdapter({ frameworkType: "A2A" });

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    expect(
      screen.getByText(/This A2A adapter is part of the IVXP ecosystem\./),
    ).toBeInTheDocument();
  });

  it("calls notFound when adapter does not exist", async () => {
    await expect(
      AdapterDetailPage({
        params: Promise.resolve({ id: "nonexistent-id" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("calls notFound when adapter is not published", async () => {
    const entry = createAdapter(VALID_ADAPTER_INPUT);
    // entry is pending_audit, not published

    await expect(
      AdapterDetailPage({
        params: Promise.resolve({ id: entry.id }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders back link to adapters list", async () => {
    const entry = seedPublishedAdapter();

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    const backLink = screen.getByRole("link", { name: /back to adapters/i });
    expect(backLink).toHaveAttribute("href", "/adapters");
  });

  it("calls copyToClipboard with install command when copy button clicked", async () => {
    const user = userEvent.setup();
    const entry = seedPublishedAdapter({
      npmPackage: "@ivxp/adapter-mcp",
    });

    const page = await AdapterDetailPage({
      params: Promise.resolve({ id: entry.id }),
    });
    render(page);

    const copyBtn = screen.getByRole("button", { name: /copy install command/i });
    await user.click(copyBtn);

    expect(mockCopyToClipboard).toHaveBeenCalledWith("npm install @ivxp/adapter-mcp");
  });
});
