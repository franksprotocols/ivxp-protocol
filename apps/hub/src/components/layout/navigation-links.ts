export interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

export const NAVIGATION_LINKS: readonly NavigationLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/provider", label: "Provider" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
  { href: "/community", label: "Community" },
  { href: "/orders", label: "My Orders" },
  { href: "/about", label: "About" },
];
