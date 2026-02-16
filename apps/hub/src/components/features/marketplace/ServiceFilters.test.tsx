import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceFilters } from "./ServiceFilters";
import { renderWithProviders } from "@/test/test-utils";
import { SERVICE_CATEGORIES } from "@/lib/types/service";

describe("ServiceFilters", () => {
  it("renders all category buttons", () => {
    renderWithProviders(
      <ServiceFilters activeCategory="All" onChange={vi.fn()} />,
    );
    for (const category of SERVICE_CATEGORIES) {
      expect(
        screen.getByRole("button", { name: category }),
      ).toBeInTheDocument();
    }
  });

  it("marks active category button as pressed", () => {
    renderWithProviders(
      <ServiceFilters activeCategory="AI" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "AI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onChange when a category is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ServiceFilters activeCategory="All" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "AI" }));

    expect(onChange).toHaveBeenCalledWith("AI");
  });

  it("has group role with accessible label", () => {
    renderWithProviders(
      <ServiceFilters activeCategory="All" onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("group", { name: /filter by category/i }),
    ).toBeInTheDocument();
  });
});
