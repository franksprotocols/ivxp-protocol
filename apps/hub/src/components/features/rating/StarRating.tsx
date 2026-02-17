"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface StarRatingProps {
  readonly value: number;
  readonly onChange?: (value: number) => void;
  readonly disabled?: boolean;
  readonly size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

/**
 * Interactive star rating selector (1-5 stars).
 * Supports hover preview and keyboard navigation.
 */
export function StarRating({ value, onChange, disabled = false, size = "md" }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHoverValue(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          disabled={disabled}
          className={cn(
            "transition-colors focus:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring rounded-sm",
            disabled && "cursor-not-allowed opacity-50",
          )}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !disabled && setHoverValue(star)}
        >
          <svg
            className={cn(
              sizeClass,
              star <= displayValue
                ? "fill-yellow-400 text-yellow-400"
                : "fill-none text-muted-foreground",
            )}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
