import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navigation } from "./Navigation";
import { NAVIGATION_LINKS } from "./navigation-links";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("Navigation", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
  });

  it("renders all navigation links", () => {
    render(<Navigation />);
    for (const link of NAVIGATION_LINKS) {
      expect(screen.getByRole("link", { name: link.label })).toBeInTheDocument();
    }
  });

  it("renders correct href for each link", () => {
    render(<Navigation />);
    for (const link of NAVIGATION_LINKS) {
      expect(screen.getByRole("link", { name: link.label })).toHaveAttribute("href", link.href);
    }
  });

  it("highlights the active link for home page", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Navigation />);
    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveAttribute("data-active", "true");
  });

  it("highlights the active link for marketplace page", () => {
    mockUsePathname.mockReturnValue("/marketplace");
    render(<Navigation />);
    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink).toHaveAttribute("data-active", "true");
  });

  it("does not highlight non-active links", () => {
    mockUsePathname.mockReturnValue("/");
    render(<Navigation />);
    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink).not.toHaveAttribute("data-active", "true");
  });

  it("highlights marketplace for sub-routes", () => {
    mockUsePathname.mockReturnValue("/marketplace/some-service");
    render(<Navigation />);
    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink).toHaveAttribute("data-active", "true");
  });

  it("highlights marketplace for trailing slash pathname", () => {
    mockUsePathname.mockReturnValue("/marketplace/");
    render(<Navigation />);
    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink).toHaveAttribute("data-active", "true");
  });

  it("renders as a nav element with accessible label", () => {
    render(<Navigation />);
    expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
  });
});
