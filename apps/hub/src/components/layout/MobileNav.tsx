'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NAVIGATION_LINKS } from './navigation-links';
import { isActiveLink } from './navigation-utils';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const handleLinkClick = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[85vw] max-w-sm">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Site navigation menu
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile navigation" className="mt-4">
          <ul className="flex flex-col gap-1">
            {NAVIGATION_LINKS.map((link) => {
              const active = isActiveLink(link.href, pathname);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    data-active={active ? 'true' : undefined}
                    onClick={handleLinkClick}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
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
      </SheetContent>
    </Sheet>
  );
}
