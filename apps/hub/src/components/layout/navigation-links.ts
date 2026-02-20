export interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

export const NAVIGATION_LINKS: readonly NavigationLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playground", label: "Playground" },
  { href: "http://localhost:3004", label: "Docs" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About" },
];
