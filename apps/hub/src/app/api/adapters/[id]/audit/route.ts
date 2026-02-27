import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAdapter, updateAdapterStatus, auditBodySchema } from "@/lib/adapter-store";
import { isAuthorized } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/adapters/[id]/audit — record interop test result
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization token." } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const existing = getAdapter(id);

  if (!existing) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Adapter not found." } },
      { status: 404 },
    );
  }

  if (existing.status !== "pending_audit") {
    return NextResponse.json(
      {
        error: {
          code: "CONFLICT",
          message: "Adapter has already been audited and cannot be re-audited.",
        },
      },
      { status: 409 },
    );
  }

  try {
    const body = await request.json();
    const parsed = auditBodySchema.parse(body);

    const newStatus = parsed.passed ? "published" : "rejected";
    const updated = updateAdapterStatus(id, newStatus, {
      auditResult: parsed.passed,
      ...(parsed.reason ? { rejectionReason: parsed.reason } : {}),
    });

    if (!updated) {
      // eslint-disable-next-line no-console
      console.error("[Adapters Audit API] updateAdapterStatus returned undefined for id:", id);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: updated });
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
    console.error("[Adapters Audit API] POST error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 },
    );
  }
}
