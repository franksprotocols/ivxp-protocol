import type { RatingDistribution as RatingDistributionType } from "@/lib/ratings/types";
import { cn } from "@/lib/utils";

interface RatingDistributionProps {
  readonly distribution: RatingDistributionType;
  readonly totalCount: number;
  readonly className?: string;
}

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

/**
 * Horizontal bar chart showing the distribution of ratings (5 to 1 stars).
 */
export function RatingDistribution({
  distribution,
  totalCount,
  className,
}: RatingDistributionProps) {
  return (
    <div
      className={cn("space-y-1.5", className)}
      data-testid="rating-distribution"
    >
      {STAR_LEVELS.map((level) => {
        const count = distribution[level];
        const percentage =
          totalCount > 0 ? (count / totalCount) * 100 : 0;

        return (
          <div key={level} className="flex items-center gap-2 text-sm">
            <span className="w-3 text-right text-muted-foreground">
              {level}
            </span>
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${level} star: ${count} ratings`}
            >
              <div
                className="h-full rounded-full bg-yellow-400 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="w-6 text-right text-xs text-muted-foreground">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
