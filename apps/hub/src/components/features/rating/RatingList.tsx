"use client";

import { useState } from "react";
import type { RatingWire, RatingSortOption } from "@/lib/ratings/types";
import { RatingCard } from "./RatingCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RatingListProps {
  readonly ratings: readonly RatingWire[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly onSortChange?: (sort: RatingSortOption) => void;
  readonly onPageChange?: (page: number) => void;
  readonly currentSort?: RatingSortOption;
  readonly className?: string;
}

const SORT_OPTIONS: readonly { value: RatingSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest" },
  { value: "lowest", label: "Lowest" },
  { value: "oldest", label: "Oldest" },
];

/**
 * Displays a sortable, paginated list of individual rating cards.
 */
export function RatingList({
  ratings,
  total,
  page,
  limit,
  onSortChange,
  onPageChange,
  currentSort = "newest",
  className,
}: RatingListProps) {
  const [activeSort, setActiveSort] = useState<RatingSortOption>(currentSort);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  function handleSortChange(sort: RatingSortOption) {
    setActiveSort(sort);
    onSortChange?.(sort);
  }

  if (ratings.length === 0 && total === 0) {
    return (
      <div
        className={cn("py-8 text-center text-sm text-muted-foreground", className)}
        data-testid="empty-ratings"
      >
        No reviews yet. Be the first to leave a review.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="rating-list">
      {/* Sort controls */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sort ratings">
        {SORT_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={activeSort === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange(option.value)}
            data-testid={`sort-${option.value}`}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Rating cards */}
      <div className="space-y-3">
        {ratings.map((rating) => (
          <RatingCard key={rating.rating_id} rating={rating} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between pt-2"
          data-testid="rating-pagination"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrevPage}
            onClick={() => onPageChange?.(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
