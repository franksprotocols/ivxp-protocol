"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ServiceDetailError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <main className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t load this service. Please try again.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    </main>
  );
}
