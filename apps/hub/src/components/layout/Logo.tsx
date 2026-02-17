import Link from "next/link";
import { Zap } from "lucide-react";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 text-lg font-bold tracking-tight transition-colors hover:text-primary/80"
      aria-label="IVXP - Go to homepage"
    >
      <Zap className="h-5 w-5 text-primary" />
      <span>IVXP</span>
    </Link>
  );
}
