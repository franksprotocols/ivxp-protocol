/**
 * Next.js middleware for security enforcement.
 *
 * Applies to all API routes:
 * - Rate limiting (100 req/min per IP)
 * - Security headers (CSP, HSTS, X-Frame-Options, etc.)
 * - HTTPS enforcement in production
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/ratings/rate-limiter";

/** 100 requests per minute per IP */
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimiter = createRateLimiter({
  maxRequests: RATE_LIMIT_MAX,
  windowMs: RATE_LIMIT_WINDOW_MS,
});

/** Exported for testing */
export { rateLimiter as _rateLimiter };

/** IPv4 address pattern (basic validation) */
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;

/** IPv6 address pattern (basic validation) */
const IPV6_PATTERN = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

/**
 * Extract and validate client IP address from request headers.
 *
 * Checks x-forwarded-for (reverse proxy) and x-real-ip headers.
 * Returns "unknown" if no valid IP is found.
 *
 * @param request - Next.js request object
 * @returns Validated IP address or "unknown"
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (IPV4_PATTERN.test(firstIp) || IPV6_PATTERN.test(firstIp)) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && (IPV4_PATTERN.test(realIp) || IPV6_PATTERN.test(realIp))) {
    return realIp;
  }

  return "unknown";
}

/**
 * Security headers applied to all responses.
 *
 * - Content-Security-Policy: Restricts resource loading to prevent XSS
 * - Strict-Transport-Security: Enforces HTTPS
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Legacy XSS filter
 * - Referrer-Policy: Limits referrer information
 * - Permissions-Policy: Restricts browser features
 */
function resolveAllowedConnectOrigins(): string {
  const sources = new Set<string>(["'self'", "https:"]);

  if (process.env.NODE_ENV !== "production") {
    sources.add("http://localhost:3001");
    sources.add("http://127.0.0.1:3001");
  }

  for (const envKey of ["NEXT_PUBLIC_DEMO_PROVIDER_URL", "NEXT_PUBLIC_PROVIDER_URL"] as const) {
    const value = process.env[envKey];
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        sources.add(parsed.origin);
      }
    } catch {
      // Ignore invalid URLs and keep strict defaults.
    }
  }

  return Array.from(sources).join(" ");
}

const CONNECT_SRC = resolveAllowedConnectOrigins();

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    `connect-src ${CONNECT_SRC}; ` +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // HTTPS enforcement in production
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("x-forwarded-proto") === "http"
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const clientIp = getClientIp(request);
    const rateCheck = rateLimiter.check(clientIp);

    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil(rateCheck.retryAfterMs / 1000);
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil((Date.now() + rateCheck.retryAfterMs) / 1000)),
            ...SECURITY_HEADERS,
          },
        },
      );
    }

    // Apply rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
    response.headers.set("X-RateLimit-Remaining", String(rateCheck.remaining));
    response.headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil((Date.now() + RATE_LIMIT_WINDOW_MS) / 1000)),
    );
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // Apply security headers to all responses
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
