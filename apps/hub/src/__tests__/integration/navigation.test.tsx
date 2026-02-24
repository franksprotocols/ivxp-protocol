import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { Navigation } from "@/components/layout/Navigation";
import { MobileNav } from "@/components/layout/MobileNav";
import { Header } from "@/components/layout/Header";
import { NAVIGATION_LINKS, PROVIDER_REGISTER_PATH } from "@/components/layout/navigation-links";
import {
  createWagmiMocks,
  applyDisconnectedState,
  type MockRef,
  type WagmiMocks,
} from "../e2e/helpers/mocks";

// ── Module mocks ─────────────────────────────────────────────────────

const mockRef: MockRef<WagmiMocks> = vi.hoisted(() => ({
  current: null as unknown as WagmiMocks,
}));
const mockUsePathname = vi.fn().mockReturnValue("/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useAccount: () => mockRef.current.useAccount(),
    useConnect: () => mockRef.current.useConnect(),
    useDisconnect: () => mockRef.current.useDisconnect(),
    useChainId: () => mockRef.current.useChainId(),
    useSwitchChain: () => mockRef.current.useSwitchChain(),
  };
});

// ── Tests ────────────────────────────────────────────────────────────

describe("Navigation Integration", () => {
  beforeEach(() => {
    mockRef.current = createWagmiMocks();
    applyDisconnectedState(mockRef.current);
    mockUsePathname.mockReturnValue("/");
  });

  describe("desktop navigation", () => {
    it("renders all navigation links", () => {
      renderWithProviders(<Navigation />);

      const nav = screen.getByRole("navigation", { name: /main/i });
      for (const link of NAVIGATION_LINKS) {
        expect(within(nav).getByText(link.label)).toBeInTheDocument();
      }
    });

    it("marks Home as active when on root path", () => {
      mockUsePathname.mockReturnValue("/");
      renderWithProviders(<Navigation />);

      const homeLink = screen.getByText("Home");
      expect(homeLink).toHaveAttribute("data-active", "true");
    });

    it("marks Marketplace as active when on /marketplace", () => {
      mockUsePathname.mockReturnValue("/marketplace");
      renderWithProviders(<Navigation />);

      const marketplaceLink = screen.getByText("Marketplace");
      expect(marketplaceLink).toHaveAttribute("data-active", "true");
    });

    it("marks Marketplace as active on canonical sub-routes", () => {
      mockUsePathname.mockReturnValue("/marketplace/prov-001/text_echo");
      renderWithProviders(<Navigation />);

      const marketplaceLink = screen.getByText("Marketplace");
      expect(marketplaceLink).toHaveAttribute("data-active", "true");
    });

    it("does not mark Home as active on non-root paths", () => {
      mockUsePathname.mockReturnValue("/marketplace");
      renderWithProviders(<Navigation />);

      const homeLink = screen.getByText("Home");
      expect(homeLink).not.toHaveAttribute("data-active");
    });

    it("renders links with correct href attributes", () => {
      renderWithProviders(<Navigation />);

      for (const link of NAVIGATION_LINKS) {
        const anchor = screen.getByRole("link", { name: link.label });
        expect(anchor).toHaveAttribute("href", link.href);
      }
    });

    it("does not render provider and my orders in top navigation", () => {
      renderWithProviders(<Navigation />);

      expect(screen.queryByRole("link", { name: "Provider" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "My Orders" })).not.toBeInTheDocument();
    });
  });

  describe("mobile navigation", () => {
    it("renders the mobile menu trigger button", () => {
      renderWithProviders(<MobileNav />);

      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    });

    it("opens the mobile menu sheet on click", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MobileNav />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));

      expect(screen.getByText("Navigation")).toBeInTheDocument();
      const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
      for (const link of NAVIGATION_LINKS) {
        expect(within(mobileNav).getByText(link.label)).toBeInTheDocument();
      }
    });

    it("marks active link in mobile menu", async () => {
      mockUsePathname.mockReturnValue("/marketplace");
      const user = userEvent.setup();
      renderWithProviders(<MobileNav />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));

      const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
      const marketplaceLink = within(mobileNav).getByText("Marketplace");
      expect(marketplaceLink).toHaveAttribute("data-active", "true");
    });

    it("renders mobile links with correct href attributes", async () => {
      const user = userEvent.setup();
      renderWithProviders(<MobileNav />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));

      const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
      for (const link of NAVIGATION_LINKS) {
        const anchor = within(mobileNav).getByText(link.label);
        expect(anchor).toHaveAttribute("href", link.href);
      }
    });
  });

  describe("header navigation integration", () => {
    it("renders both desktop nav and mobile menu button", () => {
      renderWithProviders(<Header />);

      expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Provider Register" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    });

    it("renders connect wallet button alongside navigation", () => {
      renderWithProviders(<Header />);

      expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
    });

    it("renders logo link to home", () => {
      renderWithProviders(<Header />);

      const logoLink = screen.getByRole("link", { name: /ivxp/i });
      expect(logoLink).toHaveAttribute("href", "/");
    });
  });

  describe("navigation state across pages", () => {
    it("only one link is active at a time", () => {
      mockUsePathname.mockReturnValue("/marketplace");
      renderWithProviders(<Navigation />);

      const activeLinks = screen.getAllByText(
        (_, element) => element?.getAttribute("data-active") === "true",
      );
      expect(activeLinks).toHaveLength(1);
      expect(activeLinks[0]).toHaveTextContent("Marketplace");
    });

    it("about link is active on /about", () => {
      mockUsePathname.mockReturnValue("/about");
      renderWithProviders(<Navigation />);

      const aboutLink = screen.getByText("About");
      expect(aboutLink).toHaveAttribute("data-active", "true");
    });

    it("provider register link is active on /provider/register", () => {
      mockUsePathname.mockReturnValue(PROVIDER_REGISTER_PATH);
      renderWithProviders(<Navigation />);

      const registerLink = screen.getByText("Provider Register");
      expect(registerLink).toHaveAttribute("data-active", "true");
    });
  });
});
