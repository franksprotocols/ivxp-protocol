import type {
  RatingWire,
  RatingDistribution,
  ProviderRatingsWire,
  RatingSortOption,
  Stars,
} from "./types";
import { loadRatings } from "./rating-storage";

const EMPTY_DISTRIBUTION: RatingDistribution = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
};

/**
 * Calculate the distribution of star ratings.
 */
export function calculateDistribution(
  ratings: readonly RatingWire[],
): RatingDistribution {
  return ratings.reduce<RatingDistribution>(
    (dist, r) => ({
      ...dist,
      [r.stars]: dist[r.stars as Stars] + 1,
    }),
    { ...EMPTY_DISTRIBUTION },
  );
}

/**
 * Calculate the average star rating, rounded to 1 decimal.
 * Returns 0 when there are no ratings.
 */
export function calculateAverage(ratings: readonly RatingWire[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r.stars, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

/**
 * Sort ratings by the given option.
 * Returns a new array (immutable).
 */
export function sortRatings(
  ratings: readonly RatingWire[],
  sort: RatingSortOption,
): readonly RatingWire[] {
  const copy = [...ratings];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => b.created_at - a.created_at);
    case "oldest":
      return copy.sort((a, b) => a.created_at - b.created_at);
    case "highest":
      return copy.sort((a, b) => b.stars - a.stars);
    case "lowest":
      return copy.sort((a, b) => a.stars - b.stars);
    default:
      return copy;
  }
}

/**
 * Paginate a list of ratings.
 */
export function paginateRatings(
  ratings: readonly RatingWire[],
  page: number,
  limit: number,
): readonly RatingWire[] {
  const start = (page - 1) * limit;
  return ratings.slice(start, start + limit);
}

interface QueryOptions {
  readonly sort?: RatingSortOption;
  readonly page?: number;
  readonly limit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

/**
 * Query ratings for a specific provider with sorting and pagination.
 */
export function queryProviderRatings(
  providerAddress: string,
  options: QueryOptions = {},
): ProviderRatingsWire {
  const {
    sort = "newest",
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
  } = options;

  const allRatings = loadRatings();
  const providerRatings = allRatings.filter(
    (r) =>
      r.provider_address.toLowerCase() === providerAddress.toLowerCase(),
  );

  const sorted = sortRatings(providerRatings, sort);
  const paginated = paginateRatings(sorted, page, limit);

  return {
    provider_address: providerAddress,
    average_rating: calculateAverage(providerRatings),
    rating_count: providerRatings.length,
    rating_distribution: calculateDistribution(providerRatings),
    ratings: paginated,
    total: providerRatings.length,
    page,
    limit,
  };
}
