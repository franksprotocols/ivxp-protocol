import { DOCS_URL } from "@/lib/docs-url";

export interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

export const PROVIDER_REGISTER_PATH = "/provider/register";

export const NAVIGATION_LINKS: readonly NavigationLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/playground", label: "Playground" },
  { href: PROVIDER_REGISTER_PATH, label: "Provider Register" },
  { href: DOCS_URL, label: "Docs" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About" },
];
