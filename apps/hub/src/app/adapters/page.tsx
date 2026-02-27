import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdapterCard } from "@/components/features/adapter/AdapterCard";
import { FrameworkTypeFilter } from "@/components/features/adapter/FrameworkTypeFilter";
import { listPublishedAdapters, FRAMEWORK_TYPES, type FrameworkType } from "@/lib/adapter-store";

export const metadata: Metadata = {
  title: "Adapters - IVXP Hub",
  description: "Browse published IVXP adapters for popular AI agent frameworks.",
};

interface PageProps {
  searchParams: Promise<{ frameworkType?: string; page?: string }>;
}

function parseFrameworkType(raw?: string): FrameworkType | undefined {
  if (!raw) return undefined;
  return (FRAMEWORK_TYPES as readonly string[]).includes(raw) ? (raw as FrameworkType) : undefined;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg text-muted-foreground">No Adapters published yet</p>
      <Link
        href="/adapters/submit"
        className="mt-4 text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Submit an Adapter
      </Link>
    </div>
  );
}

function FilterSkeleton() {
  return (
    <div className="flex gap-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export default async function AdaptersPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const frameworkType = parseFrameworkType(resolvedParams.frameworkType);
  const page = Math.max(1, parseInt(resolvedParams.page ?? "1", 10) || 1);

  const { adapters } = listPublishedAdapters({
    page,
    limit: 20,
    frameworkType,
  });

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Adapters</h1>
        <p className="mt-2 text-muted-foreground">
          Browse IVXP adapters for popular AI agent frameworks.
        </p>
      </div>

      <div className="mb-6">
        <Suspense fallback={<FilterSkeleton />}>
          <FrameworkTypeFilter />
        </Suspense>
      </div>

      {adapters.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {adapters.map((adapter) => (
            <li key={adapter.id}>
              <AdapterCard adapter={adapter} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
