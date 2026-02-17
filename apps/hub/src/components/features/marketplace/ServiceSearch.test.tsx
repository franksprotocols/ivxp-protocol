import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceSearch } from "./ServiceSearch";
import { renderWithProviders } from "@/test/test-utils";

describe("ServiceSearch", () => {
  it("renders search input", () => {
    renderWithProviders(<ServiceSearch value="" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox", { name: /search services/i })).toBeInTheDocument();
  });

  it("displays the current value", () => {
    renderWithProviders(<ServiceSearch value="test query" onChange={vi.fn()} />);
    expect(screen.getByRole("searchbox")).toHaveValue("test query");
  });

  it("calls onChange when user types", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ServiceSearch value="" onChange={onChange} />);

    await user.type(screen.getByRole("searchbox"), "a");

    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("shows placeholder text", () => {
    renderWithProviders(<ServiceSearch value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search services...")).toBeInTheDocument();
  });
});
