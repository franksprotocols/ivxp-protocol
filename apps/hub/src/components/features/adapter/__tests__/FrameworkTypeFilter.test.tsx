import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FrameworkTypeFilter } from "../FrameworkTypeFilter";

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

describe("FrameworkTypeFilter", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it("renders all filter options", () => {
    render(<FrameworkTypeFilter />);
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A2A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LangGraph" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MCP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Other" })).toBeInTheDocument();
  });

  it("marks 'All' as active by default", () => {
    render(<FrameworkTypeFilter />);
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("navigates with frameworkType param when filter clicked", async () => {
    const user = userEvent.setup();
    render(<FrameworkTypeFilter />);

    await user.click(screen.getByRole("button", { name: "MCP" }));

    expect(mockPush).toHaveBeenCalledWith("/adapters?frameworkType=MCP");
  });

  it("removes frameworkType param when 'All' clicked", async () => {
    mockSearchParams.set("frameworkType", "MCP");
    const user = userEvent.setup();
    render(<FrameworkTypeFilter />);

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(mockPush).toHaveBeenCalledWith("/adapters?");
  });

  it("has accessible group label", () => {
    render(<FrameworkTypeFilter />);
    expect(screen.getByRole("group", { name: /filter by framework type/i })).toBeInTheDocument();
  });
});
