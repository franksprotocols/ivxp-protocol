import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createAdapter,
  createAdapterSchema,
  listPublishedAdapters,
  FRAMEWORK_TYPES,
  type FrameworkType,
} from "@/lib/adapter-store";

// ---------------------------------------------------------------------------
// GET /api/adapters — paginated list of published adapters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const rawPage = parseInt(url.searchParams.get("page") ?? "1", 10);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? "20", 10);

  if (isNaN(rawPage) || isNaN(rawLimit)) {
    return NextResponse.json(
      { error: { code: "INVALID_PARAMETERS", message: "page and limit must be numbers" } },
      { status: 400 },
    );
  }

  const page = Math.max(1, Math.floor(rawPage));
  const limit = Math.min(100, Math.max(1, Math.floor(rawLimit)));

  const rawFrameworkType = url.searchParams.get("frameworkType");
  const frameworkType =
    rawFrameworkType && (FRAMEWORK_TYPES as readonly string[]).includes(rawFrameworkType)
      ? (rawFrameworkType as FrameworkType)
      : undefined;

  const result = listPublishedAdapters({ page, limit, frameworkType });

  return NextResponse.json({
    data: result.adapters,
    meta: { total: result.total, page, limit },
  });
}

// ---------------------------------------------------------------------------
// POST /api/adapters — create a new adapter entry (no auth; status defaults to pending_audit)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = createAdapterSchema.parse(body);
    const entry = createAdapter(parsed);

    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMETERS",
            message: "Validation failed.",
            details: error.issues,
          },
        },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
        { status: 400 },
      );
    }
    // eslint-disable-next-line no-console
    console.error("[Adapters API] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 },
    );
  }
}
