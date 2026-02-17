import type { RatingDistribution as RatingDistributionType } from "@/lib/ratings/types";
import { StarDisplay } from "./StarDisplay";
import { RatingDistribution } from "./RatingDistribution";
import { cn } from "@/lib/utils";

interface ProviderRatingProps {
  /** Average rating (0-5) */
  readonly averageRating: number;
  /** Total number of ratings */
  readonly ratingCount: number;
  /** Distribution of ratings by star level */
  readonly distribution?: RatingDistributionType;
  /** "compact" for service cards, "full" for detail pages */
  readonly variant?: "compact" | "full";
  readonly className?: string;
}

/**
 * Displays the average rating with stars and count.
 * Compact variant: inline stars + count (for service cards).
 * Full variant: stars + count + distribution bar chart (for detail pages).
 */
export function ProviderRating({
  averageRating,
  ratingCount,
  distribution,
  variant = "compact",
  className,
}: ProviderRatingProps) {
  if (ratingCount === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)} data-testid="no-ratings">
        No ratings yet
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn("flex items-center gap-1", className)}
        data-testid="provider-rating-compact"
      >
        <StarDisplay rating={averageRating} size="sm" />
        <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">({ratingCount})</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} data-testid="provider-rating-full">
      <div className="flex items-center gap-2">
        <span className="text-3xl font-bold">{averageRating.toFixed(1)}</span>
        <div>
          <StarDisplay rating={averageRating} size="lg" />
          <span className="text-sm text-muted-foreground">
            {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
          </span>
        </div>
      </div>
      {distribution && <RatingDistribution distribution={distribution} totalCount={ratingCount} />}
    </div>
  );
}
