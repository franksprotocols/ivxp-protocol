"use client";

interface SearchEmptyStateProps {
  readonly query?: string;
  readonly hasFilters: boolean;
  readonly onClearFilters: () => void;
}

export function SearchEmptyState({ query, hasFilters, onClearFilters }: SearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-medium text-muted-foreground">No services found</p>
      {query && (
        <p className="mt-2 text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
      )}
      {hasFilters && (
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or search terms.
        </p>
      )}
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 text-sm text-primary underline hover:no-underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
