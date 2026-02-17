import type { Metadata } from "next";
import { Suspense } from "react";
import { MarketplaceContent } from "@/components/features/marketplace";

export const metadata: Metadata = {
  title: "Marketplace | IVXP Hub",
  description:
    "Browse and discover AI services, data providers, and compute resources on the IVXP marketplace.",
};

export default function MarketplacePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Discover and connect with AI services, data providers, and compute resources.
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading marketplace...</div>}>
        <MarketplaceContent />
      </Suspense>
    </main>
  );
}
