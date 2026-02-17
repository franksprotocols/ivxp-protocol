"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StarRating } from "./StarRating";
import type { Stars } from "@/lib/ratings/types";

export interface RatingFormProps {
  readonly onSubmit: (stars: Stars, reviewText?: string) => void;
  readonly isLoading?: boolean;
  readonly disabled?: boolean;
}

/**
 * Rating form with star selector and optional review text.
 */
export function RatingForm({ onSubmit, isLoading = false, disabled = false }: RatingFormProps) {
  const [stars, setStars] = useState<number>(0);
  const [reviewText, setReviewText] = useState("");

  const isValid = stars >= 1 && stars <= 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const trimmed = reviewText.trim();
    onSubmit(stars as Stars, trimmed.length > 0 ? trimmed : undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="star-rating">Rating</Label>
        <StarRating value={stars} onChange={setStars} disabled={disabled || isLoading} size="lg" />
        {stars === 0 && (
          <p className="text-sm text-muted-foreground">Select a rating from 1 to 5 stars</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-text">Review (optional)</Label>
        <Textarea
          id="review-text"
          placeholder="Share your experience..."
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          disabled={disabled || isLoading}
          maxLength={1000}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">{reviewText.length}/1000</p>
      </div>

      <Button type="submit" disabled={!isValid || disabled || isLoading} className="w-full">
        {isLoading ? "Submitting..." : "Submit Rating"}
      </Button>
    </form>
  );
}
