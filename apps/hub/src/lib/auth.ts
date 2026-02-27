import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Verify that the request carries a valid operator Bearer token.
 *
 * Uses constant-time comparison to prevent timing attacks.
 */
export function isAuthorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;

  const token = header.replace(/^Bearer\s+/i, "");
  const secret = process.env.HUB_OPERATOR_SECRET;
  if (!secret) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
