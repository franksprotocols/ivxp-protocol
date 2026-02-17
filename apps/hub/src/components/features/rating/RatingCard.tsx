"use client";

import { useState } from "react";
import { truncateAddress } from "@/lib/address";
import { formatRelativeTime } from "@/lib/utils";
import type { RatingWire } from "@/lib/ratings/types";
import { StarDisplay } from "./StarDisplay";

/** Max characters before truncation */
const REVIEW_TRUNCATE_LENGTH = 200;

interface RatingCardProps {
  readonly rating: RatingWire;
}

/**
 * Displays a single rating/review card with star rating,
 * review text (with "Read more" expansion), and timestamp.
 */
export function RatingCard({ rating }: RatingCardProps) {
  const [expanded, setExpanded] = useState(false);

  const reviewText = rating.review_text ?? "";
  const isLong = reviewText.length > REVIEW_TRUNCATE_LENGTH;
  const displayText =
    isLong && !expanded
      ? `${reviewText.slice(0, REVIEW_TRUNCATE_LENGTH)}...`
      : reviewText;

  const timestamp = new Date(rating.created_at);
  const relativeTime = formatRelativeTime(timestamp);
  const clientLabel = truncateAddress(rating.client_address as `0x${string}`);

  return (
    <div
      className="space-y-2 rounded-md border p-4"
      data-testid="rating-card"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StarDisplay rating={rating.stars} size="sm" />
          <span className="text-sm font-medium">
            {rating.stars}.0
          </span>
        </div>
        <time
          className="text-xs text-muted-foreground"
          dateTime={timestamp.toISOString()}
          title={timestamp.toLocaleString()}
        >
          {relativeTime}
        </time>
      </div>

      {reviewText.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {displayText}
          {isLong && (
            <button
              type="button"
              className="ml-1 text-sm font-medium text-primary hover:underline"
              onClick={() => setExpanded((prev) => !prev)}
              data-testid="read-more-button"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </p>
      )}

      <div className="text-xs text-muted-foreground">
        by{" "}
        <span
          className="font-mono"
          title={rating.client_address}
        >
          {clientLabel}
        </span>
      </div>
    </div>
  );
}
