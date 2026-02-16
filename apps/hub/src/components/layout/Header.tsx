import { ConnectButton } from "@/components/features/wallet";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">IVXP Hub</span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
