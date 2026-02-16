'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION_LINKS } from './navigation-links';
import { isActiveLink } from './navigation-utils';

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation">
      <ul className="flex items-center gap-1">
        {NAVIGATION_LINKS.map((link) => {
          const active = isActiveLink(link.href, pathname);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                data-active={active ? 'true' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
