import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitRatingBodySchema } from "@/lib/ratings/schemas";
import { submitRating } from "@/lib/ratings/rating-service";
import { useOrderStore } from "@/stores/order-store";
import { createRateLimiter } from "@/lib/ratings/rate-limiter";
import type {
  SubmitRatingResponseWire,
  RatingErrorResponseWire,
} from "@/lib/ratings/types";

/** 100 requests per minute per IP */
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimiter = createRateLimiter({
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/** Exported for testing */
export { rateLimiter as _rateLimiter };

/**
 * Extract client IP from the request.
 * Uses x-forwarded-for (reverse proxy) or x-real-ip.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getOrderFromStore(orderId: string) {
  return useOrderStore.getState().getOrder(orderId);
}

function buildZodErrorDetails(
  error: ZodError,
): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!details[key]) {
      details[key] = [];
    }
    details[key].push(issue.message);
  }
  return details;
}

/**
 * Sanitize an error for logging. Strips potentially sensitive data
 * (stack traces, internal paths) and caps message length.
 */
function sanitizeErrorForLog(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name;
    const msg = error.message.slice(0, 200);
    return `${name}: ${msg}`;
  }
  return "Non-Error thrown";
}

export async function POST(
  request: NextRequest,
): Promise<
  NextResponse<SubmitRatingResponseWire | RatingErrorResponseWire>
> {
  // Rate limiting
  const clientIp = getClientIp(request);
  const rateCheck = rateLimiter.check(clientIp);

  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
    const errorResponse: RatingErrorResponseWire = {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
    };
    return NextResponse.json(errorResponse, {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  try {
    const body = await request.json();
    const parsed = submitRatingBodySchema.parse(body);

    const result = await submitRating(
      {
        orderId: parsed.order_id,
        stars: parsed.stars as 1 | 2 | 3 | 4 | 5,
        reviewText: parsed.review_text,
        signature: parsed.signature as `0x${string}`,
        timestamp: parsed.timestamp,
      },
      getOrderFromStore,
    );

    if (!result.success) {
      const statusMap: Record<string, number> = {
        ORDER_NOT_FOUND: 404,
        ORDER_NOT_DELIVERED: 422,
        INVALID_SIGNATURE: 401,
        DUPLICATE_RATING: 409,
        TIMESTAMP_EXPIRED: 400,
      };

      const errorResponse: RatingErrorResponseWire = {
        error: {
          code: result.code,
          message: result.message,
        },
      };

      return NextResponse.json(errorResponse, {
        status: statusMap[result.code] ?? 500,
      });
    }

    const response: SubmitRatingResponseWire = {
      success: true,
      rating_id: result.ratingId,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const errorResponse: RatingErrorResponseWire = {
        error: {
          code: "INVALID_PARAMETERS",
          message: "One or more request body fields are invalid.",
          details: buildZodErrorDetails(error),
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (error instanceof SyntaxError) {
      const errorResponse: RatingErrorResponseWire = {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    console.error(
      "[Ratings API] POST error:",
      sanitizeErrorForLog(error),
    );

    const errorResponse: RatingErrorResponseWire = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
