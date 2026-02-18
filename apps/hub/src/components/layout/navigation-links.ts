export interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

export const NAVIGATION_LINKS: readonly NavigationLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playground", label: "Playground" },
  { href: "/provider/register", label: "Provider Register" },
  { href: "/orders", label: "My Orders" },
  { href: "/about", label: "About" },
];
