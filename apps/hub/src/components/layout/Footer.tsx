import Link from "next/link";
import { ExternalLink } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();

const INTERNAL_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/community", label: "Community" },
] as const;

const EXTERNAL_LINKS = [
  {
    href: "https://github.com/ivxp-protocol",
    label: "GitHub",
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container flex flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          &copy; {CURRENT_YEAR} IVXP Protocol. All rights reserved.
        </p>
        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-4">
            {INTERNAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {EXTERNAL_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
