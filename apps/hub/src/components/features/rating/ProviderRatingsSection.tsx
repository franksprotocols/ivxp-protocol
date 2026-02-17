"use client";

import { useRatings } from "@/hooks/use-ratings";
import { ProviderRating } from "./ProviderRating";
import { RatingList } from "./RatingList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProviderRatingsSectionProps {
  readonly providerAddress: string;
}

/**
 * Full ratings section for a provider detail page.
 * Fetches ratings via SWR and renders the average + list.
 */
export function ProviderRatingsSection({ providerAddress }: ProviderRatingsSectionProps) {
  const {
    data,
    isLoading,
    sort,
    page: _page,
    onSortChange,
    onPageChange,
  } = useRatings({ providerAddress });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ratings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3" data-testid="ratings-loading">
            <div className="h-8 w-32 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
            <div className="h-20 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card data-testid="provider-ratings-section">
      <CardHeader>
        <CardTitle className="text-lg">Ratings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProviderRating
          averageRating={data.average_rating}
          ratingCount={data.rating_count}
          distribution={data.rating_distribution}
          variant="full"
        />
        <RatingList
          ratings={data.ratings}
          total={data.total}
          page={data.page}
          limit={data.limit}
          currentSort={sort}
          onSortChange={onSortChange}
          onPageChange={onPageChange}
        />
      </CardContent>
    </Card>
  );
}
