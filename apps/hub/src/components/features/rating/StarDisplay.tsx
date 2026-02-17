import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarDisplayProps {
  /** Rating value (0-5, supports decimals) */
  readonly rating: number;
  /** Number of stars to display */
  readonly maxStars?: number;
  /** Size variant */
  readonly size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  readonly className?: string;
}

const SIZE_MAP = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

/**
 * Read-only star visualization component.
 * Renders filled, half-filled, and empty stars based on the rating value.
 */
export function StarDisplay({ rating, maxStars = 5, size = "md", className }: StarDisplayProps) {
  const clampedRating = Math.max(0, Math.min(rating, maxStars));
  const sizeClass = SIZE_MAP[size];

  const stars = Array.from({ length: maxStars }, (_, i) => {
    const starIndex = i + 1;
    const isFilled = clampedRating >= starIndex;
    const isPartial = !isFilled && clampedRating > starIndex - 1;

    return (
      <Star
        key={starIndex}
        className={cn(
          sizeClass,
          isFilled && "fill-yellow-400 text-yellow-400",
          isPartial && "fill-yellow-400/50 text-yellow-400",
          !isFilled && !isPartial && "text-muted-foreground/30",
        )}
        aria-hidden="true"
      />
    );
  });

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={`${clampedRating.toFixed(1)} out of ${maxStars} stars`}
    >
      {stars}
    </div>
  );
}
