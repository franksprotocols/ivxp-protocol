import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "./MobileNav";
import { NAVIGATION_LINKS } from "./navigation-links";
import { renderWithProviders } from "@/test/test-utils";

const mockUsePathname = vi.fn();
const mockUseRouter = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockUseRouter(),
}));

describe("MobileNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/");
    mockUseRouter.mockReturnValue({ push: mockPush });
    mockPush.mockClear();
  });

  it("renders a hamburger menu button", () => {
    renderWithProviders(<MobileNav />);
    expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
  });

  it("shows navigation links when menu is opened", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileNav />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    for (const link of NAVIGATION_LINKS) {
      expect(screen.getByRole("link", { name: link.label })).toBeInTheDocument();
    }
  });

  it("highlights the active link in mobile menu", async () => {
    mockUsePathname.mockReturnValue("/marketplace");
    const user = userEvent.setup();
    renderWithProviders(<MobileNav />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    const marketplaceLink = screen.getByRole("link", { name: "Marketplace" });
    expect(marketplaceLink).toHaveAttribute("data-active", "true");
  });

  it("has accessible label on the menu", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileNav />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));

    expect(screen.getByRole("navigation", { name: /mobile/i })).toBeInTheDocument();
  });

  it("closes the menu when a link is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileNav />);

    await user.click(screen.getByRole("button", { name: /open menu/i }));
    expect(screen.getByRole("navigation", { name: /mobile/i })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Marketplace" }));

    expect(screen.queryByRole("navigation", { name: /mobile/i })).not.toBeInTheDocument();
  });
});
