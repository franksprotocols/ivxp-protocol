import { ConnectButton } from "@/components/features/wallet";
import { Logo } from "./Logo";
import { Navigation } from "./Navigation";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    // bg-background/95 provides an opaque fallback for browsers that don't
    // support backdrop-filter. When supported, the blur effect kicks in with
    // a more transparent bg-background/60.
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="hidden md:block">
            <Navigation />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectButton />
          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
