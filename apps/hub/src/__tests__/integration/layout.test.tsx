import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
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

describe("Layout Integration", () => {
  beforeEach(() => {
    mockRef.current = createWagmiMocks();
    applyDisconnectedState(mockRef.current);
    mockUsePathname.mockReturnValue("/");
  });

  describe("header", () => {
    it("renders as a banner landmark", () => {
      renderWithProviders(<Header />);
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("has sticky positioning for scroll persistence", () => {
      renderWithProviders(<Header />);
      const header = screen.getByRole("banner");
      expect(header.className).toContain("sticky");
      expect(header.className).toContain("top-0");
    });

    it("renders logo, navigation, wallet button, and mobile menu", () => {
      renderWithProviders(<Header />);

      expect(screen.getByRole("link", { name: /ivxp/i })).toBeInTheDocument();
      expect(screen.getByRole("navigation", { name: /main/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    });

    it("renders on home page path", () => {
      mockUsePathname.mockReturnValue("/");
      renderWithProviders(<Header />);
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("renders on marketplace path", () => {
      mockUsePathname.mockReturnValue("/marketplace");
      renderWithProviders(<Header />);
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("renders on service detail path", () => {
      mockUsePathname.mockReturnValue("/marketplace/text_echo");
      renderWithProviders(<Header />);
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("renders on orders path", () => {
      mockUsePathname.mockReturnValue("/orders");
      renderWithProviders(<Header />);
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });
  });

  describe("footer", () => {
    it("renders as a contentinfo landmark", () => {
      renderWithProviders(<Footer />);
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("renders copyright text", () => {
      renderWithProviders(<Footer />);
      expect(screen.getByText(/ivxp protocol/i)).toBeInTheDocument();
      expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument();
    });

    it("renders footer navigation", () => {
      renderWithProviders(<Footer />);
      expect(screen.getByRole("navigation", { name: /footer/i })).toBeInTheDocument();
    });

    it("renders internal links (Docs, Community)", () => {
      renderWithProviders(<Footer />);
      expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
      expect(screen.getByRole("link", { name: "Community" })).toHaveAttribute("href", "/community");
    });

    it("renders external GitHub link with target _blank", () => {
      renderWithProviders(<Footer />);
      const githubLink = screen.getByRole("link", { name: /github/i });
      expect(githubLink).toHaveAttribute("href", "https://github.com/ivxp-protocol");
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("mobile menu functionality", () => {
    it("opens mobile menu and shows navigation links", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Header />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));

      expect(screen.getByRole("navigation", { name: /mobile/i })).toBeInTheDocument();
    });

    it("mobile menu shows all navigation links", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Header />);

      await user.click(screen.getByRole("button", { name: /open menu/i }));

      const mobileNav = screen.getByRole("navigation", { name: /mobile/i });
      expect(mobileNav).toBeInTheDocument();

      // Check that links are present within mobile nav (scoped to avoid desktop nav duplicates)
      expect(within(mobileNav).getByText("Home")).toBeInTheDocument();
      expect(within(mobileNav).getByText("Marketplace")).toBeInTheDocument();
      expect(within(mobileNav).getByText("Provider Register")).toBeInTheDocument();
      expect(within(mobileNav).getByText("My Orders")).toBeInTheDocument();
      expect(within(mobileNav).getByText("About")).toBeInTheDocument();
    });
  });

  describe("layout structure", () => {
    it("header and footer render together without conflict", () => {
      renderWithProviders(
        <>
          <Header />
          <main>Content</main>
          <Footer />
        </>,
      );

      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });

    it("header appears before footer in DOM order", () => {
      const { container } = renderWithProviders(
        <>
          <Header />
          <main>Content</main>
          <Footer />
        </>,
      );

      const header = container.querySelector("header");
      const footer = container.querySelector("footer");

      expect(header).toBeTruthy();
      expect(footer).toBeTruthy();

      // header should come before footer in document order
      const comparison = header!.compareDocumentPosition(footer!);
      // Node.DOCUMENT_POSITION_FOLLOWING = 4
      expect(comparison & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
