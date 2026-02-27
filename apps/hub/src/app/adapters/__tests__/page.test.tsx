import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdaptersPage from "../page";
import {
  resetStore,
  createAdapter,
  updateAdapterStatus,
} from "@/lib/adapter-store";
import { VALID_ADAPTER_INPUT } from "@/lib/__tests__/fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    copyToClipboard: vi.fn().mockResolvedValue(true),
  };
});

beforeEach(() => {
  resetStore();
});

function seedPublishedAdapter(overrides: Record<string, unknown> = {}) {
  const entry = createAdapter({ ...VALID_ADAPTER_INPUT, ...overrides });
  updateAdapterStatus(entry.id, "published", { auditResult: true });
  return entry;
}

describe("AdaptersPage", () => {
  it("renders adapter list from store", async () => {
    seedPublishedAdapter({ name: "MCP Adapter", npmPackage: "@ivxp/adapter-mcp" });
    seedPublishedAdapter({
      name: "A2A Adapter",
      npmPackage: "@ivxp/adapter-a2a",
      frameworkType: "A2A",
    });

    const page = await AdaptersPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("MCP Adapter")).toBeInTheDocument();
    expect(screen.getByText("A2A Adapter")).toBeInTheDocument();
    expect(screen.getByText("npm install @ivxp/adapter-mcp")).toBeInTheDocument();
    expect(screen.getByText("npm install @ivxp/adapter-a2a")).toBeInTheDocument();
  });

  it("renders empty state when no published adapters", async () => {
    const page = await AdaptersPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByText("No Adapters published yet")).toBeInTheDocument();
    const submitLink = screen.getByRole("link", { name: /submit an adapter/i });
    expect(submitLink).toHaveAttribute("href", "/adapters/submit");
  });

  it("filters by frameworkType search param", async () => {
    seedPublishedAdapter({ name: "MCP Adapter", npmPackage: "@ivxp/adapter-mcp" });
    seedPublishedAdapter({
      name: "A2A Adapter",
      npmPackage: "@ivxp/adapter-a2a",
      frameworkType: "A2A",
    });

    const page = await AdaptersPage({
      searchParams: Promise.resolve({ frameworkType: "MCP" }),
    });
    render(page);

    expect(screen.getByText("MCP Adapter")).toBeInTheDocument();
    expect(screen.queryByText("A2A Adapter")).not.toBeInTheDocument();
  });

  it("renders page heading", async () => {
    const page = await AdaptersPage({
      searchParams: Promise.resolve({}),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "Adapters" })).toBeInTheDocument();
  });

  it("discards invalid frameworkType and shows all adapters", async () => {
    seedPublishedAdapter({ name: "MCP Adapter", npmPackage: "@ivxp/adapter-mcp" });

    const page = await AdaptersPage({
      searchParams: Promise.resolve({ frameworkType: "InvalidType" }),
    });
    render(page);

    expect(screen.getByText("MCP Adapter")).toBeInTheDocument();
  });
});
