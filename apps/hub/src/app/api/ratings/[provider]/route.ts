import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { queryProviderRatings } from "@/lib/ratings/rating-queries";
import { createRatingCache } from "@/lib/ratings/rating-cache";
import type {
  ProviderRatingsWire,
  RatingErrorResponseWire,
  RatingSortOption,
} from "@/lib/ratings/types";

const VALID_SORT_OPTIONS: readonly string[] = ["newest", "oldest", "highest", "lowest"];

const MIN_PAGE = 1;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

/** Module-level cache instance (5 min TTL) */
const ratingCache = createRatingCache();

/** Exported for testing */
export { ratingCache as _ratingCache };

function parseIntParam(
  value: string | null,
  defaultValue: number,
  min: number,
  max?: number,
): number {
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min) return defaultValue;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

/**
 * GET /api/ratings/[provider]
 *
 * Query params:
 *   sort   - "newest" | "oldest" | "highest" | "lowest" (default: "newest")
 *   page   - page number (default: 1)
 *   limit  - items per page (default: 10, max: 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse<ProviderRatingsWire | RatingErrorResponseWire>> {
  try {
    const { provider } = await params;

    if (!provider || provider.trim().length === 0) {
      const errorResponse: RatingErrorResponseWire = {
        error: {
          code: "INVALID_PARAMETERS",
          message: "Provider address is required.",
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { searchParams } = request.nextUrl;
    const sortParam = searchParams.get("sort") ?? "newest";
    const sort: RatingSortOption = VALID_SORT_OPTIONS.includes(sortParam)
      ? (sortParam as RatingSortOption)
      : "newest";
    const page = parseIntParam(searchParams.get("page"), MIN_PAGE, MIN_PAGE);
    const limit = parseIntParam(searchParams.get("limit"), DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);

    // Check cache first
    const cached = ratingCache.get(provider, sort, page, limit);
    if (cached) {
      return NextResponse.json(cached);
    }

    const result = queryProviderRatings(provider, { sort, page, limit });

    // Cache the result
    ratingCache.set(provider, sort, page, limit, result);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Unknown error";
    console.error("[Ratings API] GET error:", message);

    const errorResponse: RatingErrorResponseWire = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
